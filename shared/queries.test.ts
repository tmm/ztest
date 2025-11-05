import { afterAll, describe, expect, inject, test } from "vitest"
import { DB } from "../test/db.ts"
import { Env } from "../test/env.ts"
import { Factory } from "../test/factory.ts"
import { Zero } from "../test/zero.ts"
import * as queries from "./queries.ts"

const env = Env.parse(inject("env"))
const db = DB.get(env.DB_URL)
const factory = Factory.create(db)
const z = Zero.get(env)

afterAll(async () => {
  await db.destroy()
})

test("me", async () => {
  const a1 = await factory.account.insert({})

  const auth = await z.auth(a1)
  const zero = z.create(auth)

  const query = queries.me(auth, {})
  await zero.preload(query).complete
  await expect(zero.run(query)).resolves.toMatchObject(
    expect.objectContaining({ id: a1.id }),
  )

  await zero.close()
})

describe("repositoriesForAccount", () => {
  test("admins can see all repositories", async () => {
    const [admin, owner] = await factory.account.insert({ role: "crew" }, {})
    const [r1, r2] = await factory.repository.insert(
      { account_id: owner.id },
      {
        account_id: owner.id,
        private: true,
      },
    )

    const auth = await z.auth(admin)
    const zero = z.create(auth)

    const query = queries.repositoriesForAccount(auth, {
      id: owner.id,
      type: "account",
    })
    await zero.preload(query).complete
    await expect(zero.run(query)).resolves.toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({ id: r1.id }),
        expect.objectContaining({ id: r2.id }),
      ]),
    )

    await zero.close()
  })

  test("anyone can see public repositories", async () => {
    const [a1, a2] = await factory.account.insert({}, {})
    const [r1] = await factory.repository.insert(
      { account_id: a1.id },
      {
        account_id: a1.id,
        private: true,
      },
    )

    const auth = await z.auth(a2)
    const zero = z.create(auth)

    const query = queries.repositoriesForAccount(auth, {
      id: a1.id,
      type: "account",
    })
    await zero.preload(query).complete
    await expect(zero.run(query)).resolves.toMatchObject(
      expect.arrayContaining([expect.objectContaining({ id: r1.id })]),
    )

    await zero.close()
  })

  test("owner can see private repository", async () => {
    const [a1, a2] = await factory.account.insert({}, {})
    const r1 = await factory.repository.insert({
      account_id: a1.id,
      private: true,
    })

    {
      const auth = await z.auth(a1)
      const zero = z.create(auth)
      const query = queries.repositoriesForAccount(auth, {
        id: a1.id,
        type: "account",
      })
      await zero.preload(query).complete
      await expect(zero.run(query)).resolves.toMatchObject(
        expect.arrayContaining([expect.objectContaining({ id: r1.id })]),
      )
      await zero.close()
    }
    {
      const auth = await z.auth(a2)
      const zero = z.create(auth)
      const query = queries.repositoriesForAccount(auth, {
        id: a1.id,
        type: "account",
      })
      await zero.preload(query).complete
      await expect(zero.run(query)).resolves.toEqual([])
      await zero.close()
    }
  })

  test("repository member can see private repository", async () => {
    const [owner, member, nonMember] = await factory.account.insert({}, {}, {})
    const r1 = await factory.repository.insert({
      account_id: owner.id,
      private: true,
    })
    await factory.repository_member.insert({
      account_id: member.id,
      repository_id: r1.id,
    })

    {
      const auth = await z.auth(member)
      const zero = z.create(auth)
      const query = queries.repositoriesForAccount(auth, {
        id: owner.id,
        type: "account",
      })
      await zero.preload(query).complete
      await expect(zero.run(query)).resolves.toMatchObject(
        expect.arrayContaining([expect.objectContaining({ id: r1.id })]),
      )
      await zero.close()
    }
    {
      const auth = await z.auth(nonMember)
      const zero = z.create(auth)
      const query = queries.repositoriesForAccount(auth, {
        id: owner.id,
        type: "account",
      })
      await zero.preload(query).complete
      await expect(zero.run(query)).resolves.toEqual([])
      await zero.close()
    }
  })

  test("organization member can see private repository", async () => {
    const owner = await factory.organization.insert({})
    const [member, nonMember] = await factory.account.insert({}, {})
    const r1 = await factory.repository.insert({
      organization_id: owner.id,
      private: true,
    })
    await factory.organization_member.insert({
      account_id: member.id,
      organization_id: owner.id,
    })

    {
      const auth = await z.auth(member)
      const zero = z.create(auth)
      const query = queries.repositoriesForAccount(auth, {
        id: owner.id,
        type: "organization",
      })
      await zero.preload(query).complete
      await expect(zero.run(query)).resolves.toMatchObject(
        expect.arrayContaining([expect.objectContaining({ id: r1.id })]),
      )
      await zero.close()
    }
    {
      const auth = await z.auth(nonMember)
      const zero = z.create(auth)
      const query = queries.repositoriesForAccount(auth, {
        id: owner.id,
        type: "organization",
      })
      await zero.preload(query).complete
      await expect(zero.run(query)).resolves.toEqual([])
      await zero.close()
    }
  })
})
