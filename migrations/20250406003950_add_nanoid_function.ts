import { type Kysely, sql } from "kysely"
import * as z from "zod/mini"
import * as Nanoid from "../shared/nanoid.ts"

export async function up(db: Kysely<unknown>): Promise<void> {
  // adapted from `nanoid-postgres`
  // https://github.com/viascom/nanoid-postgres/tree/2.1.0

  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`.execute(db)

  const { mask, step } = await sql`
    WITH 
      input as (SELECT ${sql.raw(`'${Nanoid.alphabet}'`)} as alphabet),
      bytesFactor as (
        SELECT 
          alphabet,
          round(1 + abs((((2 << cast(floor(log(length(alphabet) - 1) / log(2)) as int)) - 1) - length(alphabet)::numeric) / length(alphabet)), 2) as additionalBytes
        FROM input
      ),
      alphabet_data as (
        SELECT 
          alphabet,
          additionalBytes,
          array_length(regexp_split_to_array(alphabet, ''), 1) as alphabetLength
        FROM bytesFactor
      ),
      maskRes as (
        SELECT
          additionalBytes,
          alphabetLength,
          (2 << cast(floor(log(alphabetLength - 1) / log(2)) as int)) - 1 as mask
        FROM alphabet_data
      )
    SELECT 
      mask,
      cast(ceil(additionalBytes * mask * ${Nanoid.defaultSize} / alphabetLength) AS int) as step
    FROM maskRes;
  `
    .execute(db)
    .then((res) =>
      z.parse(z.object({ mask: z.number(), step: z.number() }), res.rows.at(0)),
    )

  await sql`
  CREATE OR REPLACE FUNCTION nanoid_optimized(size int, alphabet text, mask int, step int)
  RETURNS text LANGUAGE plpgsql VOLATILE PARALLEL SAFE AS $$
  DECLARE
    idBuilder      text := '';
    counter        int  := 0;
    bytes          bytea;
    alphabetIndex  int;
    alphabetArray  text[];
    alphabetLength int  := 64;
  BEGIN
    alphabetArray := regexp_split_to_array(alphabet, '');
    alphabetLength := array_length(alphabetArray, 1);

    LOOP
      bytes := gen_random_bytes(step);
      FOR counter IN 0..step - 1
        LOOP
          alphabetIndex := (get_byte(bytes, counter) & mask) + 1;
          IF alphabetIndex <= alphabetLength THEN
            idBuilder := idBuilder || alphabetArray[alphabetIndex];
            IF length(idBuilder) = size THEN
              RETURN idBuilder;
            END IF;
          END IF;
        END LOOP;
    END LOOP;
  END
  $$;
  `.execute(db)

  await sql`
  CREATE OR REPLACE FUNCTION nanoid(size int DEFAULT ${sql.raw(Nanoid.defaultSize.toString())})
  RETURNS text LANGUAGE plpgsql VOLATILE PARALLEL SAFE AS $$
  BEGIN
    RETURN nanoid_optimized(size, ${sql.raw(`'${Nanoid.alphabet}'`)}, ${sql.raw(mask.toString())}, ${sql.raw(step.toString())});
  END
  $$;
  `.execute(db)
}

export async function down(_db: Kysely<unknown>): Promise<void> {}
