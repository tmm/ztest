import { sql } from "kysely"
import { PostgresJSDialect } from "kysely-postgres-js"
import postgres from "postgres"

export function dialect(url: string) {
  return new PostgresJSDialect({
    postgres: postgres(url),
  })
}

export function nanoid() {
  return sql<string>`nanoid()`
}

export function now() {
  return sql<string>`now()`
}

export function account_role() {
  return sql<string>`account_role`
}

export function organization_member_role() {
  return sql<string>`organization_member_role`
}

export function repository_member_role() {
  return sql<string>`repository_member_role`
}
