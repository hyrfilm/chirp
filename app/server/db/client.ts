import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";

import { buildConnectionString } from "./connection.ts";
import type { Database } from "./types.ts";

const { Pool } = pg;

/*
 * A single Kysely instance backed by a connection pool, shared across all
 * requests. In development Next.js re-evaluates modules on each change, so we
 * cache the instance on globalThis to avoid leaking a new pool per reload.
 */
const globalForDb = globalThis as typeof globalThis & {
    __chirpDb?: Kysely<Database>;
};

export const db: Kysely<Database> =
    globalForDb.__chirpDb ??
    new Kysely<Database>({
        dialect: new PostgresDialect({
            pool: new Pool({ connectionString: buildConnectionString() }),
        }),
    });

if (process.env.NODE_ENV !== "production") {
    globalForDb.__chirpDb = db;
}
