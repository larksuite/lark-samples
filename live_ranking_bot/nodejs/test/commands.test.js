import test from "node:test";
import assert from "node:assert/strict";

import { parseCommand } from "../src/commands.js";

test("returns ranking command for /rank", () => {
  assert.deepEqual(parseCommand("/rank"), {
    type: "ranking",
    command: "/rank",
  });
});

test("normalizes whitespace for /leaderboard", () => {
  assert.deepEqual(parseCommand("   /leaderboard  "), {
    type: "ranking",
    command: "/leaderboard",
  });
});

test("ignores bare rank text without slash", () => {
  assert.equal(parseCommand("rank"), null);
});

test("returns unsupported slash command metadata", () => {
  assert.deepEqual(parseCommand("/unknown"), {
    type: "unsupported",
    command: "/unknown",
  });
});
