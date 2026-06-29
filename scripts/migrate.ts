import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Kysely, PostgresDialect } from "kysely";
import {
    FileMigrationProvider,
    Migrator,
    NO_MIGRATIONS,
    type MigrationResultSet,
} from "kysely/migration";
import pg from "pg";

import { buildConnectionString } from "../app/server/db/connection.ts";
import { loadDotEnv } from "./load-env.ts";

const { Pool } = pg;

loadDotEnv();

const rootDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);

function printResults(resultSet: MigrationResultSet): void {
    if (!resultSet.results?.length) {
        console.log("No migrations to run.");
        return;
    }

    for (const result of resultSet.results ?? []) {
        console.log(`${result.status}: ${result.migrationName}`);
    }
}

async function run(): Promise<void> {
    const command = process.argv[2] ?? "latest";
    const pool = new Pool({
        connectionString: buildConnectionString(),
    });

    const db = new Kysely<unknown>({
        dialect: new PostgresDialect({ pool }),
    });

    try {
        const migrator = new Migrator({
            db,
            provider: new FileMigrationProvider({
                fs,
                path,
                migrationFolder: path.join(rootDirectory, "migrations"),
            }),
        });

        const resultSet =
            command === "latest" || command === "up"
                ? command === "latest"
                    ? await migrator.migrateToLatest()
                    : await migrator.migrateUp()
                : command === "down"
                  ? await migrator.migrateDown()
                  : command === "reset"
                    ? await migrator.migrateTo(NO_MIGRATIONS)
                    : undefined;

        if (!resultSet) {
            throw new Error(
                `Unknown migration command "${command}". Use latest, up, down, or reset.`,
            );
        }

        printResults(resultSet);

        if (resultSet.error) {
            throw resultSet.error;
        }
    } finally {
        await db.destroy();
    }
}

run().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
});
