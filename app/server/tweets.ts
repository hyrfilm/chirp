import { sql } from "kysely";

import { db } from "./db/client.ts";
import type { FeedTweet } from "./feed.ts";

/*
 * A tweet's text must be between these lengths (after trimming). Mirrors the
 * tweets_text_length CHECK constraint in the schema so the API can return a
 * clean 400 rather than surfacing a database error.
 */
export const MIN_TWEET_LENGTH = 1;
export const MAX_TWEET_LENGTH = 140;

/*
 * Creates a tweet authored by `username` and returns it in the same shape the
 * feed uses, or null if no such user exists (so the caller can answer 404).
 *
 * `text` is expected to be already validated/trimmed by the caller.
 */
export async function createTweet(
    username: string,
    text: string,
): Promise<FeedTweet | null> {
    const author = await db
        .selectFrom("users")
        .select(["id", "username", "first_name", "last_name"])
        .where(sql<boolean>`lower(username) = ${username.toLowerCase()}`)
        .executeTakeFirst();

    if (!author) {
        return null;
    }

    const inserted = await db
        .insertInto("tweets")
        .values({ author_id: author.id, text })
        .returning(["id", "created_at"])
        .executeTakeFirstOrThrow();

    return {
        id: inserted.id,
        text,
        createdAt: inserted.created_at.toISOString(),
        author: {
            id: author.id,
            username: author.username,
            firstName: author.first_name,
            lastName: author.last_name,
        },
    };
}
