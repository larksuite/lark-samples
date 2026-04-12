import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

export const DEFAULT_CACHE_STATE_FILE = ".cache/lazybot-state.json";

const CURRENT_SCHEMA_VERSION = 1;
const DEFAULT_SAVE_DEBOUNCE_MS = 100;

export class PersistedBotState {
  constructor({
    filePath = DEFAULT_CACHE_STATE_FILE,
    logger = console,
    debounceMs = DEFAULT_SAVE_DEBOUNCE_MS,
    now = () => Date.now(),
  } = {}) {
    this.filePath = resolve(filePath);
    this.logger = logger;
    this.debounceMs = debounceMs;
    this.now = now;
    this.pendingFlushTimer = null;
    this.dirty = false;
    this.processCleanup = null;
    this.state = createEmptyState();
  }

  loadState() {
    try {
      const raw = readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      this.state = normalizePersistedState(parsed, this.now());
    } catch (error) {
      if (!isMissingFileError(error)) {
        this.logger.warn?.("Failed to load persisted bot state", {
          error: error?.message ?? String(error),
          filePath: this.filePath,
        });
      }

      this.state = createEmptyState();
    }

    return this.getHydratedState();
  }

  updateRankingSnapshot(snapshot) {
    this.state.rankingSnapshot = normalizeRankingSnapshot(snapshot);
    this.markDirty();
  }

  updateDoneReceipts(doneReceipts) {
    this.state.receipts = normalizeDoneReceipts(doneReceipts, this.now());
    this.markDirty();
  }

  flushNow() {
    if (this.pendingFlushTimer) {
      clearTimeout(this.pendingFlushTimer);
      this.pendingFlushTimer = null;
    }

    if (!this.dirty) {
      return false;
    }

    mkdirSync(dirname(this.filePath), { recursive: true });

    const payload = JSON.stringify(
      {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        savedAt: new Date(this.now()).toISOString(),
        rankingSnapshot: this.state.rankingSnapshot,
        receipts: this.state.receipts,
      },
      null,
      2,
    );

    const tempFilePath = `${this.filePath}.${process.pid}.${this.now()}.tmp`;
    writeFileSync(tempFilePath, payload, "utf8");
    renameSync(tempFilePath, this.filePath);
    this.dirty = false;
    return true;
  }

  installProcessHooks(processRef = process) {
    if (this.processCleanup) {
      return this.processCleanup;
    }

    const flush = () => {
      try {
        this.flushNow();
      } catch (error) {
        this.logger.warn?.("Failed to flush persisted bot state", {
          error: error?.message ?? String(error),
          filePath: this.filePath,
        });
      }
    };

    addProcessListener(processRef, "beforeExit", flush);
    addProcessListener(processRef, "exit", flush);

    this.processCleanup = () => {
      removeProcessListener(processRef, "beforeExit", flush);
      removeProcessListener(processRef, "exit", flush);
      this.processCleanup = null;
    };

    return this.processCleanup;
  }

  dispose() {
    if (this.processCleanup) {
      this.processCleanup();
    }

    if (this.pendingFlushTimer) {
      clearTimeout(this.pendingFlushTimer);
      this.pendingFlushTimer = null;
    }
  }

  getHydratedState() {
    return {
      rankingSnapshot: cloneRankingSnapshot(this.state.rankingSnapshot),
      doneReceipts: this.state.receipts.map((receipt) => ({ ...receipt })),
    };
  }

  markDirty() {
    this.dirty = true;

    if (this.pendingFlushTimer) {
      clearTimeout(this.pendingFlushTimer);
    }

    this.pendingFlushTimer = setTimeout(() => {
      this.pendingFlushTimer = null;
      try {
        this.flushNow();
      } catch (error) {
        this.logger.warn?.("Failed to persist bot state", {
          error: error?.message ?? String(error),
          filePath: this.filePath,
        });
      }
    }, this.debounceMs);
  }
}

function createEmptyState() {
  return {
    rankingSnapshot: null,
    receipts: [],
  };
}

function normalizePersistedState(value, nowMs) {
  return {
    rankingSnapshot: normalizeRankingSnapshot(value?.rankingSnapshot),
    receipts: normalizeDoneReceipts(value?.receipts, nowMs),
  };
}

function normalizeRankingSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  if (!Array.isArray(snapshot.entries)) {
    return null;
  }

  if (!snapshot.summary || typeof snapshot.summary !== "object") {
    return null;
  }

  if (!Number.isFinite(snapshot.storedAtMs)) {
    return null;
  }

  return {
    entries: snapshot.entries.map((entry) => ({
      id: stringifyOrUnknown(entry?.id),
      name: stringifyOrUnknown(entry?.name),
      provider: stringifyOrUnknown(entry?.provider),
      score: Number.isFinite(entry?.score) ? entry.score : 0,
      trend: stringifyOrUnknown(entry?.trend),
      status: stringifyOrUnknown(entry?.status),
      lastUpdated: stringifyOrUnknown(entry?.lastUpdated),
    })),
    summary: {
      snapshot: stringifyOrUnknown(snapshot.summary.snapshot),
      updatedAt: stringifyOrUnknown(snapshot.summary.updatedAt),
    },
    storedAtMs: snapshot.storedAtMs,
  };
}

function cloneRankingSnapshot(snapshot) {
  if (!snapshot) {
    return null;
  }

  return {
    entries: snapshot.entries.map((entry) => ({ ...entry })),
    summary: { ...snapshot.summary },
    storedAtMs: snapshot.storedAtMs,
  };
}

function normalizeDoneReceipts(receipts, nowMs) {
  if (!Array.isArray(receipts)) {
    return [];
  }

  return receipts
    .map((receipt) => normalizeDoneReceipt(receipt, nowMs))
    .filter(Boolean)
    .sort((left, right) => left.messageId.localeCompare(right.messageId));
}

function normalizeDoneReceipt(receipt, nowMs) {
  const messageId = typeof receipt?.messageId === "string" ? receipt.messageId.trim() : "";
  const expiresAt = Number(receipt?.expiresAt);

  if (!messageId || receipt?.state !== "done" || !Number.isFinite(expiresAt)) {
    return null;
  }

  if (expiresAt <= nowMs) {
    return null;
  }

  return {
    messageId,
    state: "done",
    expiresAt,
  };
}

function stringifyOrUnknown(value) {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return "unknown";
}

function isMissingFileError(error) {
  return error?.code === "ENOENT";
}

function addProcessListener(processRef, eventName, handler) {
  if (typeof processRef?.on === "function") {
    processRef.on(eventName, handler);
  }
}

function removeProcessListener(processRef, eventName, handler) {
  if (typeof processRef?.off === "function") {
    processRef.off(eventName, handler);
    return;
  }

  if (typeof processRef?.removeListener === "function") {
    processRef.removeListener(eventName, handler);
  }
}
