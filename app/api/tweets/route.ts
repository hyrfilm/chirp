import type { NextRequest } from "next/server";

import {
    MAX_TWEET_LENGTH,
    MIN_TWEET_LENGTH,
    createTweet,
} from "@/app/server/tweets.ts";

// Writes to the database per request, so avoid prerendering/caching
export const dynamic = "force-dynamic";

/*
 * POST /api/tweets
 * Body: { "username": "bob", "text": "hello world" }
 *
 * Creates a tweet authored by `username` and returns the created tweet (same
 * shape as a feed entry) with status 201.
 *
 * TODO: Allowing the user-id (uuid7) would be nice support as well
 */
export async function POST(request: NextRequest) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json(
            { error: "Request body must be valid JSON." },
            { status: 400 },
        );
    }

    const { username, text } = (body ?? {}) as {
        username?: unknown;
        text?: unknown;
    };

    if (typeof username !== "string" || username.trim() === "") {
        return Response.json(
            { error: "The 'username' field is required." },
            { status: 400 },
        );
    }

    if (typeof text !== "string") {
        return Response.json(
            { error: "The 'text' field is required." },
            { status: 400 },
        );
    }

    const trimmedText = text.trim();
    if (
        trimmedText.length < MIN_TWEET_LENGTH ||
        trimmedText.length > MAX_TWEET_LENGTH
    ) {
        return Response.json(
            {
                error: `The 'text' field must be between ${MIN_TWEET_LENGTH} and ${MAX_TWEET_LENGTH} characters.`,
            },
            { status: 400 },
        );
    }

    const trimmedUsername = username.trim();
    const tweet = await createTweet(trimmedUsername, trimmedText);

    if (tweet === null) {
        return Response.json(
            { error: `No user found with username '${trimmedUsername}'.` },
            { status: 404 },
        );
    }

    return Response.json(tweet, { status: 201 });
}
