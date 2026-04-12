import test from "node:test";
import assert from "node:assert/strict";

import { RankingClient } from "../src/ranking-client.js";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function createModelRow(overrides = {}) {
  return {
    id: "1",
    name: "alpha",
    provider: "openai",
    vendor: "openai",
    currentScore: 67,
    score: 67,
    trend: "up",
    status: "good",
    lastUpdated: "2026-04-12T03:00:04.636Z",
    ...overrides,
  };
}

function createCachedPayload({
  modelScores = [createModelRow()],
  bestForCode = { name: "alpha", rank: 1 },
  driftIncidents = [{ id: 1 }, { id: 2 }],
  degradations = [{ id: 11 }],
  summary = {
    confidence: 60,
    lastUpdate: "2026-04-12T03:20:43.338Z",
  },
  meta = {
    cachedAt: "2026-04-12T03:18:10.820Z",
  },
  ...overrides
} = {}) {
  return {
    success: true,
    data: {
      modelScores,
      recommendations: {
        bestForCode,
      },
      driftIncidents,
      degradations,
      transparencyMetrics: {
        summary,
      },
    },
    meta,
    ...overrides,
  };
}

function createScoresPayload({ rows = [createModelRow()], ...overrides } = {}) {
  return {
    success: true,
    data: rows,
    ...overrides,
  };
}

async function flushTasks() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("bootstraps from cached dashboard when live scores are unavailable", async () => {
  const client = new RankingClient({
    baseUrl: "https://aistupidlevel.info",
    fetchImpl: async (url) => {
      if (url.toString().endsWith("/api/dashboard/cached")) {
        return jsonResponse(
          createCachedPayload({
            modelScores: [
              createModelRow({
                id: "cached-1",
                name: "cached-alpha",
                currentScore: 62,
                score: 62,
              }),
            ],
          }),
        );
      }

      return jsonResponse({ error: "scores unavailable" }, 503);
    },
  });

  const ranking = await client.fetchRanking();

  assert.equal(ranking.entries.length, 1);
  assert.equal(ranking.entries[0].name, "cached-alpha");
  assert.equal(ranking.entries[0].score, 62);
  assert.equal(ranking.isStale, false);
  assert.deepEqual(ranking.summary, {
    snapshot:
      "Best for code: alpha (#1), drift alerts 2, degradations 1, confidence 60%",
    updatedAt: "2026-04-12T03:20:43.338Z",
  });
});

test("returns warm cache immediately and starts only one background refresh", async () => {
  const fetchCalls = [];
  const client = new RankingClient({
    fetchImpl: async (url) => {
      const requestUrl = url.toString();
      fetchCalls.push(requestUrl);

      if (fetchCalls.length === 1 && requestUrl.endsWith("/api/dashboard/cached")) {
        return jsonResponse(
          createCachedPayload({
            modelScores: [createModelRow({ name: "bootstrap-alpha", score: 61, currentScore: 61 })],
          }),
        );
      }

      if (fetchCalls.length === 2 && requestUrl.endsWith("/api/dashboard/scores")) {
        return jsonResponse(
          createScoresPayload({
            rows: [createModelRow({ name: "refresh-alpha", score: 66, currentScore: 66 })],
          }),
        );
      }

      if (fetchCalls.length === 3 && requestUrl.endsWith("/api/dashboard/cached")) {
        return jsonResponse(
          createCachedPayload({
            modelScores: [createModelRow({ name: "refresh-alpha", score: 66, currentScore: 66 })],
          }),
        );
      }

      if (requestUrl.endsWith("/api/dashboard/scores")) {
        return jsonResponse(
          createScoresPayload({
            rows: [createModelRow({ name: "refresh-beta", score: 68, currentScore: 68 })],
          }),
        );
      }

      return jsonResponse(
        createCachedPayload({
          modelScores: [createModelRow({ name: "refresh-beta", score: 68, currentScore: 68 })],
        }),
      );
    },
  });

  await client.fetchRanking();
  await flushTasks();

  fetchCalls.length = 0;

  const [first, second] = await Promise.all([
    client.fetchRanking(),
    client.fetchRanking(),
  ]);
  await flushTasks();

  assert.equal(first.entries[0].name, "refresh-alpha");
  assert.equal(second.entries[0].name, "refresh-alpha");
  assert.equal(fetchCalls.length, 2);
  assert.ok(
    fetchCalls.includes("https://aistupidlevel.info/api/dashboard/scores"),
  );
  assert.ok(
    fetchCalls.includes("https://aistupidlevel.info/api/dashboard/cached"),
  );
});

