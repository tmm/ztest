import * as cookie from "hono/cookie"
import * as cookieUtils from "hono/utils/cookie"
import * as z from "zod/mini"

export async function generateSigned(
  name: Name,
  value: string | Record<string, unknown>,
  secret: string,
  opt?: Options | undefined,
) {
  return cookie.generateSignedCookie(
    name,
    typeof value === "string" ? value : JSON.stringify(value),
    secret,
    opt,
  )
}

export async function parseSigned(
  cookieHeader: string | null,
  secret: string,
  name: Name,
) {
  if (!cookieHeader) return
  const parsed = await cookieUtils.parseSigned(cookieHeader, secret, name)
  if (!(name in parsed)) return
  return z.parse(z.object({ [name]: z.string() }), parsed)[name]
}

type Name = "ztest.auth"
export type Options = cookieUtils.CookieOptions
