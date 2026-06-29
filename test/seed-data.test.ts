import { describe, expect, it } from "vitest";

import {
    DEFAULT_SEED_OPTIONS,
    buildSeedData,
} from "../scripts/seed-data";

describe("buildSeedData", () => {
    it("returns identical data for the same faker seed", () => {
        const options = {
            seed: 42,
            generatedUserCount: 6,
            minTweetsPerUser: 2,
            maxTweetsPerUser: 4,
            followsPerUser: 3,
        };

        const first = buildSeedData(options);
        const second = buildSeedData(options);

        expect(first).toEqual(second);
        expect(buildSeedData({ ...options, seed: 43 })).not.toEqual(first);
    });

    it("includes anchor users and a stable Bob follow graph", () => {
        const data = buildSeedData({
            generatedUserCount: 3,
            followsPerUser: 4,
        });

        expect(data.users.map((user) => user.username).slice(0, 6)).toEqual([
            "alice",
            "bob",
            "ada",
            "grace",
            "alan",
            "linus",
        ]);

        const bobFollows = data.follows
            .filter((follow) => follow.followerUsername === "bob")
            .map((follow) => follow.followedUsername);

        expect(bobFollows).toEqual([
            "alice",
            "ada",
            "grace",
            "alan",
            "linus",
        ]);
    });

    it("builds rows that satisfy the current schema constraints", () => {
        const data = buildSeedData({
            generatedUserCount: 8,
            minTweetsPerUser: 2,
            maxTweetsPerUser: 3,
            followsPerUser: 4,
        });

        const usernames = new Set(data.users.map((user) => user.username));
        expect(usernames.size).toBe(data.users.length);

        for (const user of data.users) {
            expect("id" in user).toBe(false);
            expect(user.username).toBe(user.username.trim());
            expect(user.username.length).toBeGreaterThan(0);
            expect(user.username.length).toBeLessThanOrEqual(32);
            expect(user.email).toBe(user.email.trim());
            expect(user.email.length).toBeGreaterThan(0);
            expect(user.email.length).toBeLessThanOrEqual(320);
            expect(user.password_hash.length).toBeGreaterThan(0);
            expect(user.first_name.length).toBeGreaterThan(0);
            expect(user.first_name.length).toBeLessThanOrEqual(100);
            expect(user.last_name.length).toBeGreaterThan(0);
            expect(user.last_name.length).toBeLessThanOrEqual(100);
            expect(user.birth_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }

        const followKeys = new Set<string>();
        for (const follow of data.follows) {
            expect(follow.followerUsername).not.toBe(
                follow.followedUsername,
            );
            expect(usernames.has(follow.followerUsername)).toBe(true);
            expect(usernames.has(follow.followedUsername)).toBe(true);

            const key = `${follow.followerUsername}:${follow.followedUsername}`;
            expect(followKeys.has(key)).toBe(false);
            followKeys.add(key);
        }

        for (const tweet of data.tweets) {
            expect("id" in tweet).toBe(false);
            expect(usernames.has(tweet.authorUsername)).toBe(true);
            expect(tweet.text).toBe(tweet.text.trim());
            expect(tweet.text.length).toBeGreaterThan(0);
            expect(tweet.text.length).toBeLessThanOrEqual(140);
        }

        expect(data.tweets).toEqual(
            [...data.tweets].sort((left, right) =>
                left.created_at.localeCompare(right.created_at),
            ),
        );
    });

    it("documents the reserved Postgres uuidv7 pool extension", () => {
        const data = buildSeedData();

        expect(data.uuidv7Pool).toEqual({
            status: "reserved",
            defaultSize: DEFAULT_SEED_OPTIONS.uuidv7PoolSize,
            note: expect.stringContaining("Postgres uuidv7"),
        });
    });
});
