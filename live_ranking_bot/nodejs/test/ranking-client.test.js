import test from "node:test";
import assert from "node:assert/strict";

import { RankingClient } from "../src/ranking-client.js";

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

test("fetches and maps leaderboard entries with summary data", async () => {
  const fetchCalls = [];
  const fetchImpl = async (url) => {
    fetchCalls.push(url.toString());

    if (url.toString().endsWith("/dashboard/global-index")) {
      return jsonResponse({
        success: true,
        data: {
          current: { globalScore: 84 },
          trend: "stable",
          lastUpdated: "2026-04-12T03:20:43.338Z",
        },
      });
    }

    return jsonResponse({
      success: true,
      data: {
        modelScores: [
          {
            name: "alpha",
            provider: "openai",
            currentScore: 67,
            trend: "up",
            status: "good",
            lastUpdated: "2026-04-12T03:00:04.636Z",
          },
          {
            name: "beta",
            provider: "anthropic",
            score: 65,
            trend: "stable",
            status: "good",
            lastUpdated: "2026-04-12T03:00:04.636Z",
          },
        ],
      },
      meta: {
        cachedAt: "2026-04-12T03:18:10.820Z",
      },
    });
  };

  const client = new RankingClient({
    baseUrl: "https://aistupidlevel.info",
    fetchImpl,
    rankLimit: 1,
  });

  const ranking = await client.fetchRanking();

  assert.equal(fetchCalls.length, 2);
  assert.equal(ranking.entries.length, 1);
  assert.deepEqual(ranking.entries[0], {
    name: "alpha",
    provider: "openai",
    score: 67,
    trend: "up",
    status: "good",
    lastUpdated: "2026-04-12T03:00:04.636Z",
  });
  assert.deepEqual(ranking.summary, {
    globalScore: 84,
    trend: "stable",
    updatedAt: "2026-04-12T03:20:43.338Z",
  });
});

test("throws when dashboard response is missing success", async () => {
  const client = new RankingClient({
    fetchImpl: async (url) => {
      if (url.toString().endsWith("/dashboard/global-index")) {
        return jsonResponse({
          success: true,
          data: {
            current: { globalScore: 84 },
            trend: "stable",
            lastUpdated: "2026-04-12T03:20:43.338Z",
          },
        });
      }

      return jsonResponse({
        data: {
          modelScores: [],
        },
      });
    },
  });

  await assert.rejects(client.fetchRanking(), /Dashboard leaderboard response was unsuccessful/);
});

test("throws when dashboard model scores are missing", async () => {
  const client = new RankingClient({
    fetchImpl: async (url) => {
      if (url.toString().endsWith("/dashboard/global-index")) {
        return jsonResponse({
          success: true,
          data: {
            current: { globalScore: 84 },
            trend: "stable",
            lastUpdated: "2026-04-12T03:20:43.338Z",
          },
        });
      }

      return jsonResponse({
        success: true,
        data: {},
      });
    },
  });

  await assert.rejects(client.fetchRanking(), /Dashboard leaderboard payload is missing model scores/);
});

test("throws when dashboard model scores are empty", async () => {
  const client = new RankingClient({
    fetchImpl: async (url) => {
      if (url.toString().endsWith("/dashboard/global-index")) {
        return jsonResponse({
          success: true,
          data: {
            current: { globalScore: 84 },
            trend: "stable",
            lastUpdated: "2026-04-12T03:20:43.338Z",
          },
        });
      }

      return jsonResponse({
        success: true,
        data: {
          modelScores: [],
        },
      });
    },
  });

  await assert.rejects(client.fetchRanking(), /Dashboard leaderboard returned no model scores/);
});

test("throws on invalid json", async () => {
  const client = new RankingClient({
    fetchImpl: async () =>
      new Response("not json", {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
  });

  await assert.rejects(client.fetchRanking(), /Failed to parse dashboard leaderboard JSON/);
});

test("throws on network failure", async () => {
  const client = new RankingClient({
    fetchImpl: async () => {
      throw new Error("socket hang up");
    },
  });

  await assert.rejects(client.fetchRanking(), /socket hang up/);
});
