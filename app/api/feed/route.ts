import type { NextRequest } from "next/server";

import { db } from "@/app/server/db/client.ts";
import {
    DEFAULT_FEED_LIMIT,
    findUserIdByUsername,
    getFeedPage,
} from "@/app/server/feed.ts";

// The handler touches the database via the pg pool, so it must run on the
// Node.js runtime and be evaluated per request rather than prerendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * GET /api/feed?username=bob&limit=30&cursor=<tweet-id>
 *
 * Returns the most recent tweets from the users `username` follows, newest
 * first, with each author's details. `cursor` (the nextCursor from a previous
 * response) loads the following page.
 */
export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;

    const username = params.get("username")?.trim();
    if (!username) {
        return Response.json(
            { error: "The 'username' query parameter is required." },
            { status: 400 },
        );
    }

    const limit = parseLimit(params.get("limit"));
    if (limit === INVALID) {
        return Response.json(
            { error: "The 'limit' query parameter must be a positive integer." },
            { status: 400 },
        );
    }

    const viewerId = await findUserIdByUsername(db, username);
    if (!viewerId) {
        return Response.json(
            { error: `No user found with username '${username}'.` },
            { status: 404 },
        );
    }

    const page = await getFeedPage(db, viewerId, {
        limit,
        cursor: params.get("cursor"),
    });

    return Response.json(page);
}

const INVALID = Symbol("invalid-limit");

/*
 * Parses the optional `limit` parameter. Absent means "use the default";
 * a non-numeric or non-positive value is a client error. getFeedPage applies
 * the upper bound, so we only reject values that are clearly malformed here.
 */
function parseLimit(raw: string | null): number | undefined | typeof INVALID {
    if (raw === null) {
        return DEFAULT_FEED_LIMIT;
    }

    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1) {
        return INVALID;
    }
    return value;
}
