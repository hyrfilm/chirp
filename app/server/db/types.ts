import type {
    ColumnType,
    Generated,
    Insertable,
    Selectable,
    Updateable,
} from "kysely";

/*
 * node-postgres normally represents PostgreSQL UUID values as strings.
 */
export type UUID = string;

/*
 * PostgreSQL DATE has no time zone and should remain a YYYY-MM-DD string.
 *
 * Using a JavaScript Date here could accidentally introduce local-time or
 * UTC conversion into a value that represents a calendar date.
 */
export type DateOnly = ColumnType<
    string,
    string,
    string
>;

/*
 * node-postgres returns timestamptz values as JavaScript Date objects.
 * Inserts and updates may provide either a Date or an ISO timestamp.
 */
export type Timestamp = ColumnType<
    Date,
    Date | string | undefined,
    Date | string | undefined
>;

export interface UsersTable {
    id: Generated<UUID>;

    username: string;
    email: string;
    password_hash: string;

    first_name: string;
    last_name: string;
    birth_date: DateOnly;

    created_at: Timestamp;
}

export interface TweetsTable {
    id: Generated<UUID>;
    author_id: UUID;

    text: string;
    created_at: Timestamp;
}

export interface FollowersTable {
    follower_id: UUID;
    followed_id: UUID;

    created_at: Timestamp;
}

export interface Database {
    users: UsersTable;
    tweets: TweetsTable;
    followers: FollowersTable;
}

export type UserRow = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

export type TweetRow = Selectable<TweetsTable>;
export type NewTweet = Insertable<TweetsTable>;
export type TweetUpdate = Updateable<TweetsTable>;

export type FollowerRow = Selectable<FollowersTable>;
export type NewFollower = Insertable<FollowersTable>;
