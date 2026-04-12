import test from "node:test";
import assert from "node:assert/strict";

import { loadRuntimeConfig } from "../src/config.js";

test("loads required config with defaults", () => {
  const config = loadRuntimeConfig({
    APP_ID: "cli_test",
    APP_SECRET: "secret",
  });

  assert.deepEqual(config, {
    appId: "cli_test",
    appSecret: "secret",
    domain: "https://open.feishu.cn",
    aistupidBaseUrl: "https://aistupidlevel.info",
    cacheStateFile: ".cache/lazybot-state.json",
    botOpenId: null,
    botUserId: null,
    rankLimit: 10,
  });
});

test("loads optional bot identity values", () => {
  const config = loadRuntimeConfig({
    APP_ID: "cli_test",
    APP_SECRET: "secret",
    BOT_OPEN_ID: "ou_bot",
    BOT_USER_ID: "cli_bot",
  });

  assert.equal(config.botOpenId, "ou_bot");
  assert.equal(config.botUserId, "cli_bot");
});

test("loads optional cache state file", () => {
  const config = loadRuntimeConfig({
    APP_ID: "cli_test",
    APP_SECRET: "secret",
    CACHE_STATE_FILE: "/tmp/lazybot-state.json",
  });

  assert.equal(config.cacheStateFile, "/tmp/lazybot-state.json");
});

test("throws when app id is missing", () => {
  assert.throws(
    () =>
      loadRuntimeConfig({
        APP_SECRET: "secret",
      }),
    /APP_ID is required/,
  );
});

test("throws when app secret is missing", () => {
  assert.throws(
    () =>
      loadRuntimeConfig({
        APP_ID: "cli_test",
      }),
    /APP_SECRET is required/,
  );
});
