import * as zero from "@rocicorp/zero"
import * as z from "zod/mini"
import type { AuthData } from "./auth.ts"
import { builder, type schema } from "./schema.ts"

/** Gets current authenticated user account */
export const me = zero.syncedQueryWithContext(
  "me",
  z.tuple([z.object({})]),
  (authData: AuthData | null | undefined, _args) => {
    return builder.account.where("id", "=", authData?.id ?? "").one()
  },
)

/** Gets repositories for account/organization  */
export const repositoriesForAccount = zero.syncedQueryWithContext(
  "repositoriesForAccount",
  z.tuple([
    z.object({
      id: z.string(),
      type: z.union([z.literal("account"), z.literal("organization")]),
    }),
  ]),
  (authData: AuthData | null | undefined, args) => {
    return builder.repository
      .where((q) =>
        q.cmp(
          args.type === "account" ? "account_id" : "organization_id",
          args.id,
        ),
      )
      .where((eb) => canAccessRepository(authData, eb))
  },
)

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

function definePermission<table extends keyof schema["tables"]>(
  callback: zero.PermissionRule<AuthData | null | undefined, schema, table>,
) {
  return callback
}

const accountIsLoggedIn = definePermission((auth, eb) =>
  eb.cmpLit(auth?.id ?? "", "!=", ""),
)

const accountIsAdmin = definePermission((auth, eb) =>
  eb.and(accountIsLoggedIn(auth, eb), eb.cmpLit(auth?.role ?? "", "=", "crew")),
)

const accountIsOwner = definePermission<
  "organization_member" | "repository" | "repository_member"
>((auth, eb) =>
  eb.and(
    accountIsLoggedIn(auth, eb),
    eb.cmp("account_id", "=", auth?.id ?? ""),
  ),
)

const accountIsRepositoryMember = definePermission<"repository">((auth, eb) =>
  eb.and(
    accountIsLoggedIn(auth, eb),
    eb.exists("members", (q) =>
      q.where((eb) => eb.cmp("account_id", "=", auth?.id ?? "")),
    ),
  ),
)

const accountIsOrganizationMember = definePermission<"repository">((auth, eb) =>
  eb.and(
    accountIsLoggedIn(auth, eb),
    eb.cmp("organization_id", "IS NOT", null),
    eb.exists("organization", (q) =>
      q.whereExists("members", (q) =>
        q.where((eb) => eb.cmp("account_id", "=", auth?.id ?? "")),
      ),
    ),
  ),
)

const canAccessRepository = definePermission<"repository">((auth, eb) =>
  eb.or(
    eb.cmp("private", "=", false),
    eb.and(
      eb.cmp("private", "=", true),
      eb.or(
        accountIsAdmin(auth, eb),
        accountIsOwner(auth, eb),
        accountIsRepositoryMember(auth, eb),
        accountIsOrganizationMember(auth, eb),
      ),
    ),
  ),
)

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

// only used for preloading in tests

export const getRepository = zero.syncedQueryWithContext(
  "getRepository",
  z.tuple([z.object({ id: z.string() })]),
  (authData: AuthData | null | undefined, args) => {
    return builder.repository
      .where("id", "=", args.id)
      .where((eb) => canAccessRepository(authData, eb))
      .related("members")
      .related("organization", (organization) =>
        organization.related("members"),
      )
      .one()
  },
)
