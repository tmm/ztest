import * as z from "@rocicorp/zero"
import { onTestFinished } from "vitest"
import * as Cookie from "../api/lib/cookie.ts"
import type * as s from "../generated/schema.ts"
import type { AuthData } from "../shared/auth.ts"
import { createMutators, type mutators } from "../shared/mutators.ts"
import { schema } from "../shared/schema.ts"
import type * as t from "../shared/types.ts"
import type { Env } from "./env.ts"

export namespace Zero {
  export function get(env: Env.Output) {
    return {
      async auth(
        opts:
          | Pick<s.Row.account, "id" | "role">
          | t.PartialBy<t.NonNullableObj<AuthData>, "role">,
      ): Promise<AuthData & { cookie: string }> {
        const { role = "user" } = opts
        const cookie = await Cookie.generateSigned(
          "ztest.auth",
          { id: opts.id, role },
          env.AUTH_SECRET,
        )
        return { role, id: opts.id, cookie }
      },
      create(
        authData?: (AuthData & { cookie: string }) | undefined,
      ): z.Zero<schema, mutators> {
        return new z.Zero({
          auth: authData?.cookie,
          kvStore: "mem",
          logLevel: "error",
          mutators: createMutators(authData),
          schema,
          server: env.VITE_SYNC_URL,
          userID: authData?.id ?? "anon",
        })
      },
      async assertAlreadyProcessed(error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "error" in error &&
          error.error === "alreadyProcessed"
        )
          return
        throw error
      },
      async catchAssert(mutatorResult: Promise<unknown>) {
        onTestFinished(() => {
          process.removeAllListeners("uncaughtException")
        })
        onTestFinished(() => {
          process.removeAllListeners("unhandledRejection")
        })
        process.once("uncaughtException", (_error) => {})
        process.once("unhandledRejection", (_error) => {})
        await mutatorResult
      },
    }
  }
}
