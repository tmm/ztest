import { Kysely } from "kysely"
import * as pg from "../api/lib/pg.ts"
import type { DB as DB_gen } from "../generated/db.ts"

export namespace DB {
  export function get(urlString: string) {
    const db = new Kysely<DB_gen>({
      dialect: pg.dialect(urlString),
    })
    return db
  }
}
