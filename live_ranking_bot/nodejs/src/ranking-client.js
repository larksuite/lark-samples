export const DEFAULT_AISTUPID_BASE_URL = "https://aistupidlevel.info";
const LEADERBOARD_PATH = "/dashboard/cached?period=latest&sortBy=combined&analyticsPeriod=latest";
const GLOBAL_INDEX_PATH = "/dashboard/global-index";

export class RankingClient {
  constructor({
    baseUrl = DEFAULT_AISTUPID_BASE_URL,
    fetchImpl = globalThis.fetch,
    rankLimit = 10,
  } = {}) {
    if (typeof fetchImpl !== "function") {
      throw new TypeError("RankingClient requires a fetch implementation");
    }

    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    this.fetchImpl = fetchImpl;
    this.rankLimit = normalizeRankLimit(rankLimit);
  }

  async fetchRanking() {
    const [leaderboardPayload, globalIndexPayload] = await Promise.all([
      this.fetchJson(LEADERBOARD_PATH, "dashboard leaderboard"),
      this.fetchJson(GLOBAL_INDEX_PATH, "dashboard global index"),
    ]);

    validateLeaderboardPayload(leaderboardPayload);
    validateGlobalIndexPayload(globalIndexPayload);

    return {
      entries: mapEntries(leaderboardPayload.data.modelScores, this.rankLimit),
      summary: {
        globalScore: globalIndexPayload.data.current.globalScore,
        trend: globalIndexPayload.data.trend,
        updatedAt: globalIndexPayload.data.lastUpdated,
      },
    };
  }

  async fetchJson(path, label) {
    const url = new URL(path, this.baseUrl);
    let response;

    try {
      response = await this.fetchImpl(url);
    } catch (error) {
      throw error;
    }

    if (!response.ok) {
      throw new Error(
        `${capitalize(label)} request failed with status ${response.status}`,
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to parse ${label} JSON`);
    }
  }
}

function normalizeRankLimit(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 10;
  }

  return parsed;
}

function validateLeaderboardPayload(payload) {
  if (payload?.success !== true) {
    throw new Error("Dashboard leaderboard response was unsuccessful");
  }

  if (!Array.isArray(payload?.data?.modelScores)) {
    throw new Error("Dashboard leaderboard payload is missing model scores");
  }

  if (payload.data.modelScores.length === 0) {
    throw new Error("Dashboard leaderboard returned no model scores");
  }
}

function validateGlobalIndexPayload(payload) {
  if (payload?.success !== true) {
    throw new Error("Dashboard global index response was unsuccessful");
  }

  if (typeof payload?.data?.current?.globalScore !== "number") {
    throw new Error("Dashboard global index payload is missing current score");
  }

  if (typeof payload?.data?.trend !== "string") {
    throw new Error("Dashboard global index payload is missing trend");
  }

  if (typeof payload?.data?.lastUpdated !== "string") {
    throw new Error("Dashboard global index payload is missing last updated time");
  }
}

function mapEntries(modelScores, rankLimit) {
  return modelScores.slice(0, rankLimit).map((model) => ({
    name: String(model.name),
    provider: String(model.provider),
    score:
      typeof model.currentScore === "number" ? model.currentScore : model.score,
    trend: String(model.trend),
    status: String(model.status),
    lastUpdated: String(model.lastUpdated),
  }));
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
