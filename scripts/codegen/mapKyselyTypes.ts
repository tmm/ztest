import type { ColumnMetadata, TableMetadata } from "kysely"
import ts from "typescript"

export function columnMetadataToDBType(
  column: ColumnMetadata,
  opts: {
    customTableColumnTypes: Record<string, Record<string, ts.TypeNode>>
    enums: Map<string, string[]>
    table: TableMetadata
    typeDeclarationMap: Map<string, ts.TypeAliasDeclaration>
  },
) {
  const { customTableColumnTypes, enums, table, typeDeclarationMap } = opts

  const dataType = (() => {
    // postgres enums have `dataType` set to enum object
    if (enums.has(`${table.schema}.${column.dataType}`)) return "enum"
    return column.dataType as keyof typeof definitions
  })()

  // Get type from lookup
  const type = (() => {
    if (
      table.name in customTableColumnTypes &&
      customTableColumnTypes[table.name] &&
      column.name in (customTableColumnTypes[table.name] ?? {})
    )
      return customTableColumnTypes[table.name]![column.name]!

    if (dataType in definitions) {
      const definition = definitions[dataType] as Definitions[string]
      if ("value" in definition) return process(definition)
      if (typeof definition === "function") {
        const res = definition(column, table, enums)
        if ("value" in res) return process(res)
        return res
      }
      function process(definitionNode: DefinitionNode) {
        for (const declaration of definitionNode.declarations) {
          if (!declaration.name.escapedText) continue
          typeDeclarationMap.set(declaration.name.escapedText, declaration)
        }
        return definitionNode.value
      }

      return definition
    }

    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)
  })()

  // Create node based on properties (e.g. nullable, default)
  const columnTypeNode = (() => {
    if (column.isNullable)
      return ts.factory.createUnionTypeNode([
        type,
        ts.factory.createLiteralTypeNode(ts.factory.createNull()),
      ])

    const isTimestamp = /^(date|timestampz?)$/.test(dataType)
    if (!isTimestamp && (column.hasDefaultValue || column.isAutoIncrementing)) {
      const node =
        typeDeclarationMap.get(
          ((type as ts.TypeReferenceNode).typeName as ts.Identifier)
            ?.escapedText as string,
        )?.type ?? type
      const hasColumnType =
        ts.isTypeReferenceNode(node) &&
        (node.typeName as ts.Identifier).escapedText ===
          `${kyselyIdentifier.escapedText}.${columnTypeIdentifier.escapedText}`
      // Unwrap declarations already contained in `ColumnType`
      if (hasColumnType) {
        if (!typeDeclarationMap.has(unwrapColumnTypeIdentifier.escapedText!))
          typeDeclarationMap.set(
            unwrapColumnTypeIdentifier.escapedText!,
            unwrapColumnTypeTypeAlias,
          )

        return ts.factory.createTypeReferenceNode(generatedQualifiedName, [
          ts.factory.createTypeReferenceNode(unwrapColumnTypeIdentifier, [
            type,
          ]),
        ])
      }

      return ts.factory.createTypeReferenceNode(generatedQualifiedName, [type])
    }

    return type
  })()

  // Create property
  return ts.factory.createPropertySignature(
    undefined,
    column.name,
    undefined,
    columnTypeNode,
  )
}

export const kyselyIdentifier = ts.factory.createIdentifier("k")

const columnTypeIdentifier = ts.factory.createIdentifier("ColumnType")
const columnTypeQualifiedName = ts.factory.createQualifiedName(
  kyselyIdentifier,
  columnTypeIdentifier,
)
const generatedIdentifier = ts.factory.createIdentifier("Generated")
const generatedQualifiedName = ts.factory.createQualifiedName(
  kyselyIdentifier,
  generatedIdentifier,
)
const jsonColumnTypeIdentifier = ts.factory.createIdentifier("JSONColumnType")
const jsonColumnTypeQualifiedName = ts.factory.createQualifiedName(
  kyselyIdentifier,
  jsonColumnTypeIdentifier,
)

