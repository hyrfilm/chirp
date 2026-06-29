/*
 * Builds the PostgreSQL connection string from the environment.
 *
 * Shared by the long-lived application pool (see client.ts) and the
 * one-shot migration/seed scripts so connection details are defined once.
 *
 * Credentials come from the environment (see .env / docker-compose.yml) and
 * are not duplicated here — there should be a single source of truth. Only
 * host and port, which describe where the database lives rather than how to
 * authenticate, fall back to local-development defaults.
 *
 * A single DATABASE_URL, when present, takes precedence over the discrete
 * POSTGRES_* variables.
 */
export function buildConnectionString(): string {
    if (process.env.DATABASE_URL) {
        return process.env.DATABASE_URL;
    }

    const user = required("POSTGRES_USER");
    const password = required("POSTGRES_PASSWORD");
    const database = required("POSTGRES_DB");
    const host = process.env.POSTGRES_HOST ?? "localhost";
    const port = process.env.POSTGRES_PORT ?? "5432";

    return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(
            `Missing required environment variable ${name}. ` +
                `Set DATABASE_URL or the POSTGRES_* variables (see .env).`,
        );
    }
    return value;
}
