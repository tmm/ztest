import * as z from "zod/mini"

declare module "vitest" {
  export interface ProvidedContext {
    env: string
  }
}

export namespace Env {
  export async function get() {
    return {
      AUTH_SECRET: "foobarbaz",
      DB_URL: "postgres://postgres:postgres@localhost:5432/ztest_test",
      VITE_SYNC_URL: "http://localhost:4848",
    } satisfies Input
  }

  export function parse(env: unknown) {
    return z.parse(schema, typeof env === "string" ? JSON.parse(env) : env)
  }

  export const schema = z.object({
    AUTH_SECRET: z.string(),
    DB_URL: z.string(),
    VITE_SYNC_URL: z.string(),
  })

  export type Input = z.infer<typeof schema>
  export type Output = z.infer<typeof schema>
}
