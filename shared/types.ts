export type Compute<type> = { [key in keyof type]: type[key] } & unknown

export type Equals<T, U> = (<G>() => G extends T ? 1 : 2) extends <
  G,
>() => G extends U ? 1 : 2
  ? true
  : false

export type ExactPartial<type> = {
  [key in keyof type]?: type[key] | undefined
}

export type IsNever<type> = [type] extends [never] ? true : false

export type NonNullableObj<type> = {
  [key in keyof type]: Required<NonNullable<type[key]>>
}

export type OneOf<
  union extends object,
  ///
  keys extends KeyofUnion<union> = KeyofUnion<union>,
> = union extends infer Item
  ? Compute<Item & { [K in Exclude<keys, keyof Item>]?: undefined }>
  : never
type KeyofUnion<type> = type extends type ? keyof type : never

export type OptionalKeys<type> = {
  [key in keyof type]+?: Required<NonNullable<type[key]>>
}

export type PartialBy<type, key extends keyof type> = ExactPartial<
  Pick<type, key>
> &
  StrictOmit<type, key>

export type StrictOmit<type, keys extends keyof type> = Pick<
  type,
  Exclude<keyof type, keys>
>

export type Tuple<type, size extends number> = size extends size
  ? number extends size
    ? type[]
    : _TupleOf<type, size, []>
  : never
type _TupleOf<
  length,
  size extends number,
  acc extends readonly unknown[],
> = acc["length"] extends size
  ? acc
  : _TupleOf<length, size, readonly [length, ...acc]>
