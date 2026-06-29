import { faker } from "@faker-js/faker";

import type { NewFollower, NewTweet, NewUser } from "../app/server/db/types.ts";

export interface SeedOptions {
    seed?: number;
    referenceDate?: Date | string;
    generatedUserCount?: number;
    minTweetsPerUser?: number;
    maxTweetsPerUser?: number;
    followsPerUser?: number;
    uuidv7PoolSize?: number;
}

export interface SeedUser extends NewUser {
    username: string;
}

export interface SeedTweet
    extends Omit<NewTweet, "author_id" | "created_at"> {
    authorUsername: string;
    created_at: string;
}

export interface SeedFollower
    extends Omit<NewFollower, "follower_id" | "followed_id" | "created_at"> {
    followerUsername: string;
    followedUsername: string;
    created_at: string;
}

export interface SeedData {
    seed: number;
    referenceDate: string;
    users: SeedUser[];
    tweets: SeedTweet[];
    follows: SeedFollower[];
    uuidv7Pool: {
        status: "reserved";
        defaultSize: number;
        note: string;
    };
}

export const DEFAULT_SEED_OPTIONS = {
    seed: 12345,
    referenceDate: "2026-06-29T12:00:00.000Z",
    generatedUserCount: 40,
    minTweetsPerUser: 3,
    maxTweetsPerUser: 8,
    followsPerUser: 8,
    uuidv7PoolSize: 100_000,
} as const;

const PASSWORD_HASH =
    "$argon2id$v=19$m=19456,t=2,p=1$assignment-seed$not-a-real-password-hash";

const HOUR_MS = 60 * 60 * 1000;

const ANCHOR_USERS = [
    ["alice", "Alice", "Anderson", "1994-04-12"],
    ["bob", "Bob", "Berg", "1989-09-03"],
    ["ada", "Ada", "Lovelace", "1815-12-10"],
    ["grace", "Grace", "Hopper", "1906-12-09"],
    ["alan", "Alan", "Turing", "1912-06-23"],
    ["linus", "Linus", "Torvalds", "1969-12-28"],
] as const;

export function buildSeedData(options: SeedOptions = {}): SeedData {
    const resolved = resolveOptions(options);
    const referenceDate = new Date(resolved.referenceDate);

    faker.seed(resolved.seed);
    faker.setDefaultRefDate(referenceDate);

    const users = [
        ...buildAnchorUsers(referenceDate),
        ...buildGeneratedUsers(resolved.generatedUserCount, referenceDate),
    ];

    return {
        seed: resolved.seed,
        referenceDate: referenceDate.toISOString(),
        users,
        follows: buildFollows(users, resolved.followsPerUser, referenceDate),
        tweets: buildTweets(users, resolved, referenceDate),
        uuidv7Pool: {
            status: "reserved",
            defaultSize: resolved.uuidv7PoolSize,
            note:
                "Reserved extension: generate a large server-side pool of Postgres uuidv7 values and consume it when deterministic UUIDs become useful.",
        },
    };
}

function resolveOptions(options: SeedOptions): Required<SeedOptions> {
    const minTweetsPerUser =
        options.minTweetsPerUser ?? DEFAULT_SEED_OPTIONS.minTweetsPerUser;

    const maxTweetsPerUser = Math.max(
        minTweetsPerUser,
        options.maxTweetsPerUser ?? DEFAULT_SEED_OPTIONS.maxTweetsPerUser,
    );

    return {
        seed: options.seed ?? DEFAULT_SEED_OPTIONS.seed,
        referenceDate:
            options.referenceDate ?? DEFAULT_SEED_OPTIONS.referenceDate,
        generatedUserCount: Math.max(
            0,
            Math.trunc(
                options.generatedUserCount ??
                    DEFAULT_SEED_OPTIONS.generatedUserCount,
            ),
        ),
        minTweetsPerUser: Math.max(0, Math.trunc(minTweetsPerUser)),
        maxTweetsPerUser: Math.max(0, Math.trunc(maxTweetsPerUser)),
        followsPerUser: Math.max(
            0,
            Math.trunc(
                options.followsPerUser ??
                    DEFAULT_SEED_OPTIONS.followsPerUser,
            ),
        ),
        uuidv7PoolSize: Math.max(
            0,
            Math.trunc(
                options.uuidv7PoolSize ??
                    DEFAULT_SEED_OPTIONS.uuidv7PoolSize,
            ),
        ),
    };
}

