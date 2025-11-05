import * as z from "zod/mini"
import { assert } from "./assert"

export const AuthData = z.object({
  id: z.string(),
  role: z.union([z.literal("crew"), z.literal("user")]),
})

export type AuthData = z.infer<typeof AuthData>

export function assertIsLoggedIn(
  authData: AuthData | null | undefined,
): asserts authData {
  assert(authData, "unauthorized")
}
