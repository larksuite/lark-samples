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

function createCachedPayload(overrides = {}) {
  return {
    success: true,
    data: {
      recommendations: {
        bestForCode: {
          name: "alpha",
          rank: 1,
        },
      },
      driftIncidents: [{ id: 1 }, { id: 2 }],
      degradations: [{ id: 11 }],
      transparencyMetrics: {
        summary: {
          confidence: 60,
          lastUpdate: "2026-04-12T03:20:43.338Z",
        },
      },
    },
    meta: {
      cachedAt: "2026-04-12T03:18:10.820Z",
    },
    ...overrides,
  };
}

function createScoresPayload(overrides = {}) {
  return {
    success: true,
    data: [
      {
        id: "1",
        name: "alpha",
        provider: "openai",
        currentScore: 67,
        trend: "up",
        status: "good",
        lastUpdated: "2026-04-12T03:00:04.636Z",
      },
      {
        id: "2",
        name: "beta",
        provider: "anthropic",
        score: 65,
        trend: "stable",
        status: "good",
        lastUpdated: "2026-04-12T03:00:04.636Z",
      },
      ...(overrides.extraRows ?? []),
    ],
    ...overrides,
  };
}

test("fetches and maps dashboard scores with cached summary data", async () => {
  const fetchCalls = [];
  const fetchImpl = async (url) => {
    fetchCalls.push(url.toString());

    if (url.toString().endsWith("/api/dashboard/cached")) {
      return jsonResponse(createCachedPayload());
    }

    return jsonResponse(createScoresPayload());
  };

  const client = new RankingClient({
    baseUrl: "https://aistupidlevel.info",
    fetchImpl,
    rankLimit: 1,
  });

  const ranking = await client.fetchRanking();

  assert.equal(fetchCalls.length, 2);
  assert.ok(
    fetchCalls.includes("https://aistupidlevel.info/api/dashboard/scores"),
  );
  assert.ok(
    fetchCalls.includes("https://aistupidlevel.info/api/dashboard/cached"),
  );
  assert.equal(ranking.entries.length, 1);
  assert.deepEqual(ranking.entries[0], {
    id: "1",
    name: "alpha",
    provider: "openai",
    score: 67,
    trend: "up",
    status: "good",
    lastUpdated: "2026-04-12T03:00:04.636Z",
  });
  assert.deepEqual(ranking.summary, {
    snapshot:
      "Best for code: alpha (#1), drift alerts 2, degradations 1, confidence 60%",
    updatedAt: "2026-04-12T03:20:43.338Z",
  });
});

test("maps partial score rows with safe defaults", async () => {
  const client = new RankingClient({
    fetchImpl: async (url) => {
      if (url.toString().endsWith("/api/dashboard/cached")) {
        return jsonResponse(createCachedPayload());
      }

      return jsonResponse({
        success: true,
        data: [
          {
            id: "7",
            name: "gamma",
            vendor: "google",
            score: 61,
          },
        ],
      });
    },
  });

  const ranking = await client.fetchRanking();

  assert.deepEqual(ranking.entries[0], {
    id: "7",
    name: "gamma",
    provider: "google",
    score: 61,
    trend: "unknown",
    status: "unknown",
    lastUpdated: "unknown",
  });
});

test("enforces the exact rank limit", async () => {
  const client = new RankingClient({
    rankLimit: 2,
    fetchImpl: async (url) => {
      if (url.toString().endsWith("/api/dashboard/cached")) {
        return jsonResponse(createCachedPayload());
      }

      return jsonResponse(
        createScoresPayload({
          extraRows: [
            {
              id: "3",
              name: "gamma",
              provider: "google",
              score: 61,
              trend: "down",
              status: "warning",
              lastUpdated: "2026-04-12T03:00:04.636Z",
            },
          ],
        }),
      );
    },
  });

  const ranking = await client.fetchRanking();

  assert.equal(ranking.entries.length, 2);
  assert.equal(ranking.entries[1].name, "beta");
});

test("throws when scores response is missing success", async () => {
  const client = new RankingClient({
    fetchImpl: async (url) => {
      if (url.toString().endsWith("/api/dashboard/cached")) {
        return jsonResponse(createCachedPayload());
      }

      return jsonResponse({
        data: [],
      });
    },
  });

  await assert.rejects(
    client.fetchRanking(),
    /Dashboard scores response was unsuccessful/,
  );
});

test("throws when scores payload is missing the ranking list", async () => {
  const client = new RankingClient({
    fetchImpl: async (url) => {
      if (url.toString().endsWith("/api/dashboard/cached")) {
        return jsonResponse(createCachedPayload());
      }

      return jsonResponse({
        success: true,
        data: {},
      });
    },
  });

  await assert.rejects(
    client.fetchRanking(),
    /Dashboard scores payload is missing the ranking list/,
  );
});

test("throws when scores payload is empty", async () => {
  const client = new RankingClient({
    fetchImpl: async (url) => {
      if (url.toString().endsWith("/api/dashboard/cached")) {
        return jsonResponse(createCachedPayload());
      }

      return jsonResponse({
        success: true,
        data: [],
      });
    },
  });

  await assert.rejects(
    client.fetchRanking(),
    /Dashboard scores returned no models/,
  );
});

test("throws when cached dashboard response is missing success", async () => {
  const client = new RankingClient({
    fetchImpl: async (url) => {
      if (url.toString().endsWith("/api/dashboard/cached")) {
        return jsonResponse({
          data: {},
        });
      }

      return jsonResponse(createScoresPayload());
    },
  });

  await assert.rejects(
    client.fetchRanking(),
    /Dashboard cached response was unsuccessful/,
  );
});

test("throws on non-200 api responses", async () => {
  const client = new RankingClient({
    fetchImpl: async (url) => {
      if (url.toString().endsWith("/api/dashboard/cached")) {
        return jsonResponse(createCachedPayload());
      }

      return jsonResponse(
        {
          error: "Not Found",
        },
        404,
      );
    },
  });

  await assert.rejects(
    client.fetchRanking(),
    /Dashboard scores request failed with status 404/,
  );
});

test("throws on invalid json", async () => {
  const client = new RankingClient({
    fetchImpl: async (url) => {
      if (url.toString().endsWith("/api/dashboard/cached")) {
        return jsonResponse(createCachedPayload());
      }

      return new Response("not json", {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    },
  });

  await assert.rejects(
    client.fetchRanking(),
    /Failed to parse dashboard scores JSON/,
  );
});

test("throws on network failure", async () => {
  const client = new RankingClient({
    fetchImpl: async () => {
      throw new Error("socket hang up");
    },
  });

  await assert.rejects(client.fetchRanking(), /socket hang up/);
});