function buildAnchorUsers(referenceDate: Date): SeedUser[] {
    return ANCHOR_USERS.map(
        ([username, firstName, lastName, birthDate], index) => ({
            username,
            email: `${username}@example.fakerjs.dev`,
            password_hash: PASSWORD_HASH,
            first_name: firstName,
            last_name: lastName,
            birth_date: birthDate,
            created_at: hoursBefore(referenceDate, 10_000 - index),
        }),
    );
}

function buildGeneratedUsers(
    count: number,
    referenceDate: Date,
): SeedUser[] {
    return Array.from({ length: count }, (_, index) => {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();
        const username = buildUsername(firstName, lastName, index);

        return {
            username,
            email: `user-${index}@example.fakerjs.dev`,
            password_hash: PASSWORD_HASH,
            first_name: firstName.slice(0, 100),
            last_name: lastName.slice(0, 100),
            birth_date: faker.date
                .birthdate({ min: 18, max: 80, mode: "age" })
                .toISOString()
                .slice(0, 10),
            created_at: hoursBefore(referenceDate, 9_000 - index),
        };
    });
}

function buildUsername(
    firstName: string,
    lastName: string,
    index: number,
): string {
    const suffix = `_${index}`;
    const base =
        faker.internet
            .username({ firstName, lastName })
            .toLowerCase()
            .replace(/[^a-z0-9_]+/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_+|_+$/g, "") || "user";

    return `${base.slice(0, 32 - suffix.length)}${suffix}`;
}

function buildFollows(
    users: SeedUser[],
    followsPerUser: number,
    referenceDate: Date,
): SeedFollower[] {
    const follows: SeedFollower[] = [];
    const seen = new Set<string>();
    const usernames = users.map((user) => user.username);

    const addFollow = (
        followerUsername: string,
        followedUsername: string,
    ): void => {
        if (followerUsername === followedUsername) {
            return;
        }

        const key = `${followerUsername}:${followedUsername}`;
        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        follows.push({
            followerUsername,
            followedUsername,
            created_at: hoursBefore(referenceDate, 6_000 - follows.length),
        });
    };

    for (const followedUsername of ["alice", "ada", "grace", "alan", "linus"]) {
        addFollow("bob", followedUsername);
    }

    for (let followerIndex = 0; followerIndex < usernames.length; followerIndex++) {
        const followerUsername = usernames[followerIndex];

        for (let offset = 1; offset <= followsPerUser; offset++) {
            const followedUsername =
                usernames[(followerIndex + offset) % usernames.length];
            addFollow(followerUsername, followedUsername);
        }
    }

    return follows;
}

function buildTweets(
    users: SeedUser[],
    options: Required<SeedOptions>,
    referenceDate: Date,
): SeedTweet[] {
    const tweets: SeedTweet[] = [];

    for (const user of users) {
        const tweetCount = faker.number.int({
            min: options.minTweetsPerUser,
            max: options.maxTweetsPerUser,
        });

        for (let index = 0; index < tweetCount; index++) {
            tweets.push({
                authorUsername: user.username,
                text: buildTweetText(),
                created_at: hoursBefore(referenceDate, 3_000 - tweets.length),
            });
        }
    }

    return tweets.sort((left, right) =>
        left.created_at.localeCompare(right.created_at),
    );
}

function buildTweetText(): string {
    const sentence = faker.lorem
        .sentence({ min: 3, max: 18 })
        .replace(/\s+/g, " ")
        .trim();

    return sentence.length <= 140
        ? sentence
        : sentence.slice(0, 140).trimEnd();
}

function hoursBefore(referenceDate: Date, hours: number): string {
    return new Date(referenceDate.getTime() - hours * HOUR_MS).toISOString();
}
