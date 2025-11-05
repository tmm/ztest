import { exec, spawn } from "node:child_process"
import { promisify } from "node:util"
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import {
  GenericContainer,
  PullPolicy,
  type StartedNetwork,
  TestContainers,
  Wait,
} from "testcontainers"
import type { TestProject } from "vitest/node"
import { startDatabase, startNetwork } from "./containers.ts"
import { Env } from "./env.ts"

export default async function (project: TestProject) {
  const env = await Env.get()
  const controller = new AbortController()

  console.log("schema: starting network")
  const network = await startNetwork()

  console.log("schema: starting database")
  const database = await startDatabase({ network })
  const databaseUri = database.getConnectionUri()

  console.log("schema: starting push")
  const push = await startWrangler({
    controller,
    databaseUri,
    env,
    log: false,
    wranglerJson: "wrangler.push.jsonc",
  })

  console.log("schema: starting sync")
  const sync = await startSync({
    env,
    database,
    network,
    pushURL: push.url,
  })

  project.provide(
    "env",
    JSON.stringify({
      ...env,
      DB_URL: databaseUri,
      VITE_SYNC_URL: `http://${sync.getHost()}:${sync.getFirstMappedPort()}`,
    } satisfies Env.Input),
  )

  return async () => {
    await sync.stop()
    await database.stop()

    controller.abort()
    setTimeout(() => {
      if (push.pid)
        try {
          process.kill(-push.pid, "SIGKILL")
        } catch {
          push.kill("SIGKILL")
        }
    }, 1_000)
  }
}

async function startSync(opts: {
  database: StartedPostgreSqlContainer & { alias: string; port: number }
  env: Env.Output
  network: StartedNetwork
  pushURL: URL
}) {
  const { database, network, pushURL } = opts

  const zeroVersion = await promisify(exec)(
    "pnpm pkg get dependencies.@rocicorp/zero",
  ).then((res) => res.stdout.toString().trim().replace(/"/g, ""))
  if (!zeroVersion) throw new Error("cannot find zero version in package.json")

  // https://node.testcontainers.org/features/networking/#expose-host-ports-to-container
  await TestContainers.exposeHostPorts(Number.parseInt(pushURL.port, 10))

  const pushOrigin = pushURL.origin.replace(
    "localhost",
    "host.testcontainers.internal",
  )

  const port = 4848
  const container = await new GenericContainer(`rocicorp/zero:${zeroVersion}`)
    .withExposedPorts(port)
    .withNetwork(network)
    .withEnvironment({
      ZERO_ADMIN_PASSWORD: "foobarbaz",
      ZERO_GET_QUERIES_FORWARD_COOKIES: "true",
      ZERO_GET_QUERIES_URL: `${pushOrigin}/queries`,
      ZERO_LOG_FORMAT: "text",
      ZERO_LOG_LEVEL: "error",
      ZERO_MUTATE_FORWARD_COOKIES: "true",
      ZERO_MUTATE_URL: `${pushOrigin}/mutate`,
      ZERO_REPLICA_FILE: "/tmp/replica.db",
      ZERO_UPSTREAM_DB: database
        .getConnectionUri()
        .replace(database.getHost(), database.alias)
        .replace(database.getPort().toString(), database.port.toString()),
    })
    .withPullPolicy(PullPolicy.alwaysPull())
    .withWaitStrategy(Wait.forHttp("/", port).forStatusCode(200))
    .withStartupTimeout(30_000)
    .start()

  return container
}

async function startWrangler(opts: {
  controller: AbortController
  databaseUri: string
  env: Env.Output
  log: boolean
  wranglerJson: string
}) {
  const { controller, databaseUri, env, log, wranglerJson } = opts

  const wrangler = spawn(
    `pnpm wrangler dev -c ${wranglerJson} --var "AUTH_SECRET:${env.AUTH_SECRET}"`,
    {
      detached: true,
      env: {
        WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB: databaseUri,
        ...process.env,
      },
      shell: true,
      signal: controller.signal,
      stdio: ["ignore", "pipe", "pipe"],
    },
  )

  const urlPromise = new Promise<URL>((resolve, reject) => {
    wrangler.stdout?.on("data", listener)
    function listener(data: Buffer) {
      const chunk = data.toString()
      const match = chunk.match(/Ready on (https?:\/\/[^\s]+)/)
      if (match?.[1]) {
        wrangler.stdout?.removeListener("data", listener)
        resolve(new URL(match[1]))
      }
    }
    wrangler.on("error", (err) =>
      reject(new Error(`wrangler failed to start: ${err.message}`)),
    )
    wrangler.on("exit", (code) => {
      if (code !== null && code !== 0)
        reject(new Error(`wrangler exited: ${code}`))
    })
  })
  wrangler.stdout?.on(
    "data",
    (data) => log && console.log("schema(stdout):", data.toString()),
  )
  wrangler.stderr?.on(
    "data",
    (data) => log && console.log("schema(stderr):", data.toString()),
  )

  const url = await urlPromise
  return Object.assign(wrangler, { url })
}
