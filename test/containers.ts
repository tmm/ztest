import { exec } from "node:child_process"
import { promisify } from "node:util"
import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { Network, PullPolicy, type StartedNetwork } from "testcontainers"

export function startNetwork() {
  return new Network().start()
}

export async function startDatabase(opts: { network: StartedNetwork }) {
  const config = { alias: "db", port: 5432 }
  const container = await new PostgreSqlContainer("postgres:16.2-alpine")
    .withNetwork(opts.network)
    .withNetworkAliases(config.alias)
    .withExposedPorts(config.port)
    .withCommand([
      "postgres",
      "-c",
      "hot_standby=on",
      "-c",
      "hot_standby_feedback=on",
      "-c",
      "max_replication_slots=5",
      "-c",
      "max_connections=400",
      "-c",
      "max_wal_senders=10",
      "-c",
      "wal_level=logical",
    ])
    .withPullPolicy(PullPolicy.alwaysPull())
    .start()

  const res = await promisify(exec)(
    `DB_URL=${container.getConnectionUri()} pnpm kysely migrate:latest`,
  )
  if (res.stderr) throw new Error(res.stderr)

  return Object.assign(container, config)
}
