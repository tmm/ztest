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

describe("repository.update", () => {
  test("only owner can update", async () => {
    const [owner, nonOwner] = await factory.account.insert({}, {})
    const r1 = await factory.repository.insert({
      account_id: owner.id,
      name: "foo",
    })

    {
      const auth = await z.auth(nonOwner)
      const zero = z.create(auth)
      const query = queries.getRepository(auth, { id: r1.id })
      await zero.preload(query).complete
      await expect(
        z.catchAssert(
          zero.mutate.repository.update({ id: r1.id, name: "bar" }).server,
        ),
      ).rejects.toThrowError("forbidden:repository")
      await zero.close()
    }
    {
      const auth = await z.auth(owner)
      const zero = z.create(auth)
      const query = queries.getRepository(auth, { id: r1.id })
      await zero.preload(query).complete
      await zero.mutate.repository
        .update({ id: r1.id, name: "bar" })
        .server.catch(z.assertAlreadyProcessed)
      await expect(
        db
          .selectFrom("repository")
          .select("name")
          .where("id", "=", r1.id)
          .executeTakeFirst(),
      ).resolves.toHaveProperty("name", "bar")
      await zero.close()
    }
  })

  test("organization/repository member can update", async () => {
    const o1 = await factory.organization.insert({})
    const [organizationMember, repositoryMember, nonMember] =
      await factory.account.insert({}, {}, {})
    const [r1, r2] = await factory.repository.insert(
      {
        name: "foo1",
        organization_id: o1.id,
      },
      {
        name: "foo2",
        organization_id: o1.id,
      },
    )
    await factory.organization_member.insert({
      account_id: organizationMember.id,
      organization_id: o1.id,
    })
    await factory.repository_member.insert({
      account_id: repositoryMember.id,
      repository_id: r2.id,
    })

    {
      const auth = await z.auth(nonMember)
      const zero = z.create(auth)
      const query = queries.getRepository(auth, { id: r1.id })
      await zero.preload(query).complete
      await expect(
        z.catchAssert(
          zero.mutate.repository.update({ id: r1.id, name: "bar" }).server,
        ),
      ).rejects.toThrowError("forbidden:repository")
      await zero.close()
    }
    {
      const auth = await z.auth(organizationMember)
      const zero = z.create(auth)
      const query = queries.getRepository(auth, { id: r1.id })
      await zero.preload(query).complete
      await zero.mutate.repository
        .update({ id: r1.id, name: "bar1" })
        .server.catch(z.assertAlreadyProcessed)
      await expect(
        db
          .selectFrom("repository")
          .select("name")
          .where("id", "=", r1.id)
          .executeTakeFirst(),
      ).resolves.toHaveProperty("name", "bar1")
      await zero.close()
    }
    {
      const auth = await z.auth(repositoryMember)
      const zero = z.create(auth)
      const query = queries.getRepository(auth, { id: r2.id })
      await zero.preload(query).complete
      await zero.mutate.repository
        .update({ id: r2.id, name: "bar2" })
        .server.catch(z.assertAlreadyProcessed)
      await expect(
        db
          .selectFrom("repository")
          .select("name")
          .where("id", "=", r2.id)
          .executeTakeFirst(),
      ).resolves.toHaveProperty("name", "bar2")
      await zero.close()
    }
  })
})
