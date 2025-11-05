import * as f from "@faker-js/faker"
import type {
  ColumnType,
  Generated,
  Insertable,
  Kysely,
  Selectable,
} from "kysely"
import * as R from "remeda"
import type { DB } from "../generated/db.ts"
import * as Nanoid from "../shared/nanoid.ts"
import type * as t from "../shared/types.ts"

const faker = new f.Faker({ locale: f.en })

export namespace Factory {
  export function create<db, config extends Config<db>>(
    db: Kysely<db>,
    config: config = defaultConfig as never,
  ): Factory<db> {
    function factory(table: keyof config) {
      return {
        attrs(
          ...args:
            | Record<string, unknown>[]
            | [...Record<string, unknown>[], ResultType]
        ) {
          const now = new Date()
          const timestamps = { inserted_at: now, updated_at: now }
          const type = typeof args.at(-1) === "string" ? args.at(-1) : undefined
          const attrs = (
            (type ? args.slice(0, -1) : args) as Record<string, unknown>[]
          ).map((overrides) =>
            R.pipe(
              R.mergeAll([
                // used internally by `insert` to allow db to generate values
                // @ts-expect-error
                type === "skip" ? {} : { id: Nanoid.generate(), ...timestamps },
                config[table]?.() ?? {},
                overrides,
              ]),
              // for `"zero"`, convert `Date` values to `number`
              R.mapValues((value) =>
                type === "zero" && value instanceof Date
                  ? value.getTime()
                  : value,
              ),
            ),
          )
          if (attrs.length === 1) return attrs.at(0)
          // biome-ignore lint/suspicious/noExplicitAny: skip
          return attrs as any
        },
        async insert(...args: Record<string, unknown>[]) {
          const query = db
            .insertInto(table as never)
            .values(this.attrs(...args, "skip" as never))
            .returningAll()
          if (args.length === 1) return query.executeTakeFirstOrThrow()
          return query.execute()
        },
      }
    }
    return new Proxy({} as never, {
      get(_target, table) {
        return factory(table as never)
      },
    })
  }

  export const defaultConfig = {
    account() {
      return {
        login: `${faker.hacker.noun().replace(/\s/g, "")}${faker.number.int({ min: 0, max: 100_000 })}`,
      }
    },
    organization() {
      return {
        login: `${faker.hacker.noun().replace(/\s/g, "")}${faker.number.int({ min: 0, max: 100_000 })}`,
      }
    },
    organization_member() {
      return { role: "member" }
    },
    repository() {
      return {
        name: `${faker.lorem.word({ length: { min: 3, max: 15 } })}${faker.number.int({ min: 0, max: 100 })}`,
        private: false,
      }
    },
    repository_member() {
      return { role: "write" }
    },
  } as const satisfies Config<Omit<DB, "permission">>
}

type Config<db> = {
  [key in keyof db as key extends string
    ? // remove tables without required fields
      Defaults<db[key]> extends Record<string, never>
      ? never
      : // require following tables to always pass fields
        key extends "channel_permission" | `${string}_redirect`
        ? never
        : key
    : never]: () => Defaults<Insertable<db[key]>>
}

type Factory<db> = {
  [key in keyof db]: db[key] extends infer tb
    ? {
        attrs: <
          const values extends
            | readonly Record<string, unknown>[]
            | readonly [...Record<string, unknown>[], ResultType],
        >(
          ...args: values &
            // mark default keys optional
            (t.OptionalKeys<Insertable<tb>> &
              Partial<Pick<Insertable<tb>, DefaultKeys<Insertable<tb>>>> &
              // mark foreign keys required
              Required<Pick<Insertable<tb>, ForeignKeys<Insertable<tb>>>> &
              // if table supports owner, then require `account_id` or `organization_id`
              (HasOwner<tb> extends true
                ? t.OneOf<{ account_id: string } | { organization_id: string }>
                : unknown) extends infer type extends Record<string, unknown>
              ? values extends readonly [
                  ...infer head,
                  infer resultType extends string,
                ]
                ? readonly [
                    ...Validate<head, type>,
                    resultType extends ResultType ? resultType : ResultType,
                  ]
                : Validate<values, type>
              : never)
        ) => values extends readonly [
          ...infer head,
          infer type extends ResultType,
        ]
          ? MaybeTuple<
              t.Compute<
                type extends "kysely" ? Selectable<tb> : KyselyToZero<tb>
              >,
              head["length"]
            >
          : MaybeTuple<Selectable<tb>, values["length"]>

        insert: <const values extends readonly Record<string, unknown>[]>(
          ...args: values &
            Validate<
              values,
              t.OptionalKeys<Insertable<tb>> &
                // mark default keys optional
                Partial<Pick<Insertable<tb>, DefaultKeys<Insertable<tb>>>> &
                // mark foreign keys required
                Required<Pick<Insertable<tb>, ForeignKeys<Insertable<tb>>>> &
                // if table supports owner, then require `account_id` or `organization_id`
                (HasOwner<tb> extends true
                  ? t.OneOf<
                      { account_id: string } | { organization_id: string }
                    >
                  : unknown)
            >
        ) => Promise<MaybeTuple<Selectable<tb>, values["length"]>>
      }
    : never
}

type Defaults<table> = Omit<
  {
    [key in keyof table as null extends table[key] ? never : key]: table[key]
  },
  "id" | "inserted_at" | "updated_at" | ForeignKeys<table>
>

type Validate<
  args extends readonly unknown[],
  type extends Record<string, unknown>,
  ///
  acc extends readonly unknown[] = [],
> = args extends readonly [infer head, ...infer tail]
  ? t.Equals<head, type> extends true
    ? Validate<tail, type, readonly [...acc, head]>
    : Validate<tail, type, readonly [...acc, type]>
  : acc

type MaybeTuple<resultType, length extends number> = length extends 1
  ? resultType
  : t.Tuple<resultType, length>

type DefaultKeys<table> = keyof Omit<
  {
    [key in keyof table as null extends table[key] ? never : key]: table[key]
  },
  ForeignKeys<table>
>

type ForeignKeys<table> = keyof table extends infer key extends keyof table
  ? key extends `${string}_id` // keys ending in `_id` are foreign keys
    ? null extends table[key] // remove nullable foreign keys
      ? never
      : key
    : never
  : never

type GeneratedKeys<table> = keyof {
  [key in keyof table as table[key] extends ColumnType<
    infer select,
    unknown | undefined,
    infer update
  >
    ? t.Equals<select, update> extends true
      ? key
      : never
    : never]: table[key] extends Generated<infer type> ? type : never
}

type HasOwner<table> = t.Equals<
  {
    [key in keyof table as key extends "account_id" | "organization_id"
      ? key
      : never]-?: table[key]
  },
  {
    account_id: string | null
    organization_id: string | null
  }
>

type KyselyToZero<
  table,
  ///
  generatedKeys extends GeneratedKeys<table> = GeneratedKeys<table>,
  schema = Insertable<table>,
> = Readonly<
  {
    [key in keyof Omit<schema, generatedKeys>]-?: DateToNumber<schema[key]>
  } & {
    [key in keyof Pick<schema, generatedKeys>]-?: DateToNumber<
      schema[key] extends infer type | undefined ? type : schema[key]
    >
  }
>

type DateToNumber<type> = [Date | string] extends [type]
  ? number | (null extends type ? null : never)
  : type

type ResultType = "kysely" | "zero"