test("hydrates a persisted snapshot and refreshes it in the background", async () => {
  let nowMs = 0;
  const persistedSnapshot = {
    entries: [createModelRow({ name: "persisted-alpha", score: 61, currentScore: 61 })],
    summary: {
      snapshot: "Best for code: persisted-alpha (#1), drift alerts 0, degradations 0, confidence 70%",
      updatedAt: "2026-04-12T03:20:43.338Z",
    },
    storedAtMs: 0,
  };
  const observedSnapshots = [];
  const client = new RankingClient({
    initialSnapshot: persistedSnapshot,
    onSnapshotChange: (snapshot) => observedSnapshots.push(snapshot),
    now: () => nowMs,
    fetchImpl: async (url) => {
      if (url.toString().endsWith("/api/dashboard/scores")) {
        return jsonResponse(
          createScoresPayload({
            rows: [createModelRow({ name: "refreshed-alpha", score: 68, currentScore: 68 })],
          }),
        );
      }

      return jsonResponse(
        createCachedPayload({
          modelScores: [createModelRow({ name: "refreshed-alpha", score: 68, currentScore: 68 })],
          bestForCode: { name: "refreshed-alpha", rank: 1 },
        }),
      );
    },
  });

  const initial = await client.fetchRanking();
  assert.equal(initial.entries[0].name, "persisted-alpha");
  assert.equal(initial.isStale, false);

  await flushTasks();

  nowMs = 1;

  const refreshed = await client.fetchRanking();
  assert.equal(refreshed.entries[0].name, "refreshed-alpha");
  assert.equal(observedSnapshots.at(-1)?.entries[0].name, "refreshed-alpha");
});

test("returns a restored stale snapshot immediately while refresh continues", async () => {
  let fetchCalls = 0;
  const client = new RankingClient({
    cacheTtlMs: 100,
    initialSnapshot: {
      entries: [createModelRow({ name: "persisted-alpha", score: 61, currentScore: 61 })],
      summary: {
        snapshot: "Best for code: persisted-alpha (#1), drift alerts 0, degradations 0, confidence 70%",
        updatedAt: "2026-04-12T03:20:43.338Z",
      },
      storedAtMs: 0,
    },
    now: () => 101,
    fetchImpl: async (url) => {
      fetchCalls += 1;

      if (url.toString().endsWith("/api/dashboard/scores")) {
        return jsonResponse(
          createScoresPayload({
            rows: [createModelRow({ name: "refreshed-alpha", score: 68, currentScore: 68 })],
          }),
        );
      }

      return jsonResponse(
        createCachedPayload({
          modelScores: [createModelRow({ name: "refreshed-alpha", score: 68, currentScore: 68 })],
          bestForCode: { name: "refreshed-alpha", rank: 1 },
        }),
      );
    },
  });

  const ranking = await client.fetchRanking();

  assert.equal(ranking.entries[0].name, "persisted-alpha");
  assert.equal(ranking.isStale, true);

  await flushTasks();

  assert.equal(fetchCalls, 2);
});

test("keeps serving the last good snapshot as stale when refresh fails", async () => {
  let nowMs = 0;
  let phase = "bootstrap";
  const client = new RankingClient({
    cacheTtlMs: 100,
    now: () => nowMs,
    fetchImpl: async (url) => {
      const requestUrl = url.toString();

      if (phase === "bootstrap" && requestUrl.endsWith("/api/dashboard/cached")) {
        return jsonResponse(
          createCachedPayload({
            modelScores: [createModelRow({ name: "alpha", score: 63, currentScore: 63 })],
          }),
        );
      }

      throw new Error("network offline");
    },
  });

  const initial = await client.fetchRanking();
  assert.equal(initial.isStale, false);

  phase = "offline";
  nowMs = 101;

  const stale = await client.fetchRanking();
  await flushTasks();

  assert.equal(stale.entries[0].name, "alpha");
  assert.equal(stale.isStale, true);
});

test("falls back to the live refresh path when cached bootstrap fails", async () => {
  let cachedCalls = 0;
  const client = new RankingClient({
    fetchImpl: async (url) => {
      const requestUrl = url.toString();

      if (requestUrl.endsWith("/api/dashboard/cached")) {
        cachedCalls += 1;

        if (cachedCalls === 1) {
          return jsonResponse({ error: "temporary outage" }, 503);
        }

        return jsonResponse(
          createCachedPayload({
            modelScores: [createModelRow({ name: "cached-alpha", score: 65, currentScore: 65 })],
          }),
        );
      }

      return jsonResponse(
        createScoresPayload({
          rows: [createModelRow({ name: "live-alpha", score: 69, currentScore: 69 })],
        }),
      );
    },
  });

  const ranking = await client.fetchRanking();

  assert.equal(ranking.entries[0].name, "live-alpha");
  assert.equal(ranking.isStale, false);
});

test("throws when no cached snapshot exists and upstream data is unavailable", async () => {
  const client = new RankingClient({
    fetchImpl: async (url) => {
      if (url.toString().endsWith("/api/dashboard/cached")) {
        return jsonResponse({ error: "unavailable" }, 503);
      }

      return jsonResponse({ error: "unavailable" }, 503);
    },
  });

  await assert.rejects(client.fetchRanking(), /status 503/);
});
