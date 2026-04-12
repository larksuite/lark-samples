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
    rankLimit: 10,
  });
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
