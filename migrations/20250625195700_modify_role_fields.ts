import { type Kysely, sql } from "kysely"
import * as pg from "../api/lib/pg.ts"

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.createType("account_role").asEnum(["crew", "user"]).execute()
  await db.schema
    .createType("organization_member_role")
    .asEnum(["admin", "member"])
    .execute()
  await db.schema
    .createType("repository_member_role")
    .asEnum(["admin", "maintain", "read", "triage", "write"])
    .execute()

  await db.schema
    .alterTable("account")
    .alterColumn("role", (col) => col.dropDefault())
    .execute()

  await sql`
    ALTER TABLE account 
    ALTER COLUMN role TYPE ${pg.account_role()} 
    USING role::${pg.account_role()}
  `.execute(db)

  await db.schema
    .alterTable("account")
    .alterColumn("role", (col) =>
      col.setDefault(sql`'user'::${pg.account_role()}`),
    )
    .execute()

  await sql`
    ALTER TABLE organization_member 
    ALTER COLUMN role TYPE ${pg.organization_member_role()} 
    USING role::${pg.organization_member_role()}
  `.execute(db)

  await sql`
    ALTER TABLE repository_member 
    ALTER COLUMN role TYPE ${pg.repository_member_role()} 
    USING role::${pg.repository_member_role()}
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("account")
    .alterColumn("role", (col) => col.dropDefault())
    .execute()

  await sql`
    ALTER TABLE account 
    ALTER COLUMN role TYPE varchar(255) 
    USING role::text
  `.execute(db)

  await db.schema
    .alterTable("account")
    .alterColumn("role", (col) =>
      col.setDefault(sql`'user'::character varying`),
    )
    .execute()

  await sql`
    ALTER TABLE organization_member 
    ALTER COLUMN role TYPE varchar(255) 
    USING role::text
  `.execute(db)

  await sql`
    ALTER TABLE repository_member 
    ALTER COLUMN role TYPE varchar(255) 
    USING role::text
  `.execute(db)

  await db.schema.dropType("account_role").execute()
  await db.schema.dropType("organization_member_role").execute()
  await db.schema.dropType("repository_member_role").execute()
}
