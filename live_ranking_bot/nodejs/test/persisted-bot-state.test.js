import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { PersistedBotState } from "../src/persisted-bot-state.js";

function createTempStateFile() {
  const tempDir = mkdtempSync(join(tmpdir(), "lazybot-state-"));
  return join(tempDir, "state.json");
}

function createSnapshot() {
  return {
    entries: [
      {
        id: "1",
        name: "alpha",
        provider: "openai",
        score: 67,
        trend: "up",
        status: "good",
        lastUpdated: "2026-04-12T03:00:04.636Z",
      },
    ],
    summary: {
      snapshot: "Best for code: alpha (#1), drift alerts 0, degradations 0, confidence 60%",
      updatedAt: "2026-04-12T03:20:43.338Z",
    },
    storedAtMs: 900,
  };
}

test("loads empty state when the state file is missing", () => {
  const state = new PersistedBotState({
    filePath: createTempStateFile(),
  });

  assert.deepEqual(state.loadState(), {
    rankingSnapshot: null,
    doneReceipts: [],
  });
});

test("saves and restores the ranking snapshot and done receipts", () => {
  const filePath = createTempStateFile();
  const state = new PersistedBotState({
    filePath,
    now: () => 1_000,
  });

  state.updateRankingSnapshot(createSnapshot());
  state.updateDoneReceipts([
    {
      messageId: "om_saved",
      state: "done",
      expiresAt: 2_000,
    },
  ]);
  state.flushNow();

  const saved = JSON.parse(readFileSync(filePath, "utf8"));
  assert.equal(saved.schemaVersion, 1);
  assert.equal(Array.isArray(saved.receipts), true);

  const restored = new PersistedBotState({
    filePath,
    now: () => 1_500,
  });

  assert.deepEqual(restored.loadState(), {
    rankingSnapshot: createSnapshot(),
    doneReceipts: [
      {
        messageId: "om_saved",
        state: "done",
        expiresAt: 2_000,
      },
    ],
  });
});

test("drops expired done receipts while restoring persisted state", () => {
  const filePath = createTempStateFile();
  const state = new PersistedBotState({
    filePath,
    now: () => 1_000,
  });

  state.updateRankingSnapshot(createSnapshot());
  state.updateDoneReceipts([
    {
      messageId: "om_expired",
      state: "done",
      expiresAt: 999,
    },
    {
      messageId: "om_saved",
      state: "done",
      expiresAt: 2_000,
    },
  ]);
  state.flushNow();

  const restored = new PersistedBotState({
    filePath,
    now: () => 1_500,
  });

  assert.deepEqual(restored.loadState().doneReceipts, [
    {
      messageId: "om_saved",
      state: "done",
      expiresAt: 2_000,
    },
  ]);
});

test("warns and starts fresh when the persisted state file is corrupt", () => {
  const filePath = createTempStateFile();
  const warnings = [];

  writeFileSync(filePath, "{not-json", "utf8");

  const state = new PersistedBotState({
    filePath,
    logger: {
      warn(message, details) {
        warnings.push({ details, message });
      },
    },
  });

  assert.deepEqual(state.loadState(), {
    rankingSnapshot: null,
    doneReceipts: [],
  });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /Failed to load persisted bot state/);
});
