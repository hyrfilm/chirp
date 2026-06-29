import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Loads the repo-root .env into process.env for standalone scripts.
 *
 * Next.js loads .env automatically for the app, but `node scripts/*.ts`
 * does not, so the migration and seed scripts call this first. Existing
 * environment variables (e.g. an exported DATABASE_URL) take precedence and
 * are not overwritten — matching Next's own behaviour.
 */
export function loadDotEnv(): void {
    const envPath = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
        ".env",
    );

    try {
        process.loadEnvFile(envPath);
    } catch {
        // No .env file present — rely on the ambient environment instead.
    }
}
