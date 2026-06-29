import { describe, expect, it } from "vitest";

import {
    createFeedState,
    feedDataEvents,
    feedUiEvents,
    reduceFeedState,
    toFeedScreenModel,
    type FeedApiPage,
} from "../app/feed/feed-model";

const firstPage: FeedApiPage = {
    nextCursor: "00000000-0000-7000-8000-000000000002",
    tweets: [
        {
            id: "00000000-0000-7000-8000-000000000003",
            text: "Newest post",
            createdAt: "2026-06-29T12:00:00.000Z",
            author: {
                id: "00000000-0000-7000-9000-000000000001",
                username: "ada",
                firstName: "Ada",
                lastName: "Lovelace",
            },
        },
    ],
};

const secondPage: FeedApiPage = {
    nextCursor: null,
    tweets: [
        {
            id: "00000000-0000-7000-8000-000000000002",
            text: "Older post",
            createdAt: "2026-06-29T11:00:00.000Z",
            author: {
                id: "00000000-0000-7000-9000-000000000002",
                username: "grace",
                firstName: "Grace",
                lastName: "Hopper",
            },
        },
    ],
};

describe("feed client model", () => {
    it("starts with an initial load request for the selected viewer", () => {
        const state = createFeedState("bob");
        const model = toFeedScreenModel(state);

        expect(state.pending).toEqual({
            kind: "initial",
            requestId: 1,
            username: "bob",
        });
        expect(model.status).toEqual({
            kind: "loading",
            message: "Loading feed for @bob.",
        });
        expect(model.actions.refresh.event).toEqual(
            feedUiEvents.refreshClicked(),
        );
    });

    it("turns a loaded page into render-ready baby food", () => {
        const loaded = reduceFeedState(
            createFeedState("bob"),
            feedDataEvents.pageLoaded(1, firstPage),
        );

        expect(toFeedScreenModel(loaded).status).toEqual({
            kind: "ready",
            tweets: [
                {
                    id: "00000000-0000-7000-8000-000000000003",
                    authorName: "Ada Lovelace",
                    authorUsername: "ada",
                    text: "Newest post",
                    timestamp: "Jun 29, 2026, 12:00",
                },
            ],
            isLoadingMore: false,
            canLoadMore: true,
        });
    });

    it("preserves existing tweets while loading the next page", () => {
        const loaded = reduceFeedState(
            createFeedState("bob"),
            feedDataEvents.pageLoaded(1, firstPage),
        );

        const loadingMore = reduceFeedState(
            loaded,
            feedUiEvents.loadMoreClicked(),
        );
        const appended = reduceFeedState(
            loadingMore,
            feedDataEvents.pageLoaded(2, secondPage),
        );

        expect(loadingMore.pending).toEqual({
            kind: "next",
            cursor: firstPage.nextCursor,
            requestId: 2,
            username: "bob",
        });
        expect(toFeedScreenModel(loadingMore).status).toMatchObject({
            kind: "ready",
            isLoadingMore: true,
            canLoadMore: false,
        });
        expect(toFeedScreenModel(appended).status).toMatchObject({
            kind: "ready",
            isLoadingMore: false,
            canLoadMore: false,
            tweets: expect.arrayContaining([
                expect.objectContaining({ text: "Newest post" }),
                expect.objectContaining({ text: "Older post" }),
            ]),
        });
    });

    it("ignores stale page responses by request id", () => {
        const aliceLoading = reduceFeedState(
            createFeedState("bob"),
            feedUiEvents.viewerChanged("alice"),
        );
        const staleBobResponse = reduceFeedState(
            aliceLoading,
            feedDataEvents.pageLoaded(1, firstPage),
        );

        expect(staleBobResponse).toEqual(aliceLoading);
        expect(staleBobResponse.username).toBe("alice");
    });

    it("represents empty and failed initial states explicitly", () => {
        const empty = reduceFeedState(
            createFeedState("alice"),
            feedDataEvents.pageLoaded(1, {
                tweets: [],
                nextCursor: null,
            }),
        );
        const failed = reduceFeedState(
            createFeedState("ghost"),
            feedDataEvents.pageFailed(1, "No user found."),
        );

        expect(toFeedScreenModel(empty).status).toEqual({
            kind: "empty",
            message: "@alice has no feed items.",
        });
        expect(toFeedScreenModel(failed).status).toEqual({
            kind: "error",
            message: "No user found.",
            canRetry: true,
        });
    });
});
