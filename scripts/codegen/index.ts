import { exec } from "node:child_process"
import * as fs from "node:fs/promises"
import { promisify } from "node:util"
import { Kysely } from "kysely"
import ts from "typescript"
import * as z from "zod/mini"
import * as pg from "../../api/lib/pg.ts"
import { columnMetadataToDBType, kyselyIdentifier } from "./mapKyselyTypes.ts"
import {
  columnMetadataToZeroProperty,
  schemaIdentifier,
  tablesIdentifier,
  zeroIdentifier,
} from "./mapZeroTypes.ts"

console.log("generating database types")

const env = z.parse(z.object({ DB_URL: z.string() }), process.env)

const db = new Kysely<{
  "pg_catalog.pg_namespace": {
    nspname: string
    oid: number
  }
  pg_enum: {
    enumlabel: string
    enumtypid: number
  }
  pg_type: {
    oid: number
    typname: string
    typnamespace: number
  }
}>({ dialect: pg.dialect(env.DB_URL) })

const tables = await db.introspection.getTables()

const enums = await db
  .selectFrom("pg_type as type")
  .innerJoin("pg_enum as enum", "type.oid", "enum.enumtypid")
  .innerJoin(
    "pg_catalog.pg_namespace as namespace",
    "namespace.oid",
    "type.typnamespace",
  )
  .select(["namespace.nspname", "type.typname", "enum.enumlabel"])
  .execute()
  .then((rows) => {
    const values = new Map<string, string[]>()
    for (const row of rows) {
      const key = `${row.nspname}.${row.typname}`
      if (values.has(key))
        values.set(key, [...(values.get(key)?.values() ?? []), row.enumlabel])
      else values.set(key, [row.enumlabel])
    }
    return values
  })
  .catch(() => new Map<string, string[]>())

const customTableColumnTypes = {} satisfies Record<
  string,
  Record<string, ts.TypeNode>
>

const nodeMap: Record<"db" | "schema", ts.Node[]> = { db: [], schema: [] }
const typeDeclarationMap: Map<string, ts.TypeAliasDeclaration> = new Map()
const dbTypeParameters = []
const tableNameIdentifiers = []
const rowTypeAliases = []
const privateSchemaTables = ["account_token"]
const publicTableNames: string[] = []

