import * as z from "zod/mini"

export const jsonCodec = <type extends z.core.$ZodType>(schema: type) =>
  z.codec(z.string(), schema, {
    decode(jsonString, ctx) {
      try {
        return JSON.parse(jsonString)
      } catch (error) {
        ctx.issues.push({
          code: "invalid_format",
          format: "json",
          input: jsonString,
          message: (error as Error).message,
        })
        return z.NEVER
      }
    },
    encode(value) {
      return JSON.stringify(value)
    },
  })
