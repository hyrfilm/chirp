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
 * Dummy data source.
 *
 * This stands in for the database while seeding is handled separately. The
 * shape, ordering, and pagination semantics match what the real query will
 * produce, so the route handler and its skivvy tests stay unchanged when the
 * data layer is swapped in:
 *
 *   - tweet ids are uuidv7-shaped and lexicographically sortable, so newest
 *     first is simply id DESC, and the cursor is just the last id;
 *   - a feed only ever contains tweets from authors the viewer follows.
 */

const DUMMY_AUTHORS: FeedAuthor[] = [
    {
        id: authorId(1),
        username: "ada",
        firstName: "Ada",
        lastName: "Lovelace",
    },
    {
        id: authorId(2),
        username: "grace",
        firstName: "Grace",
        lastName: "Hopper",
    },
    {
        id: authorId(3),
        username: "alan",
        firstName: "Alan",
        lastName: "Turing",
    },
    {
        id: authorId(4),
        username: "linus",
        firstName: "Linus",
        lastName: "Torvalds",
    },
];

const DUMMY_TWEET_TEXTS = [
    "Just shipped a tiny refactor and somehow feel unstoppable.",
    "Reminder: the bug is almost always in the code you were sure was fine.",
    "Coffee count today: yes.",
    "Naming things remains the hardest problem in computer science.",
    "Wrote a test before the code. Who even am I anymore.",
    "Deleted 200 lines and the feature works better now.",
    "The feed is keyset-paginated and I am at peace.",
    "uuidv7 means my ids sort themselves. Living in the future.",
    "Rubber-duck debugging works terrifyingly well.",
    "Today's lesson: read the docs before guessing the API.",
    "Merged on a Friday. Pray for me.",
    "Small commits, big dreams.",
];

// 36 tweets → exercises a full default page (30) plus a partial second page.
const TWEET_COUNT = 36;
const FEED_REFERENCE_TIME = Date.parse("2026-06-29T12:00:00.000Z");
const ONE_HOUR_MS = 60 * 60 * 1000;

const BOB_FEED: FeedTweet[] = buildBobFeed();

/*
 * Maps a username to the tweets that make up that user's feed. "bob" follows
 * everyone in DUMMY_AUTHORS; "alice" follows nobody (an empty feed, useful for
 * exercising the empty-state UX). Unknown usernames are absent → 404.
 */
const FEEDS_BY_USERNAME = new Map<string, FeedTweet[]>([
    ["bob", BOB_FEED],
    ["alice", []],
]);

/*
 * Returns one page of `username`'s feed (newest first), or null if no such
 * user exists. Pagination is keyset-based on the tweet id: `cursor` is the id
 * of the last tweet from the previous page.
 */
export function getFeedPage(
    username: string,
    options: { limit?: number; cursor?: string | null } = {},
): FeedPage | null {
    const feed = FEEDS_BY_USERNAME.get(username.toLowerCase());
    if (!feed) {
        return null;
    }

    const limit = clampLimit(options.limit);
    const cursor = normalizeCursor(options.cursor);

    const start = cursor
        ? feed.findIndex((tweet) => tweet.id < cursor) // feed is sorted id DESC
        : 0;

    // An unmatched cursor (start === -1) yields an empty final page.
    const window = start === -1 ? [] : feed.slice(start, start + limit + 1);

    const hasMore = window.length > limit;
    const tweets = hasMore ? window.slice(0, limit) : window;
    const nextCursor = hasMore ? (tweets.at(-1)?.id ?? null) : null;

    return { tweets, nextCursor };
}

function buildBobFeed(): FeedTweet[] {
    const tweets: FeedTweet[] = [];

    for (let index = 1; index <= TWEET_COUNT; index++) {
        // Older tweets get smaller ids and earlier timestamps, so id order and
        // chronological order agree.
        const ageInHours = TWEET_COUNT - index;
        tweets.push({
            id: tweetId(index),
            text: DUMMY_TWEET_TEXTS[(index - 1) % DUMMY_TWEET_TEXTS.length],
            createdAt: new Date(
                FEED_REFERENCE_TIME - ageInHours * ONE_HOUR_MS,
            ).toISOString(),
            author: DUMMY_AUTHORS[(index - 1) % DUMMY_AUTHORS.length],
        });
    }

    // Newest first, matching the real query's ORDER BY id DESC.
    return tweets.sort((a, b) => (a.id < b.id ? 1 : -1));
}

/*
 * Builds a uuidv7-shaped, lexicographically sortable id from a counter: a
 * larger counter yields a larger id. Real ids will be genuine uuidv7 values;
 * these only need the same sortability and a valid UUID shape.
 */
function tweetId(counter: number): UUID {
    const suffix = counter.toString(16).padStart(12, "0");
    return `00000000-0000-7000-8000-${suffix}`;
}

function authorId(counter: number): UUID {
    const suffix = counter.toString(16).padStart(12, "0");
    return `00000000-0000-7000-9000-${suffix}`;
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