const jsonIdentifier = ts.factory.createIdentifier("JSON")
const jsonValueIdentifier = ts.factory.createIdentifier("JSONValue")
const jsonArrayIdentifier = ts.factory.createIdentifier("JSONArray")
const jsonObjectIndentifier = ts.factory.createIdentifier("JSONObject")
const jsonTypeAlias = ts.factory.createTypeAliasDeclaration(
  [],
  jsonIdentifier,
  undefined,
  ts.factory.createTypeReferenceNode(jsonValueIdentifier, undefined),
)
const jsonValueTypeAlias = ts.factory.createTypeAliasDeclaration(
  [],
  jsonValueIdentifier,
  undefined,
  ts.factory.createUnionTypeNode([
    ts.factory.createTypeReferenceNode(jsonArrayIdentifier, undefined),
    ts.factory.createTypeReferenceNode(jsonObjectIndentifier, undefined),
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword),
    ts.factory.createLiteralTypeNode(ts.factory.createNull()),
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
  ]),
)
const jsonArrayTypeAlias = ts.factory.createTypeAliasDeclaration(
  [],
  jsonArrayIdentifier,
  undefined,
  ts.factory.createArrayTypeNode(
    ts.factory.createTypeReferenceNode(jsonValueIdentifier, undefined),
  ),
)
const jsonObjectTypeAlias = ts.factory.createTypeAliasDeclaration(
  [],
  jsonObjectIndentifier,
  undefined,
  ts.factory.createMappedTypeNode(
    undefined,
    ts.factory.createTypeParameterDeclaration(
      undefined,
      ts.factory.createIdentifier("key"),
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
      undefined,
    ),
    undefined,
    ts.factory.createToken(ts.SyntaxKind.QuestionToken),
    ts.factory.createUnionTypeNode([
      ts.factory.createTypeReferenceNode(jsonValueIdentifier, undefined),
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
    ]),
    undefined,
  ),
)

const columnIdentifier = ts.factory.createIdentifier("c")
const selectIdentifier = ts.factory.createIdentifier("s")
const insertIdentifier = ts.factory.createIdentifier("i")
const updateIdentifier = ts.factory.createIdentifier("u")

const unwrapColumnTypeIdentifier =
  ts.factory.createIdentifier("UnwrapColumnType")
const unwrapColumnTypeTypeAlias = ts.factory.createTypeAliasDeclaration(
  [],
  unwrapColumnTypeIdentifier,
  [
    ts.factory.createTypeParameterDeclaration(
      undefined,
      columnIdentifier,
      undefined,
      undefined,
    ),
  ],
  ts.factory.createConditionalTypeNode(
    ts.factory.createTypeReferenceNode(columnIdentifier, undefined),
    ts.factory.createTypeReferenceNode(columnTypeQualifiedName, [
      ts.factory.createInferTypeNode(
        ts.factory.createTypeParameterDeclaration(
          undefined,
          selectIdentifier,
          undefined,
          undefined,
        ),
      ),
      ts.factory.createInferTypeNode(
        ts.factory.createTypeParameterDeclaration(
          undefined,
          insertIdentifier,
          undefined,
          undefined,
        ),
      ),
      ts.factory.createInferTypeNode(
        ts.factory.createTypeParameterDeclaration(
          undefined,
          updateIdentifier,
          undefined,
          undefined,
        ),
      ),
    ]),
    ts.factory.createTypeReferenceNode(columnTypeQualifiedName, [
      ts.factory.createTypeReferenceNode(selectIdentifier, undefined),
      ts.factory.createUnionTypeNode([
        ts.factory.createTypeReferenceNode(insertIdentifier, undefined),
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
      ]),
      ts.factory.createTypeReferenceNode(updateIdentifier, undefined),
    ]),
    ts.factory.createTypeReferenceNode(columnTypeQualifiedName, [
      ts.factory.createTypeReferenceNode(columnIdentifier, undefined),
      ts.factory.createUnionTypeNode([
        ts.factory.createTypeReferenceNode(columnIdentifier, undefined),
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
      ]),
      ts.factory.createTypeReferenceNode(columnIdentifier, undefined),
    ]),
  ),
)

