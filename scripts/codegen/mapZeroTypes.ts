import type { ColumnMetadata, TableMetadata } from "kysely"
import ts from "typescript"
import type { PostgresColumnType } from "./mapKyselyTypes.ts"

export function columnMetadataToZeroProperty(
  column: ColumnMetadata,
  opts: {
    customTableColumnTypes: Record<string, Record<string, ts.TypeNode>>
    enums: Map<string, string[]>
    table: TableMetadata
  },
) {
  const { customTableColumnTypes, enums, table } = opts

  const dataType = (() => {
    // postgres enums have `dataType` set to enum object
    if (enums.has(`${table.schema}.${column.dataType}`)) return "enum"
    return column.dataType as keyof typeof definitions
  })()

  // Get type from lookup
  const type = (() => {
    if (dataType in definitions) {
      const definition = definitions[dataType] as Definitions[string]

      if (typeof definition === "function")
        return definition(column, table, enums)

      return ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(zeroIdentifier, definition),
        table.name in customTableColumnTypes &&
          customTableColumnTypes[table.name] &&
          column.name in (customTableColumnTypes[table.name] ?? {})
          ? [customTableColumnTypes[table.name]![column.name]!]
          : undefined,
        [],
      )
    }

    throw new Error(
      `Unknown Zero property type "${dataType}" for property "${table.name}.${column.name}"`,
    )
  })()

  return ts.factory.createPropertyAssignment(
    ts.factory.createIdentifier(column.name),
    column.isNullable
      ? ts.factory.createCallExpression(
          ts.factory.createPropertyAccessExpression(
            type,
            ts.factory.createIdentifier("optional"),
          ),
          undefined,
          [],
        )
      : type,
  )
}

export const zeroIdentifier = ts.factory.createIdentifier("z")

const booleanIdentifier = ts.factory.createIdentifier("boolean")
const dateIdentifier = ts.factory.createIdentifier("number")
const enumerationIdentifier = ts.factory.createIdentifier("enumeration")
const jsonIdentifier = ts.factory.createIdentifier("json")
const numberIdentifier = ts.factory.createIdentifier("number")
const stringIdentifier = ts.factory.createIdentifier("string")

// https://zero.rocicorp.dev/docs/postgres-support
const definitions = {
  bool: booleanIdentifier,
  char: stringIdentifier,
  date: dateIdentifier,
  enum(column, table, enums) {
    const values = enums.get(`${table.schema}.${column.dataType}`)?.sort()
    return ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier("z"),
        enumerationIdentifier,
      ),
      [
        values
          ? ts.factory.createUnionTypeNode(
              values.map((value) =>
                ts.factory.createLiteralTypeNode(
                  ts.factory.createStringLiteral(value),
                ),
              ),
            )
          : ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
      ],
      [],
    )
  },
  float4: numberIdentifier,
  float8: numberIdentifier,
  int2: numberIdentifier,
  int4: numberIdentifier,
  int8: numberIdentifier,
  json: jsonIdentifier,
  jsonb: jsonIdentifier,
  numeric: numberIdentifier,
  serial: numberIdentifier,
  text: stringIdentifier,
  timestamp: dateIdentifier,
  timestampz: dateIdentifier,
  uuid: stringIdentifier,
  varchar: stringIdentifier,
} satisfies Definitions<PostgresColumnType>

type Definitions<key extends string = string> = Record<
  key,
  | ts.Identifier
  | ((
      column: ColumnMetadata,
      table: TableMetadata,
      enums: Map<string, string[]>,
    ) => ts.CallExpression)
>

export const tablesIdentifier = ts.factory.createIdentifier("tables")
export const schemaIdentifier = ts.factory.createIdentifier("schema")
