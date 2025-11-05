import type * as zero from "@rocicorp/zero"
import { assert } from "./assert"
import type { AuthData } from "./auth"
import { assertIsLoggedIn } from "./auth"
import type { schema } from "./schema"

export function createMutators(authData: AuthData | null | undefined) {
  return {
    repository: {
      async update(tx: Transaction, args: { id: string; name: string }) {
        assertIsLoggedIn(authData)
        const repository = await tx.query.repository
          .where("id", args.id)
          .related("members")
          .related("organization", (organization) =>
            organization.related("members"),
          )
          .one()
          .run()
        if (repository?.account_id)
          assert(repository?.account_id === authData.id, "forbidden:repository")
        else
          assert(
            repository?.members.some(
              (member) => member.account_id === authData.id,
            ) ||
              repository?.organization?.members.some(
                (member) => member.account_id === authData.id,
              ),
            "forbidden:repository",
          )
        await tx.mutate.repository.update({
          id: args.id,
          name: args.name,
          updated_at: Date.now(),
        })
      },
    },
  } as const satisfies zero.CustomMutatorDefs
}

export type mutators = ReturnType<typeof createMutators>

export type Transaction = zero.Transaction<schema>
