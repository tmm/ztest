import { type Kysely, sql } from "kysely"
import * as pg from "../api/lib/pg.ts"

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("account")
    .addColumn("id", "varchar(255)", (col) =>
      col.primaryKey().defaultTo(pg.nanoid()),
    )
    .addColumn("inserted_at", "timestamp(0)", (col) =>
      col.notNull().defaultTo(pg.now()),
    )
    .addColumn("login", "varchar(255)", (col) => col.notNull())
    .addColumn("role", "varchar(255)", (col) => col.notNull().defaultTo("user"))
    .addColumn("updated_at", "timestamp(0)", (col) =>
      col.notNull().defaultTo(pg.now()),
    )
    .execute()

  await db.schema
    .createIndex("account_login_index")
    .on("account")
    .column("login")
    .unique()
    .execute()

  await db.schema
    .createTable("organization")
    .addColumn("id", "varchar(255)", (col) =>
      col.primaryKey().defaultTo(pg.nanoid()),
    )
    .addColumn("inserted_at", "timestamp(0)", (col) =>
      col.notNull().defaultTo(pg.now()),
    )
    .addColumn("login", "varchar(255)", (col) => col.notNull())
    .addColumn("updated_at", "timestamp(0)", (col) =>
      col.notNull().defaultTo(pg.now()),
    )
    .execute()

  await db.schema
    .createIndex("organization_login_index")
    .on("organization")
    .column("login")
    .unique()
    .execute()

  await db.schema
    .createTable("organization_member")
    .addColumn("account_id", "varchar(255)", (col) =>
      col.references("account.id").onDelete("cascade").notNull(),
    )
    .addColumn("id", "varchar(255)", (col) =>
      col.primaryKey().defaultTo(pg.nanoid()),
    )
    .addColumn("inserted_at", "timestamp(0)", (col) =>
      col.notNull().defaultTo(pg.now()),
    )
    .addColumn("organization_id", "varchar(255)", (col) =>
      col.references("organization.id").onDelete("cascade").notNull(),
    )
    .addColumn("role", "varchar(255)", (col) => col.notNull())
    .addColumn("updated_at", "timestamp(0)", (col) =>
      col.notNull().defaultTo(pg.now()),
    )
    .execute()

  await db.schema
    .createIndex("organization_member_account_id_index")
    .on("organization_member")
    .column("account_id")
    .execute()

  await db.schema
    .createIndex("organization_member_organization_id_index")
    .on("organization_member")
    .column("organization_id")
    .execute()

  await db.schema
    .createIndex("organization_member_account_id_organization_id_index")
    .on("organization_member")
    .columns(["account_id", "organization_id"])
    .unique()
    .execute()

  await db.schema
    .createTable("repository")
    .addColumn("account_id", "varchar(255)", (col) =>
      col.references("account.id").onDelete("cascade"),
    )
    .addColumn("id", "varchar(255)", (col) =>
      col.primaryKey().defaultTo(pg.nanoid()),
    )
    .addColumn("inserted_at", "timestamp(0)", (col) =>
      col.notNull().defaultTo(pg.now()),
    )
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("organization_id", "varchar(255)", (col) =>
      col.references("organization.id").onDelete("cascade"),
    )
    .addColumn("private", "boolean", (col) => col.notNull())
    .addColumn("updated_at", "timestamp(0)", (col) =>
      col.notNull().defaultTo(pg.now()),
    )
    .execute()

  await db.schema
    .createIndex("repository_account_id_index")
    .on("repository")
    .column("account_id")
    .execute()

  await db.schema
    .createIndex("repository_organization_id_index")
    .on("repository")
    .column("organization_id")
    .execute()

  await db.schema
    .createIndex("repository_account_id_name_index")
    .on("repository")
    .columns(["account_id", "name"])
    .unique()
    .execute()

  await db.schema
    .createIndex("repository_organization_id_name_index")
    .on("repository")
    .columns(["organization_id", "name"])
    .unique()
    .execute()

  await sql`
  CREATE OR REPLACE FUNCTION repository_check_owner_id()
  RETURNS TRIGGER AS $$
  BEGIN
    IF NEW.organization_id IS NOT NULL AND NEW.account_id IS NOT NULL THEN
      RAISE EXCEPTION 'repository cannot have both organization and account as owner';
    END IF;

    -- Check if organization exists
    IF EXISTS (SELECT 1 FROM organization WHERE id = NEW."organization_id") THEN
      RETURN NEW;
    END IF;

    -- Check if account exists
    IF EXISTS (SELECT 1 FROM account WHERE id = NEW."account_id") THEN
      RETURN NEW;
    END IF;

    -- If we get here, neither exists, so raise an error
    RAISE EXCEPTION 'id ''%'' does not exist in account or organization', 
      CASE 
        WHEN NEW."organization_id" IS NOT NULL THEN NEW."organization_id" 
        ELSE NEW."account_id" 
      END;
  END;
  $$ LANGUAGE plpgsql;
  `.execute(db)
  await sql`
  CREATE TRIGGER repository_check_owner_id_update_trigger
  BEFORE INSERT OR UPDATE ON repository
  FOR EACH ROW
  EXECUTE FUNCTION repository_check_owner_id();
  `.execute(db)

  await db.schema
    .createTable("repository_member")
    .addColumn("account_id", "varchar(255)", (col) =>
      col.references("account.id").onDelete("cascade").notNull(),
    )
    .addColumn("id", "varchar(255)", (col) =>
      col.primaryKey().defaultTo(pg.nanoid()),
    )
    .addColumn("inserted_at", "timestamp(0)", (col) =>
      col.notNull().defaultTo(pg.now()),
    )
    .addColumn("repository_id", "varchar(255)", (col) =>
      col.references("repository.id").onDelete("cascade").notNull(),
    )
    .addColumn("role", "varchar(255)", (col) => col.notNull())
    .addColumn("updated_at", "timestamp(0)", (col) =>
      col.notNull().defaultTo(pg.now()),
    )
    .execute()

  await db.schema
    .createIndex("repository_member_account_id_index")
    .on("repository_member")
    .column("account_id")
    .execute()

  await db.schema
    .createIndex("repository_member_repository_id_index")
    .on("repository_member")
    .column("repository_id")
    .execute()

  await db.schema
    .createIndex("repository_member_account_id_repository_id_index")
    .on("repository_member")
    .columns(["account_id", "repository_id"])
    .unique()
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("repository_member").execute()
  await db.schema.dropTable("repository").execute()
  await db.schema.dropTable("organization_member").execute()
  await db.schema.dropTable("organization").execute()
  await db.schema.dropTable("account").execute()
}