const json = {
  declarations: [
    jsonTypeAlias,
    jsonValueTypeAlias,
    jsonArrayTypeAlias,
    jsonObjectTypeAlias,
  ],
  value: ts.factory.createTypeReferenceNode(jsonColumnTypeQualifiedName, [
    ts.factory.createTypeReferenceNode(jsonIdentifier, undefined),
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
  ]),
} satisfies DefinitionNode

const dateIdentifier = ts.factory.createIdentifier("Date")
const timestampIdentifier = ts.factory.createIdentifier("Timestamp")
const timestampTypeAlias = ts.factory.createTypeAliasDeclaration(
  [],
  timestampIdentifier,
  undefined,
  ts.factory.createTypeReferenceNode(columnTypeQualifiedName, [
    ts.factory.createTypeReferenceNode(dateIdentifier, undefined),
    ts.factory.createUnionTypeNode([
      ts.factory.createTypeReferenceNode(dateIdentifier, undefined),
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
    ]),
    ts.factory.createUnionTypeNode([
      ts.factory.createTypeReferenceNode(dateIdentifier, undefined),
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
    ]),
  ]),
)
const timestamp = {
  declarations: [timestampTypeAlias],
  value: ts.factory.createTypeReferenceNode(timestampIdentifier),
} satisfies DefinitionNode

const generatedTimestampIdentifier =
  ts.factory.createIdentifier("GeneratedTimestamp")
const generatedTimestampTypeAlias = ts.factory.createTypeAliasDeclaration(
  [],
  generatedTimestampIdentifier,
  undefined,
  ts.factory.createTypeReferenceNode(columnTypeQualifiedName, [
    ts.factory.createTypeReferenceNode(dateIdentifier, undefined),
    ts.factory.createUnionTypeNode([
      ts.factory.createTypeReferenceNode(dateIdentifier, undefined),
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
    ]),
    ts.factory.createUnionTypeNode([
      ts.factory.createTypeReferenceNode(dateIdentifier, undefined),
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
    ]),
  ]),
)
const generatedTimestamp = {
  declarations: [generatedTimestampTypeAlias],
  value: ts.factory.createTypeReferenceNode(generatedTimestampIdentifier),
} satisfies DefinitionNode

// Only support zero types
// https://zero.rocicorp.dev/docs/postgres-support
const definitions = {
  bool: ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword),
  char: ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
  date(column) {
    if (column.hasDefaultValue) return generatedTimestamp
    return timestamp
  },
  enum(column, table, enums) {
    const values = enums.get(`${table.schema}.${column.dataType}`)?.sort()
    if (!values)
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)
    return ts.factory.createUnionTypeNode(
      values.map((value) =>
        ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(value)),
      ),
    )
  },
  float4: ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
  float8: ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
  int2: ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
  int4: ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
  int8: {
    declarations: [],
    value: ts.factory.createTypeReferenceNode(columnTypeQualifiedName, [
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
      ts.factory.createUnionTypeNode([
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.BigIntKeyword),
      ]),
      ts.factory.createUnionTypeNode([
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.BigIntKeyword),
      ]),
    ]),
  },
  json,
  jsonb: json,
  numeric: {
    declarations: [],
    value: ts.factory.createTypeReferenceNode(columnTypeQualifiedName, [
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
      ts.factory.createUnionTypeNode([
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
      ]),
      ts.factory.createUnionTypeNode([
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
      ]),
    ]),
  },
  serial: ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
  text: ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
  timestamp(column) {
    if (column.hasDefaultValue) return generatedTimestamp
    return timestamp
  },
  timestampz(column) {
    if (column.hasDefaultValue) return generatedTimestamp
    return timestamp
  },
  uuid: ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
  varchar: ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
} satisfies Definitions
export type PostgresColumnType = keyof typeof definitions

type Definitions<key extends string = string> = Record<
  key,
  | ts.TypeNode
  | DefinitionNode
  | ((
      column: ColumnMetadata,
      table: TableMetadata,
      enums: Map<string, string[]>,
    ) => ts.TypeNode | DefinitionNode)
>

type DefinitionNode = {
  declarations: readonly ts.TypeAliasDeclaration[]
  value: ts.TypeNode
}
