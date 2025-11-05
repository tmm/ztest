import * as z from "@rocicorp/zero"
import * as t from "../generated/schema.ts"
import { tables } from "../generated/schema.ts"

const accountRelationships = z.relationships(t.account, (c) => ({
  organization_memberships: c.many({
    sourceField: ["id"],
    destField: ["account_id"],
    destSchema: t.organization_member,
  }),
  repositories: c.many({
    sourceField: ["id"],
    destSchema: t.repository,
    destField: ["account_id"],
  }),
  repository_memberships: c.many({
    sourceField: ["id"],
    destField: ["account_id"],
    destSchema: t.repository_member,
  }),
}))

const organizationRelationships = z.relationships(t.organization, (c) => ({
  accounts: c.many(
    {
      sourceField: ["id"],
      destField: ["organization_id"],
      destSchema: t.organization_member,
    },
    {
      sourceField: ["account_id"],
      destField: ["id"],
      destSchema: t.account,
    },
  ),
  members: c.many({
    sourceField: ["id"],
    destField: ["organization_id"],
    destSchema: t.organization_member,
  }),
  repositories: c.many({
    sourceField: ["id"],
    destField: ["organization_id"],
    destSchema: t.repository,
  }),
}))

const organizationMemberRelationships = z.relationships(
  t.organization_member,
  (c) => ({
    organization: c.one({
      sourceField: ["organization_id"],
      destField: ["id"],
      destSchema: t.organization,
    }),
    account: c.one({
      sourceField: ["account_id"],
      destField: ["id"],
      destSchema: t.account,
    }),
  }),
)

const repositoryRelationships = z.relationships(t.repository, (c) => ({
  account: c.one({
    sourceField: ["account_id"],
    destField: ["id"],
    destSchema: t.account,
  }),
  accounts: c.many(
    {
      sourceField: ["id"],
      destField: ["repository_id"],
      destSchema: t.repository_member,
    },
    {
      sourceField: ["account_id"],
      destField: ["id"],
      destSchema: t.account,
    },
  ),
  members: c.many({
    sourceField: ["id"],
    destField: ["repository_id"],
    destSchema: t.repository_member,
  }),
  organization: c.one({
    sourceField: ["organization_id"],
    destField: ["id"],
    destSchema: t.organization,
  }),
}))

const repositoryMemberRelationships = z.relationships(
  t.repository_member,
  (c) => ({
    repository: c.one({
      sourceField: ["repository_id"],
      destField: ["id"],
      destSchema: t.repository,
    }),
    account: c.one({
      sourceField: ["account_id"],
      destField: ["id"],
      destSchema: t.account,
    }),
  }),
)

export const schema = z.createSchema({
  enableLegacyMutators: false,
  enableLegacyQueries: false,
  tables,
  relationships: [
    accountRelationships,
    organizationRelationships,
    organizationMemberRelationships,
    repositoryRelationships,
    repositoryMemberRelationships,
  ],
})
export type schema = typeof schema

export const builder = z.createBuilder(schema)

// TODO: Zero requires an empty permissions object even if we're not using them :(
export const permissions = z.definePermissions(schema, () => ({}))
