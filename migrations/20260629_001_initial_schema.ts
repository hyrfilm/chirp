import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable("users")
        .addColumn("id", "uuid", (column) =>
            column
                .primaryKey()
                .notNull()
                .defaultTo(sql`uuidv7()`),
        )
        .addColumn("username", "varchar(32)", (column) =>
            column.notNull(),
        )
        .addColumn("email", "varchar(320)", (column) =>
            column.notNull(),
        )
        .addColumn("password_hash", "text", (column) =>
            column.notNull(),
        )
        .addColumn("first_name", "varchar(100)", (column) =>
            column.notNull(),
        )
        .addColumn("last_name", "varchar(100)", (column) =>
            column.notNull(),
        )
        /*
         * Store the date from which age is derived rather than an age
         * that becomes stale as time passes.
         */
        .addColumn("birth_date", "date", (column) =>
            column.notNull(),
        )
        .addColumn("created_at", "timestamptz", (column) =>
            column
                .notNull()
                .defaultTo(sql`CURRENT_TIMESTAMP`),
        )
        .addCheckConstraint(
            "users_username_not_blank",
            sql`char_length(btrim(username)) > 0`,
        )
        .addCheckConstraint(
            "users_username_no_surrounding_whitespace",
            sql`username = btrim(username)`,
        )
        .addCheckConstraint(
            "users_email_not_blank",
            sql`char_length(btrim(email)) > 0`,
        )
        .addCheckConstraint(
            "users_email_no_surrounding_whitespace",
            sql`email = btrim(email)`,
        )
        .execute();

    /*
     * Case-insensitive uniqueness without requiring the citext extension.
     *
     * Application queries that resolve a user by username should likewise
     * compare lower(username) with a normalized input value.
     */
    await sql`
        CREATE UNIQUE INDEX users_username_lower_uq
        ON users (lower(username))
    `.execute(db);

    await sql`
        CREATE UNIQUE INDEX users_email_lower_uq
        ON users (lower(email))
    `.execute(db);

    await db.schema
        .createTable("tweets")
        .addColumn("id", "uuid", (column) =>
            column
                .primaryKey()
                .notNull()
                .defaultTo(sql`uuidv7()`),
        )
        .addColumn("author_id", "uuid", (column) =>
            column
                .notNull()
                .references("users.id")
                .onDelete("cascade"),
        )
        .addColumn("text", "text", (column) =>
            column.notNull(),
        )
        .addColumn("created_at", "timestamptz", (column) =>
            column
                .notNull()
                .defaultTo(sql`CURRENT_TIMESTAMP`),
        )
        .addCheckConstraint(
            "tweets_text_length",
            sql`char_length(btrim(text)) BETWEEN 1 AND 140`,
        )
        .execute();

    /*
     * Supports looking up tweets belonging to followed authors in reverse
     * chronological order.
     *
     * Because ids are uuidv7 (the creation timestamp is encoded in the high
     * bits), id ordering is chronological ordering: "newest first" is simply
     * id DESC, and keyset pagination needs only the last id. created_at is
     * kept for display, not ordering.
     */
    await sql`
        CREATE INDEX tweets_author_id_idx
        ON tweets (author_id, id DESC)
    `.execute(db);

    await db.schema
        .createTable("followers")
        .addColumn("follower_id", "uuid", (column) =>
            column
                .notNull()
                .references("users.id")
                .onDelete("cascade"),
        )
        .addColumn("followed_id", "uuid", (column) =>
            column
                .notNull()
                .references("users.id")
                .onDelete("cascade"),
        )
        .addColumn("created_at", "timestamptz", (column) =>
            column
                .notNull()
                .defaultTo(sql`CURRENT_TIMESTAMP`),
        )
        /*
         * Prevents duplicate follow relationships and provides an index
         * beginning with follower_id for Bob's followed-user lookup.
         */
        .addPrimaryKeyConstraint(
            "followers_pkey",
            ["follower_id", "followed_id"],
        )
        .addCheckConstraint(
            "followers_no_self_follow",
            sql`follower_id <> followed_id`,
        )
        .execute();

    /*
     * The primary key supports "who does Bob follow?"
     * This reverse index supports "who follows Alice?"
     */
    await db.schema
        .createIndex("followers_followed_id_idx")
        .on("followers")
        .column("followed_id")
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .dropTable("followers")
        .ifExists()
        .execute();

    await db.schema
        .dropTable("tweets")
        .ifExists()
        .execute();

    await db.schema
        .dropTable("users")
        .ifExists()
        .execute();
}
