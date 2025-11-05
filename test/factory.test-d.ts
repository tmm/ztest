import type { Selectable } from "kysely"
import { expectTypeOf, test } from "vitest"
import type { DB as DB_gen } from "../generated/db.ts"
import type { Row } from "../generated/schema.ts"
import { DB } from "./db.ts"
import { Factory } from "./factory.ts"

const db = DB.get("")
const factory = Factory.create(db)

test("insert: default", async () => {
  const r1 = await factory.account.insert({})
  expectTypeOf(r1).toEqualTypeOf<Selectable<DB_gen.account>>()

  factory.account.insert({ login: "foo" })
  factory.account.insert({
    login: "foo",
    // @ts-expect-error
    foo: "bar",
  })

  const r2 = await factory.account.insert({}, {})
  expectTypeOf(r2).toEqualTypeOf<
    readonly [Selectable<DB_gen.account>, Selectable<DB_gen.account>]
  >()

  factory.account.insert({}, { login: "foo" })
  factory.account.insert(
    {},
    {
      login: "foo",
      // @ts-expect-error
      foo: "bar",
    },
  )
})

test("insert: with required fields", async () => {
  factory.repository.insert(
    // @ts-expect-error
    {},
  )
  factory.repository.insert({
    account_id: "",
  })
  factory.repository.insert({
    account_id: "",
    // @ts-expect-error
    foo: "bar",
  })

  factory.repository.insert(
    // @ts-expect-error
    { account_id: "" },
    {},
  )
  factory.repository.insert({ account_id: "" }, { account_id: "", name: "" })
  factory.repository.insert(
    // @ts-expect-error
    { account_id: "", foo: "" },
    {
      account_id: "",
    },
  )
  factory.repository.insert(
    { account_id: "" },
    {
      account_id: "",
      // @ts-expect-error
      foo: "bar",
    },
  )
})

test("insert: with owner", async () => {
  factory.repository.insert(
    // @ts-expect-error
    {},
  )
  factory.repository.insert({ account_id: "" })
  factory.repository.insert({ organization_id: "" })
  factory.repository.insert({
    account_id: "",
    // @ts-expect-error
    foo: "bar",
  })

  factory.repository.insert(
    // @ts-expect-error
    { account_id: "" },
    {},
  )
  factory.repository.insert({ account_id: "" }, { organization_id: "" })
  factory.repository.insert(
    { account_id: "" },
    {
      organization_id: "",
      // @ts-expect-error
      foo: "bar",
    },
  )
})

test("attrs: default", async () => {
  const r1 = factory.account.attrs({})
  expectTypeOf(r1).toEqualTypeOf<Selectable<DB_gen.account>>()

  factory.account.attrs({ login: "foo" })
  factory.account.attrs({
    login: "foo",
    // @ts-expect-error
    foo: "bar",
  })

  const r2 = factory.account.attrs({}, {})
  expectTypeOf(r2).toEqualTypeOf<
    readonly [Selectable<DB_gen.account>, Selectable<DB_gen.account>]
  >()

  factory.account.attrs({}, { login: "foo" })
  factory.account.attrs(
    {},
    {
      login: "foo",
      // @ts-expect-error
      foo: "bar",
    },
  )

  const r3 = factory.account.attrs({}, "zero")
  expectTypeOf(r3).toEqualTypeOf<Row.account>()

  factory.account.attrs({ login: "foo" }, "zero")
  factory.account.attrs(
    {
      login: "foo",
      // @ts-expect-error
      foo: "bar",
    },
    "zero",
  )
  // @ts-expect-error
  factory.account.attrs({}, "zro")

  const r5 = factory.account.attrs({}, {}, "zero")
  expectTypeOf(r5).toEqualTypeOf<readonly [Row.account, Row.account]>()

  factory.account.attrs({}, { login: "foo" }, "zero")
  factory.account.attrs(
    {},
    {
      login: "foo",
      // @ts-expect-error
      foo: "bar",
    },
    "zero",
  )
  // @ts-expect-error
  factory.account.attrs({}, {}, "zro")
})

test("attrs: with required fields", async () => {
  factory.repository.attrs(
    // @ts-expect-error
    {},
  )
  factory.repository.attrs({
    account_id: "",
  })
  factory.repository.attrs({
    account_id: "",
    // @ts-expect-error
    foo: "bar",
  })

  factory.repository.attrs(
    // @ts-expect-error
    { account_id: "" },
    {},
  )
  factory.repository.attrs({ account_id: "" }, { account_id: "" })
  factory.repository.attrs(
    // @ts-expect-error
    { account_id: "", foo: "" },
    {
      account_id: "",
    },
  )
  factory.repository.attrs(
    { account_id: "" },
    {
      account_id: "",
      // @ts-expect-error
      foo: "bar",
    },
  )
})

test("attrs: with owner", async () => {
  factory.repository.attrs(
    // @ts-expect-error
    {},
  )
  factory.repository.attrs({ account_id: "" })
  factory.repository.attrs({ organization_id: "" })
  factory.repository.attrs({
    account_id: "",
    // @ts-expect-error
    foo: "bar",
  })

  factory.repository.attrs(
    // @ts-expect-error
    { account_id: "" },
    {},
  )
  factory.repository.attrs({ account_id: "" }, { organization_id: "" })
  factory.repository.attrs(
    { account_id: "" },
    {
      organization_id: "",
      // @ts-expect-error
      foo: "bar",
    },
  )
})
