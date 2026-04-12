export const DEFAULT_AISTUPID_BASE_URL = "https://aistupidlevel.info";
export const DEFAULT_RANKING_CACHE_TTL_MS = 30 * 60 * 1000;

// The live site currently exposes dashboard data under these /api sub-routes.
const SCORES_PATH = "/api/dashboard/scores";
const CACHED_DASHBOARD_PATH = "/api/dashboard/cached";
export const MODEL_DETAILS_PATH_PREFIX = "/api/models/";

export class RankingClient {
  constructor({
    baseUrl = DEFAULT_AISTUPID_BASE_URL,
    fetchImpl = globalThis.fetch,
    rankLimit = 10,
    cacheTtlMs = DEFAULT_RANKING_CACHE_TTL_MS,
    now = () => Date.now(),
  } = {}) {
    if (typeof fetchImpl !== "function") {
      throw new TypeError("RankingClient requires a fetch implementation");
    }

    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    this.fetchImpl = fetchImpl;
    this.rankLimit = normalizeRankLimit(rankLimit);
    this.cacheTtlMs = cacheTtlMs;
    this.now = now;
    this.snapshot = null;
    this.bootstrapPromise = null;
    this.refreshPromise = null;
  }

  async fetchRanking() {
    if (this.snapshot) {
      const ranking = snapshotToPublicRanking(
        this.snapshot,
        this.isSnapshotStale(this.snapshot),
      );

      this.refreshInBackground();
      return ranking;
    }

    if (!this.bootstrapPromise) {
      this.bootstrapPromise = this.bootstrapAndWarm().finally(() => {
        this.bootstrapPromise = null;
      });
    }

    const snapshot = await this.bootstrapPromise;
    return snapshotToPublicRanking(snapshot, this.isSnapshotStale(snapshot));
  }

  async bootstrapAndWarm() {
    try {
      const snapshot = await this.bootstrapFromCached();
      this.setSnapshot(snapshot);
      this.refreshInBackground();
      return snapshot;
    } catch (error) {
      return this.ensureRefresh({ wait: true });
    }
  }

  async bootstrapFromCached() {
    const cachedDashboardPayload = await this.fetchJson(
      CACHED_DASHBOARD_PATH,
      "dashboard cached",
    );

    validateCachedDashboardPayload(cachedDashboardPayload);

    return createSnapshot({
      entries: mapEntriesFromCachedPayload(cachedDashboardPayload, this.rankLimit),
      summary: mapSummary(cachedDashboardPayload),
      storedAtMs: this.now(),
    });
  }

  refreshInBackground() {
    this.ensureRefresh({ wait: false }).catch(() => {});
  }

  async ensureRefresh({ wait }) {
    if (!this.refreshPromise) {
      this.refreshPromise = this.performRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }

    if (wait) {
      return this.refreshPromise;
    }

    return this.refreshPromise;
  }

  async performRefresh() {
    const [scoresResult, cachedResult] = await Promise.allSettled([
      this.fetchJson(SCORES_PATH, "dashboard scores"),
      this.fetchJson(CACHED_DASHBOARD_PATH, "dashboard cached"),
    ]);
    const cachedDashboardPayload = getSettledValue(cachedResult);

    validateCachedDashboardPayload(cachedDashboardPayload);

    const snapshot = createSnapshot({
      entries: resolveRefreshEntries({
        cachedDashboardPayload,
        rankLimit: this.rankLimit,
        scoresResult,
      }),
      summary: mapSummary(cachedDashboardPayload),
      storedAtMs: this.now(),
    });

    this.setSnapshot(snapshot);
    return snapshot;
  }

  setSnapshot(snapshot) {
    this.snapshot = snapshot;
    return snapshot;
  }

  isSnapshotStale(snapshot) {
    return this.now() - snapshot.storedAtMs > this.cacheTtlMs;
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

function validateScoresPayload(payload) {
  if (payload?.success !== true) {
    throw new Error("Dashboard scores response was unsuccessful");
  }

  if (!Array.isArray(payload?.data)) {
    throw new Error("Dashboard scores payload is missing the ranking list");
  }

  if (payload.data.length === 0) {
    throw new Error("Dashboard scores returned no models");
  }
}

function validateCachedDashboardPayload(payload) {
  if (payload?.success !== true) {
    throw new Error("Dashboard cached response was unsuccessful");
  }

  if (!payload?.data || typeof payload.data !== "object") {
    throw new Error("Dashboard cached payload is missing summary data");
  }
}

function mapEntriesFromCachedPayload(payload, rankLimit) {
  if (!Array.isArray(payload?.data?.modelScores)) {
    throw new Error("Dashboard cached payload is missing the ranking list");
  }

  if (payload.data.modelScores.length === 0) {
    throw new Error("Dashboard cached returned no models");
  }

  return mapEntries(payload.data.modelScores, rankLimit);
}

function resolveRefreshEntries({ cachedDashboardPayload, rankLimit, scoresResult }) {
  if (scoresResult.status === "fulfilled") {
    try {
      validateScoresPayload(scoresResult.value);
      return mapEntries(scoresResult.value.data, rankLimit);
    } catch (error) {
      // Fall through to cached model scores below.
    }
  }

  return mapEntriesFromCachedPayload(cachedDashboardPayload, rankLimit);
}

function mapEntries(models, rankLimit) {
  return models.slice(0, rankLimit).map((model) => ({
    id: String(model.id),
    name: String(model.name),
    provider: firstString(model.provider, model.vendor, "unknown"),
    score: getModelScore(model),
    trend: firstString(model.trend, "unknown"),
    status: firstString(model.status, "unknown"),
    lastUpdated: firstString(model.lastUpdated, "unknown"),
  }));
}

function mapSummary(payload) {
  const summary = payload.data?.transparencyMetrics?.summary ?? {};
  const bestForCode = payload.data?.recommendations?.bestForCode;
  const driftCount = Array.isArray(payload.data?.driftIncidents)
    ? payload.data.driftIncidents.length
    : 0;
  const degradationCount = Array.isArray(payload.data?.degradations)
    ? payload.data.degradations.length
    : 0;
  const parts = [];

  if (bestForCode?.name) {
    parts.push(
      `Best for code: ${bestForCode.name}${formatOptionalRank(bestForCode.rank)}`,
    );
  }

  parts.push(`drift alerts ${driftCount}`);
  parts.push(`degradations ${degradationCount}`);

  if (typeof summary.confidence === "number") {
    parts.push(`confidence ${summary.confidence}%`);
  }

  return {
    snapshot: parts.join(", "),
    updatedAt: firstString(summary.lastUpdate, payload.meta?.cachedAt, "unknown"),
  };
}

function createSnapshot({ entries, summary, storedAtMs }) {
  return {
    entries,
    summary,
    storedAtMs,
  };
}

function snapshotToPublicRanking(snapshot, isStale) {
  return {
    entries: snapshot.entries.map((entry) => ({ ...entry })),
    summary: { ...snapshot.summary },
    isStale,
  };
}

function getSettledValue(result) {
  if (result.status === "fulfilled") {
    return result.value;
  }

  throw result.reason;
}

function getModelScore(model) {
  if (typeof model.currentScore === "number") {
    return model.currentScore;
  }

  if (typeof model.score === "number") {
    return model.score;
  }

  throw new Error(`Dashboard scores model ${String(model.name)} is missing score`);
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return "unknown";
}

function formatOptionalRank(rank) {
  if (Number.isInteger(rank) && rank > 0) {
    return ` (#${rank})`;
  }

  return "";
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
