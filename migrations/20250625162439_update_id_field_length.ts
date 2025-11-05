import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
  await migrate(db, 20)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await migrate(db, 255)
}

async function migrate(db: Kysely<unknown>, length: 20 | 255) {
  await sql`DROP TRIGGER IF EXISTS repository_check_owner_id_update_trigger ON repository`.execute(
    db,
  )

  for (const { table, column } of foreignKeyUpdates)
    await db.schema
      .alterTable(table)
      .alterColumn(column, (col) => col.setDataType(`varchar(${length})`))
      .execute()

  for (const table of tablesWithNanoidId)
    await db.schema
      .alterTable(table)
      .alterColumn("id", (col) => col.setDataType(`varchar(${length})`))
      .execute()

  await sql`
    CREATE TRIGGER repository_check_owner_id_update_trigger 
    BEFORE INSERT OR UPDATE ON repository 
    FOR EACH ROW EXECUTE FUNCTION repository_check_owner_id();
  `.execute(db)
}

const tablesWithNanoidId = [
  "account",
  "organization",
  "organization_member",
  "repository",
  "repository_member",
]

const foreignKeyUpdates = [
  { table: "organization_member", column: "account_id" },
  { table: "organization_member", column: "organization_id" },
  { table: "repository", column: "account_id" },
  { table: "repository", column: "organization_id" },
  { table: "repository_member", column: "account_id" },
  { table: "repository_member", column: "repository_id" },
]