// Create types
for (const table of tables) {
  if (table.schema !== "public") continue
  publicTableNames.push(table.name)

  const shouldSkipSchemaTable = privateSchemaTables.includes(table.name)
  console.log(
    `${table.name}${shouldSkipSchemaTable ? " (skipping schema)" : ""}`,
  )

  const properties = {
    db: [] as ts.PropertySignature[],
    schema: [] as ts.PropertyAssignment[],
  }
  // Create type property for each column
  for (const column of table.columns) {
    properties.db.push(
      columnMetadataToDBType(column, {
        customTableColumnTypes,
        enums,
        table,
        typeDeclarationMap,
      }),
    )
    if (!shouldSkipSchemaTable)
      properties.schema.push(
        columnMetadataToZeroProperty(column, {
          customTableColumnTypes,
          enums,
          table,
        }),
      )
  }

  const tableIdentifier = ts.factory.createIdentifier(table.name)
  if (!shouldSkipSchemaTable) tableNameIdentifiers.push(tableIdentifier)

  // DB
  {
    // Create table type alias
    const tableTypeAlias = ts.factory.createTypeAliasDeclaration(
      [],
      tableIdentifier,
      undefined,
      ts.factory.createTypeLiteralNode(properties.db),
    )
    nodeMap.db.push(tableTypeAlias)

    // Create table type property for encompassing `DB` type
    const tableDbTypeParameter = ts.factory.createPropertySignature(
      undefined,
      table.name,
      undefined,
      ts.factory.createTypeReferenceNode(tableIdentifier, undefined),
    )
    dbTypeParameters.push(tableDbTypeParameter)
  }

  // Schema
  if (!shouldSkipSchemaTable) {
    const schemaItem = ts.factory.createVariableStatement(
      [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createVariableDeclarationList(
        [
          ts.factory.createVariableDeclaration(
            ts.factory.createIdentifier(table.name),
            undefined,
            undefined,
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createCallExpression(
                  ts.factory.createPropertyAccessExpression(
                    ts.factory.createCallExpression(
                      ts.factory.createPropertyAccessExpression(
                        zeroIdentifier,
                        ts.factory.createIdentifier("table"),
                      ),
                      undefined,
                      [ts.factory.createStringLiteral(table.name)],
                    ),
                    ts.factory.createIdentifier("columns"),
                  ),
                  undefined,
                  [
                    ts.factory.createObjectLiteralExpression(
                      properties.schema,
                      true,
                    ),
                  ],
                ),
                ts.factory.createIdentifier("primaryKey"),
              ),
              undefined,
              [ts.factory.createStringLiteral("id")],
            ),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    )
    nodeMap.schema.push(schemaItem)

    const rowTypeAlias = ts.factory.createTypeAliasDeclaration(
      undefined,
      tableIdentifier,
      undefined,
      ts.factory.createTypeReferenceNode(
        ts.factory.createQualifiedName(
          zeroIdentifier,
          ts.factory.createIdentifier("Row"),
        ),
        [
          ts.factory.createIndexedAccessTypeNode(
            ts.factory.createIndexedAccessTypeNode(
              ts.factory.createParenthesizedType(
                ts.factory.createTypeQueryNode(schemaIdentifier, undefined),
              ),
              ts.factory.createLiteralTypeNode(
                ts.factory.createStringLiteral("tables"),
              ),
            ),
            ts.factory.createLiteralTypeNode(
              ts.factory.createStringLiteral(table.name),
            ),
          ),
        ],
      ),
    )
    rowTypeAliases.push(rowTypeAlias)
  }
}

// DB
{
  // Add in type declarations
  nodeMap.db.unshift(...typeDeclarationMap.values())

  // Create `DB` type alias
  const dbIdentifier = ts.factory.createIdentifier("DB")
  const dbNode = ts.factory.createInterfaceDeclaration(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    dbIdentifier,
    undefined,
    undefined,
    dbTypeParameters,
  )
  nodeMap.db.unshift(dbNode)

  // Create `DB` namespace
  const dbModuleDeclaration = ts.factory.createModuleDeclaration(
    [
      ts.factory.createToken(ts.SyntaxKind.ExportKeyword),
      ts.factory.createToken(ts.SyntaxKind.DeclareKeyword),
    ],
    dbIdentifier,
    ts.factory.createModuleBlock([
      ...publicTableNames.map((name) =>
        ts.factory.createTypeAliasDeclaration(
          undefined,
          ts.factory.createIdentifier(name),
          undefined,
          ts.factory.createIndexedAccessTypeNode(
            ts.factory.createTypeReferenceNode(dbIdentifier, undefined),
            ts.factory.createLiteralTypeNode(
              ts.factory.createStringLiteral(name),
            ),
          ),
        ),
      ),
      createWrapperModule("Insertable"),
      createWrapperModule("Selectable"),
      createWrapperModule("Updateable"),
    ]),
    ts.NodeFlags.Namespace |
      ts.NodeFlags.ExportContext |
      ts.NodeFlags.ContextFlags,
  )
  nodeMap.db.push(dbModuleDeclaration)

  function createWrapperModule(
    type: "Insertable" | "Selectable" | "Updateable",
  ) {
    const typeIdentifier = ts.factory.createIdentifier(type)
    return ts.factory.createModuleDeclaration(
      [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
      typeIdentifier,
      ts.factory.createModuleBlock(
        publicTableNames.map((name) => {
          const nameIdentifier = ts.factory.createIdentifier(name)
          return ts.factory.createTypeAliasDeclaration(
            undefined,
            nameIdentifier,
            undefined,
            ts.factory.createTypeReferenceNode(
              ts.factory.createQualifiedName(kyselyIdentifier, typeIdentifier),
              [
                ts.factory.createTypeReferenceNode(
                  ts.factory.createQualifiedName(dbIdentifier, name),
                  undefined,
                ),
              ],
            ),
          )
        }),
      ),
      ts.NodeFlags.Namespace |
        ts.NodeFlags.ExportContext |
        ts.NodeFlags.ContextFlags,
    )
  }
}

// Schema
{
  // Create `tables` const export
  const tablesExport = ts.factory.createVariableStatement(
    [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          tablesIdentifier,
          undefined,
          undefined,
          ts.factory.createArrayLiteralExpression(tableNameIdentifiers, false),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  )
  nodeMap.schema.push(tablesExport)

  // Create `Row` namespace
  const rowModuleDeclaration = ts.factory.createModuleDeclaration(
    [
      ts.factory.createToken(ts.SyntaxKind.ExportKeyword),
      ts.factory.createToken(ts.SyntaxKind.DeclareKeyword),
    ],
    ts.factory.createIdentifier("Row"),
    ts.factory.createModuleBlock(rowTypeAliases),
    ts.NodeFlags.Namespace |
      ts.NodeFlags.ExportContext |
      ts.NodeFlags.ContextFlags,
  )
  nodeMap.schema.push(rowModuleDeclaration)

  const schema = ts.factory.createVariableStatement(
    undefined,
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          schemaIdentifier,
          undefined,
          undefined,
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              zeroIdentifier,
              ts.factory.createIdentifier("createSchema"),
            ),
            undefined,
            [
              ts.factory.createObjectLiteralExpression(
                [
                  ts.factory.createShorthandPropertyAssignment(
                    tablesIdentifier,
                    undefined,
                  ),
                ],
                false,
              ),
            ],
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  )
  nodeMap.schema.push(schema)
}

// Add imports statement to start of nodes
const importLookup = {
  db: {
    packageName: "kysely",
    identifier: kyselyIdentifier,
    typeOnly: true,
  },
  schema: {
    packageName: "@rocicorp/zero",
    identifier: zeroIdentifier,
    typeOnly: false,
  },
}
for (const [key, obj] of Object.entries(importLookup)) {
  const importDeclaration = ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
      obj.typeOnly,
      undefined,
      ts.factory.createNamespaceImport(obj.identifier),
    ),
    ts.factory.createStringLiteral(obj.packageName),
    undefined,
  )
  nodeMap[key as keyof typeof importLookup].unshift(importDeclaration)
}

// Write files
const dir = "generated"
await fs.mkdir(dir, { recursive: true })
for (const [key, nodes] of Object.entries(nodeMap)) {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
  let content = ""
  for (const node of nodes) {
    content += printer.printNode(
      ts.EmitHint.Unspecified,
      node,
      ts.createSourceFile("", "", ts.ScriptTarget.Latest),
    )
    content += "\n\n"
  }
  const file = `${dir}/${key}.ts`
  await fs.writeFile(file, content)

  const res = await promisify(exec)(
    `pnpm biome format ${file} --fix --vcs-use-ignore-file=false`,
  )
  if (res.stderr) throw new Error(res.stderr)
  console.log(`created "${file}"`)
}

process.exit()
