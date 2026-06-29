"use client";

import { useEffect, useReducer } from "react";

import {
    createFeedState,
    feedDataEvents,
    feedUiEvents,
    reduceFeedState,
    toFeedScreenModel,
    type FeedApiPage,
    type FeedScreenModel,
    type FeedUiEvent,
} from "./feed-model.ts";

const FEED_LIMIT = 12;

export function FeedClient() {
    const [state, dispatch] = useReducer(
        reduceFeedState,
        undefined,
        () => createFeedState("bob"),
    );
    const model = toFeedScreenModel(state);

    useEffect(() => {
        const pending = state.pending;
        if (!pending) {
            return;
        }

        const controller = new AbortController();
        const params = new URLSearchParams({
            username: pending.username,
            limit: String(FEED_LIMIT),
        });

        if (pending.kind === "next") {
            params.set("cursor", pending.cursor);
        }

        fetch(`/api/feed?${params.toString()}`, {
            signal: controller.signal,
        })
            .then(async (response) => {
                const body = await response.json();

                if (!response.ok) {
                    const message =
                        typeof body?.error === "string"
                            ? body.error
                            : `Feed request failed with HTTP ${response.status}.`;
                    throw new Error(message);
                }

                dispatch(
                    feedDataEvents.pageLoaded(
                        pending.requestId,
                        body as FeedApiPage,
                    ),
                );
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) {
                    return;
                }

                dispatch(
                    feedDataEvents.pageFailed(
                        pending.requestId,
                        error instanceof Error
                            ? error.message
                            : "Feed request failed.",
                    ),
                );
            });

        return () => controller.abort();
    }, [state.pending]);

    return <FeedScreen model={model} emit={dispatch} />;
}

function FeedScreen({
    model,
    emit,
}: {
    model: FeedScreenModel;
    emit: (event: FeedUiEvent) => void;
}) {
    return (
        <main className="min-h-screen bg-slate-100 text-slate-950">
            <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-0 lg:grid-cols-[84px_minmax(0,1fr)_300px]">
                <nav className="hidden border-r border-slate-200 bg-slate-950 px-4 py-6 text-white lg:flex lg:flex-col lg:items-center lg:gap-8">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-sm font-black text-slate-950">
                        C
                    </div>
                    <div className="flex flex-col gap-4 text-xs font-semibold text-slate-400">
                        <span className="text-white">Feed</span>
                        <span>Users</span>
                        <span>Graph</span>
                    </div>
                </nav>

                <section className="min-w-0 bg-white">
                    <header className="border-b border-slate-200 px-5 py-5 sm:px-8">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                    Chirp
                                </p>
                                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                                    {model.title}
                                </h1>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                                    {model.subtitle}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={model.actions.refresh.disabled}
                                    onClick={() =>
                                        emit(model.actions.refresh.event)
                                    }
                                    className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {model.actions.refresh.label}
                                </button>
                            </div>
                        </div>
                    </header>

                    <FeedStatus model={model} emit={emit} />
                </section>

                <aside className="border-t border-slate-200 bg-slate-50 px-5 py-6 lg:border-l lg:border-t-0">
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <h2 className="text-sm font-semibold text-slate-950">
                            Viewer
                        </h2>
                        <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Username
                        </label>
                        <select
                            value={model.viewer.username}
                            onChange={(event) =>
                                emit(
                                    feedUiEvents.viewerChanged(
                                        event.target.value,
                                    ),
                                )
                            }
                            className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900"
                        >
                            <option value="bob">bob</option>
                            <option value="alice">alice</option>
                            <option value="ghost">ghost</option>
                        </select>
                        <p className="mt-4 text-sm leading-6 text-slate-600">
                            The UI emits typed events; the model decides what
                            those events are allowed to do.
                        </p>
                    </div>
                </aside>
            </div>
        </main>
    );
}

function FeedStatus({
    model,
    emit,
}: {
    model: FeedScreenModel;
    emit: (event: FeedUiEvent) => void;
}) {
    switch (model.status.kind) {
        case "loading":
            return (
                <div className="px-5 py-12 text-sm text-slate-600 sm:px-8">
                    {model.status.message}
                </div>
            );

        case "empty":
            return (
                <div className="px-5 py-12 sm:px-8">
                    <p className="text-base font-semibold text-slate-950">
                        Empty feed
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                        {model.status.message}
                    </p>
                </div>
            );

        case "error":
            return (
                <div className="px-5 py-12 sm:px-8">
                    <p className="text-base font-semibold text-red-700">
                        Feed unavailable
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                        {model.status.message}
                    </p>
                    {model.status.canRetry ? (
                        <button
                            type="button"
                            onClick={() => emit(model.actions.refresh.event)}
                            className="mt-5 h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white"
                        >
                            Try again
                        </button>
                    ) : null}
                </div>
            );

        case "ready":
            return (
                <div className="divide-y divide-slate-200">
                    {model.status.tweets.map((tweet) => (
                        <article key={tweet.id} className="px-5 py-5 sm:px-8">
                            <div className="flex items-start gap-4">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
                                    {tweet.authorName.charAt(0)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                        <h2 className="text-sm font-semibold text-slate-950">
                                            {tweet.authorName}
                                        </h2>
                                        <span className="text-xs text-slate-500">
                                            @{tweet.authorUsername}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            {tweet.timestamp}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-[15px] leading-7 text-slate-700">
                                        {tweet.text}
                                    </p>
                                    <p className="mt-3 font-mono text-[11px] text-slate-400">
                                        {tweet.id}
                                    </p>
                                </div>
                            </div>
                        </article>
                    ))}

                    <div className="px-5 py-6 sm:px-8">
                        <button
                            type="button"
                            disabled={model.actions.loadMore.disabled}
                            onClick={() => emit(model.actions.loadMore.event)}
                            className="h-11 w-full rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {model.actions.loadMore.label}
                        </button>
                    </div>
                </div>
            );
    }
}
