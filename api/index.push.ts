import {
  type CustomMutatorImpl as CustomMutatorFn,
  type Schema,
  withValidation,
} from "@rocicorp/zero"
import {
  PostgresJSConnection,
  PushProcessor,
  type ServerTransaction,
  ZQLDatabase,
} from "@rocicorp/zero/pg"
import { handleGetQueriesRequest } from "@rocicorp/zero/server"
import postgres from "postgres"
import * as z from "zod/mini"
import { AuthData } from "../shared/auth.ts"
import { jsonCodec } from "../shared/codec.ts"
import { createMutators, type mutators } from "../shared/mutators.ts"
import * as queries from "../shared/queries.ts"
import { schema } from "../shared/schema.ts"
import * as Cookie from "./lib/cookie.ts"
import * as Urls from "./lib/urls.ts"

export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    const headers = {
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Origin": Urls.origins(
        Urls.fromString(env.APP_URL),
      ).join(","),
      "Access-Control-Max-Age": "86400",
    } satisfies HeadersInit

    if (req.method === "OPTIONS")
      return new Response(null, { headers, status: 204 })

    if (req.method === "GET" && url.pathname === "/ping")
      return new Response("pong", { headers, status: 200 })

    if (
      req.method !== "POST" &&
      !(url.pathname === "/mutate" || url.pathname === "/queries")
    )
      return new Response("Not found", { headers, status: 404 })

    try {
      const cookieRaw =
        req.headers.get("Cookie") ??
        // Using `Authorization` header for test compat
        req.headers
          .get("authorization")
          ?.replace("Bearer ", "") ??
        null
      const cookie = await Cookie.parseSigned(
        cookieRaw,
        env.AUTH_SECRET,
        "ztest.auth",
      )
      const authData = cookie
        ? z.decode(jsonCodec(AuthData), cookie)
        : undefined

      if (url.pathname === "/queries") {
        const result = await handleGetQueriesRequest(
          (name, args) => {
            const q = validated[name]
            if (!q) throw new Error(`No such query: ${name}`)
            return { query: q(authData, ...args) }
          },
          schema,
          req,
        )
        return Response.json(result, { headers, status: 200 })
      }

      const client = createMutators(authData)
      const mutators = {
        ...client,
      } satisfies ServerMutatorDefs

      const processor = new PushProcessor(
        new ZQLDatabase(
          new PostgresJSConnection(postgres(env.DB.connectionString)),
          schema,
        ),
      )
      const result = await processor.process(mutators, req)
      return Response.json(result, { headers, status: 200 })
    } catch (error) {
      console.error(error)
      return new Response("Internal server error", { headers, status: 500 })
    }
  },
} satisfies ExportedHandler<Pick<Env, "APP_URL" | "AUTH_SECRET" | "DB">>

const validated = Object.fromEntries(
  [
    queries.me,
    queries.repositoriesForAccount,
    // only used for testing
    queries.getRepository,
  ].map((q) => [q.queryName, withValidation(q)]),
)

type ServerMutatorDefs = {
  [namespaceOrKey in keyof mutators]: mutators[namespaceOrKey] extends CustomMutatorFn<
    infer schema,
    infer transaction,
    infer args
  >
    ? CustomServerMutatorImpl<schema, transaction, args>
    : {
        [key in keyof mutators[namespaceOrKey]]: mutators[namespaceOrKey][key] extends CustomMutatorFn<
          infer schema,
          infer transaction,
          infer args
        >
          ? CustomServerMutatorImpl<schema, transaction, args>
          : never
      }
}
type CustomServerMutatorImpl<schema extends Schema, transaction, args> = (
  tx: ServerTransaction<schema, transaction>,
  args: args,
) => Promise<void>
