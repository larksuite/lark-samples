import test from "node:test";
import assert from "node:assert/strict";

import {
  formatRankingMessage,
  formatUnavailableMessage,
  formatUsageMessage,
} from "../src/formatter.js";

test("formats summary and ranked entries in plain text", () => {
  const message = formatRankingMessage({
    entries: [
      {
        id: "1",
        name: "alpha",
        provider: "openai",
        score: 67,
        trend: "up",
        status: "good",
      },
      {
        id: "2",
        name: "beta",
        provider: "anthropic",
        score: 65,
        trend: "stable",
        status: "good",
      },
      {
        id: "3",
        name: "gamma",
        provider: "google",
        score: 61,
        trend: "down",
        status: "warning",
      },
    ],
    summary: {
      snapshot:
        "Best for code: alpha (#1), drift alerts 2, degradations 1, confidence 60%",
      updatedAt: "2026-04-12T03:20:43.338Z",
    },
    isStale: false,
  });

  assert.match(message, /AI Stupid Meter Live Ranking/);
  assert.match(
    message,
    /Summary: Best for code: alpha \(#1\), drift alerts 2, degradations 1, confidence 60%/,
  );
  assert.match(message, /Updated: 2026-04-12 03:20 UTC/);
  assert.match(message, /1\. alpha - 67 \(openai, up\/good\)/);
  assert.match(message, /2\. beta - 65 \(anthropic, stable\/good\)/);
  assert.match(message, /3\. gamma - 61 \(google, down\/warning\)/);
});

test("adds a stale note when serving stale ranking data", () => {
  const message = formatRankingMessage({
    entries: [
      {
        id: "1",
        name: "alpha",
        provider: "openai",
        score: 67,
        trend: "up",
        status: "good",
      },
    ],
    summary: {
      snapshot: "Best for code: alpha (#1)",
      updatedAt: "2026-04-12T03:20:43.338Z",
    },
    isStale: true,
  });

  assert.match(message, /Data may be stale while the bot refreshes the latest ranking\./);
});

test("formats usage message with supported slash commands", () => {
  const message = formatUsageMessage();

  assert.match(message, /Supported commands:/);
  assert.match(message, /\/rank/);
  assert.match(message, /\/leaderboard/);
});

test("formats a stable unavailable message", () => {
  assert.equal(
    formatUnavailableMessage(),
    "Ranking unavailable right now. Please try again in a moment.",
  );
});
