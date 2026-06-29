import { sql } from "kysely";

import { db } from "./db/client.ts";
import type { UUID } from "./db/types.ts";

/*
 * The default and maximum number of tweets returned per feed page. The cap
 * protects the API from a client requesting an unbounded page size.
 */
export const DEFAULT_FEED_LIMIT = 30;
export const MAX_FEED_LIMIT = 100;

export interface FeedAuthor {
    id: UUID;
    username: string;
    firstName: string;
    lastName: string;
}

export interface FeedTweet {
    id: UUID;
    text: string;
    createdAt: string; // ISO 8601
    author: FeedAuthor;
}

export interface FeedPage {
    tweets: FeedTweet[];
    /*
     * Cursor for the next page (the id of the last tweet returned), or null
     * when the last page has been reached. Pass it back as the `cursor` query
     * parameter to load more.
     */
    nextCursor: string | null;
}

/*
 * Returns one page of `username`'s feed (newest first), or null if no such
 * user exists.
 *
 * The feed is the tweets authored by the users `username` follows. Ordering is
 * keyset pagination on the tweet id: because ids are uuidv7 (creation time is
 * encoded in the high bits), id DESC is reverse-chronological and the cursor is
 * simply the id of the last tweet from the previous page. created_at is carried
 * for display, not ordering.
 */
export async function getFeedPage(
    username: string,
    options: { limit?: number; cursor?: string | null } = {},
): Promise<FeedPage | null> {
    const viewerId = await resolveUserId(username);
    if (viewerId === null) {
        return null;
    }

    const limit = clampLimit(options.limit);
    const cursor = normalizeCursor(options.cursor);

    let query = db
        .selectFrom("tweets as t")
        .innerJoin("followers as f", (join) =>
            join
                .onRef("f.followed_id", "=", "t.author_id")
                .on("f.follower_id", "=", viewerId),
        )
        .innerJoin("users as u", "u.id", "t.author_id")
        .select([
            "t.id as id",
            "t.text as text",
            "t.created_at as createdAt",
            "u.id as authorId",
            "u.username as authorUsername",
            "u.first_name as authorFirstName",
            "u.last_name as authorLastName",
        ])
        .orderBy("t.id", "desc")
        // Fetch one extra row to detect whether a further page exists.
        .limit(limit + 1);

    if (cursor) {
        query = query.where("t.id", "<", cursor);
    }

    const rows = await query.execute();

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? (page.at(-1)?.id ?? null) : null;

    return {
        tweets: page.map((row) => ({
            id: row.id,
            text: row.text,
            createdAt: row.createdAt.toISOString(),
            author: {
                id: row.authorId,
                username: row.authorUsername,
                firstName: row.authorFirstName,
                lastName: row.authorLastName,
            },
        })),
        nextCursor,
    };
}

/*
 * Resolves a username to its user id, or null if no such user exists. Matching
 * is case-insensitive against the unique lower(username) index.
 */
async function resolveUserId(username: string): Promise<UUID | null> {
    const row = await db
        .selectFrom("users")
        .select("id")
        .where(sql<boolean>`lower(username) = ${username.toLowerCase()}`)
        .executeTakeFirst();

    return row?.id ?? null;
}

function clampLimit(limit?: number): number {
    if (limit === undefined || !Number.isFinite(limit)) {
        return DEFAULT_FEED_LIMIT;
    }
    return Math.min(Math.max(Math.trunc(limit), 1), MAX_FEED_LIMIT);
}

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/*
 * The cursor is the id of the last tweet from the previous page. Anything that
 * is not a well-formed UUID is treated as absent (returns the first page).
 */
function normalizeCursor(value?: string | null): UUID | undefined {
    if (!value || !UUID_PATTERN.test(value)) {
        return undefined;
    }
    return value;
}
