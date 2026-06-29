import type { FeedPage, FeedTweet } from "@/app/server/feed.ts";

export type FeedApiPage = FeedPage;

type PendingRequest =
    | {
          kind: "initial";
          requestId: number;
          username: string;
      }
    | {
          kind: "next";
          requestId: number;
          username: string;
          cursor: string;
      };

export interface FeedState {
    username: string;
    tweets: FeedTweet[];
    nextCursor: string | null;
    pending: PendingRequest | null;
    error: string | null;
    requestId: number;
}

export type FeedUiEvent =
    | { type: "viewer.changed"; username: string }
    | { type: "feed.refresh.clicked" }
    | { type: "feed.loadMore.clicked" };

export type FeedDataEvent =
    | {
          type: "feed.page.loaded";
          requestId: number;
          page: FeedApiPage;
      }
    | {
          type: "feed.page.failed";
          requestId: number;
          message: string;
      };

export type FeedEvent = FeedUiEvent | FeedDataEvent;

export interface ActionModel<E extends FeedUiEvent = FeedUiEvent> {
    label: string;
    disabled: boolean;
    event: E;
}

export interface FeedTweetCardModel {
    id: string;
    authorName: string;
    authorUsername: string;
    text: string;
    timestamp: string;
}

export interface FeedScreenModel {
    viewer: {
        username: string;
        displayName: string;
    };
    title: string;
    subtitle: string;
    actions: {
        refresh: ActionModel<ReturnType<typeof feedUiEvents.refreshClicked>>;
        loadMore: ActionModel<ReturnType<typeof feedUiEvents.loadMoreClicked>>;
    };
    status:
        | {
              kind: "loading";
              message: string;
          }
        | {
              kind: "empty";
              message: string;
          }
        | {
              kind: "error";
              message: string;
              canRetry: boolean;
          }
        | {
              kind: "ready";
              tweets: FeedTweetCardModel[];
              isLoadingMore: boolean;
              canLoadMore: boolean;
          };
}

export const feedUiEvents = {
    viewerChanged: (username: string): FeedUiEvent => ({
        type: "viewer.changed",
        username,
    }),
    refreshClicked: () => ({
        type: "feed.refresh.clicked" as const,
    }),
    loadMoreClicked: () => ({
        type: "feed.loadMore.clicked" as const,
    }),
};

export const feedDataEvents = {
    pageLoaded: (requestId: number, page: FeedApiPage): FeedDataEvent => ({
        type: "feed.page.loaded",
        requestId,
        page,
    }),
    pageFailed: (requestId: number, message: string): FeedDataEvent => ({
        type: "feed.page.failed",
        requestId,
        message,
    }),
};

export function createFeedState(username = "bob"): FeedState {
    return startInitialLoad({
        username: normalizeUsername(username),
        tweets: [],
        nextCursor: null,
        pending: null,
        error: null,
        requestId: 0,
    });
}

export function reduceFeedState(
    state: FeedState,
    event: FeedEvent,
): FeedState {
    switch (event.type) {
        case "viewer.changed":
            return startInitialLoad({
                ...state,
                username: normalizeUsername(event.username),
                tweets: [],
                nextCursor: null,
                error: null,
                pending: null,
            });

        case "feed.refresh.clicked":
            return startInitialLoad({
                ...state,
                tweets: [],
                nextCursor: null,
                error: null,
                pending: null,
            });

        case "feed.loadMore.clicked":
            if (state.pending || !state.nextCursor) {
                return state;
            }

            return {
                ...state,
                pending: {
                    kind: "next",
                    requestId: state.requestId + 1,
                    username: state.username,
                    cursor: state.nextCursor,
                },
                requestId: state.requestId + 1,
                error: null,
            };

        case "feed.page.loaded":
            if (state.pending?.requestId !== event.requestId) {
                return state;
            }

            return {
                ...state,
                tweets:
                    state.pending.kind === "next"
                        ? [...state.tweets, ...event.page.tweets]
                        : event.page.tweets,
                nextCursor: event.page.nextCursor,
                pending: null,
                error: null,
            };

        case "feed.page.failed":
            if (state.pending?.requestId !== event.requestId) {
                return state;
            }

            return {
                ...state,
                pending: null,
                error: event.message,
            };
    }
}

export function toFeedScreenModel(state: FeedState): FeedScreenModel {
    const tweets = state.tweets.map(toTweetCardModel);
    const isLoadingInitial =
        state.pending?.kind === "initial" && state.tweets.length === 0;
    const isLoadingMore = state.pending?.kind === "next";
    const canLoadMore = Boolean(state.nextCursor) && !state.pending;

    return {
        viewer: {
            username: state.username,
            displayName: displayNameFromUsername(state.username),
        },
        title: `${displayNameFromUsername(state.username)}'s feed`,
        subtitle: "Newest posts from followed users, ordered by uuidv7 cursor.",
        actions: {
            refresh: {
                label: "Refresh",
                disabled: Boolean(state.pending),
                event: feedUiEvents.refreshClicked(),
            },
            loadMore: {
                label: isLoadingMore ? "Loading..." : "Load more",
                disabled: !canLoadMore,
                event: feedUiEvents.loadMoreClicked(),
            },
        },
        status: toStatusModel({
            username: state.username,
            tweets,
            error: state.error,
            isLoadingInitial,
            isLoadingMore,
            canLoadMore,
        }),
    };
}

function startInitialLoad(state: FeedState): FeedState {
    const requestId = state.requestId + 1;

    return {
        ...state,
        requestId,
        pending: {
            kind: "initial",
            requestId,
            username: state.username,
        },
    };
}

function toStatusModel(input: {
    username: string;
    tweets: FeedTweetCardModel[];
    error: string | null;
    isLoadingInitial: boolean;
    isLoadingMore: boolean;
    canLoadMore: boolean;
}): FeedScreenModel["status"] {
    if (input.isLoadingInitial) {
        return {
            kind: "loading",
            message: `Loading feed for @${input.username}.`,
        };
    }

    if (input.error && input.tweets.length === 0) {
        return {
            kind: "error",
            message: input.error,
            canRetry: true,
        };
    }

    if (input.tweets.length === 0) {
        return {
            kind: "empty",
            message: `@${input.username} has no feed items.`,
        };
    }

    return {
        kind: "ready",
        tweets: input.tweets,
        isLoadingMore: input.isLoadingMore,
        canLoadMore: input.canLoadMore,
    };
}

function toTweetCardModel(tweet: FeedTweet): FeedTweetCardModel {
    return {
        id: tweet.id,
        authorName: `${tweet.author.firstName} ${tweet.author.lastName}`,
        authorUsername: tweet.author.username,
        text: tweet.text,
        timestamp: formatTimestamp(tweet.createdAt),
    };
}

function normalizeUsername(username: string): string {
    return username.trim().toLowerCase() || "bob";
}

function displayNameFromUsername(username: string): string {
    return username.charAt(0).toUpperCase() + username.slice(1);
}

function formatTimestamp(value: string): string {
    return new Intl.DateTimeFormat("en", {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(new Date(value));
}
