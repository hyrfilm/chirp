import { type Kysely, sql } from "kysely";

import type { Database, UUID } from "./db/types.ts";

/*
 * The default and maximum number of tweets returned per feed page. The cap
 * protects the database from a client requesting an unbounded page size.
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
 * Resolves a user by username, case-insensitively, mirroring the
 * lower(username) unique index. Returning the id lets the caller distinguish
 * a missing user (404) from a user with an empty feed (200, no tweets).
 */
export async function findUserIdByUsername(
    db: Kysely<Database>,
    username: string,
): Promise<UUID | undefined> {
    const row = await db
        .selectFrom("users")
        .select("id")
        .where(sql`lower(username)`, "=", username.toLowerCase())
        .executeTakeFirst();

    return row?.id;
}

/*
 * Returns one page of the feed for `viewerId`: the most recent tweets from
 * the users they follow, newest first, joined with each author's details.
 *
 * Ordering and pagination both ride on the uuidv7 tweet id, which is
 * chronologically sortable. `WHERE id < :cursor ORDER BY id DESC` pairs with
 * the tweets(author_id, id DESC) index and, unlike OFFSET, neither drifts nor
 * slows down as the caller pages deeper.
 */
export async function getFeedPage(
    db: Kysely<Database>,
    viewerId: UUID,
    options: { limit?: number; cursor?: string | null } = {},
): Promise<FeedPage> {
    const limit = clampLimit(options.limit);
    const cursor = normalizeCursor(options.cursor);

    let query = db
        .selectFrom("tweets as t")
        .innerJoin("users as author", "author.id", "t.author_id")
        .innerJoin("followers as f", (join) =>
            join
                .onRef("f.followed_id", "=", "t.author_id")
                .on("f.follower_id", "=", viewerId),
        )
        .select([
            "t.id as id",
            "t.text as text",
            "t.created_at as createdAt",
            "author.id as authorId",
            "author.username as authorUsername",
            "author.first_name as authorFirstName",
            "author.last_name as authorLastName",
        ])
        .orderBy("t.id", "desc")
        // Fetch one extra row to detect whether a further page exists without
        // a second count query.
        .limit(limit + 1);

    if (cursor) {
        query = query.where("t.id", "<", cursor);
    }

    const rows = await query.execute();

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const tweets: FeedTweet[] = pageRows.map((row) => ({
        id: row.id,
        text: row.text,
        createdAt: row.createdAt.toISOString(),
        author: {
            id: row.authorId,
            username: row.authorUsername,
            firstName: row.authorFirstName,
            lastName: row.authorLastName,
        },
    }));

    const nextCursor = hasMore ? (tweets.at(-1)?.id ?? null) : null;

    return { tweets, nextCursor };
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
 * The cursor is the id of the last tweet from the previous page. Anything
 * that is not a well-formed UUID is treated as absent (returns the first
 * page) rather than reaching the database as an invalid comparison.
 */
function normalizeCursor(value?: string | null): UUID | undefined {
    if (!value || !UUID_PATTERN.test(value)) {
        return undefined;
    }
    return value;
}
