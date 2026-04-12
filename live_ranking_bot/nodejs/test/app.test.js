import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createBotRuntime } from "../src/app.js";
import { PersistedBotState } from "../src/persisted-bot-state.js";

test("creates bot runtime with SDK wiring", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "lazybot-app-"));
  const cacheStateFile = join(tempDir, "state.json");

  class FakeClient {
    constructor(config) {
      this.config = config;
    }
  }

  class FakeWsClient {
    constructor(config) {
      this.config = config;
    }
  }

  class FakeEventDispatcher {
    constructor(options) {
      this.options = options;
    }

    register(handlers) {
      this.handlers = handlers;
      return this;
    }
  }

  const fakeProcess = {
    on() {},
    off() {},
  };

  const runtime = createBotRuntime({
    sdk: {
      Client: FakeClient,
      WSClient: FakeWsClient,
      EventDispatcher: FakeEventDispatcher,
    },
    env: {
      APP_ID: "cli_test",
      APP_SECRET: "secret",
      BOT_OPEN_ID: "ou_bot",
      BOT_USER_ID: "cli_bot",
      CACHE_STATE_FILE: cacheStateFile,
      RANK_LIMIT: "5",
    },
    fetchImpl: async () => {
      throw new Error("not used");
    },
    processRef: fakeProcess,
  });

  assert.equal(runtime.baseConfig.appId, "cli_test");
  assert.equal(runtime.baseConfig.appSecret, "secret");
  assert.equal(runtime.baseConfig.domain, "https://open.feishu.cn");
  assert.equal(runtime.config.botOpenId, "ou_bot");
  assert.equal(runtime.config.botUserId, "cli_bot");
  assert.equal(runtime.config.cacheStateFile, cacheStateFile);
  assert.equal(runtime.config.rankLimit, 5);
  assert.ok(runtime.feishuClient instanceof FakeClient);
  assert.ok(runtime.wsClient instanceof FakeWsClient);
  assert.ok(runtime.eventDispatcher instanceof FakeEventDispatcher);
  assert.equal(typeof runtime.messageReceiptStore.reserve, "function");
  assert.equal(typeof runtime.stateStore.flushNow, "function");
  assert.equal(
    typeof runtime.eventDispatcher.handlers["im.message.receive_v1"],
    "function",
  );
});

test("hydrates persisted ranking and receipt state into the runtime", () => {
  const nowMs = Date.now();
  const tempDir = mkdtempSync(join(tmpdir(), "lazybot-app-state-"));
  const cacheStateFile = join(tempDir, "state.json");
  const persistedState = new PersistedBotState({
    filePath: cacheStateFile,
    now: () => nowMs,
    debounceMs: 1,
  });

  persistedState.updateRankingSnapshot({
    entries: [
      {
        id: "1",
        name: "persisted-alpha",
        provider: "openai",
        score: 66,
        trend: "up",
        status: "good",
        lastUpdated: "2026-04-12T03:00:04.636Z",
      },
    ],
    summary: {
      snapshot: "Best for code: persisted-alpha (#1), drift alerts 0, degradations 0, confidence 80%",
      updatedAt: "2026-04-12T03:20:43.338Z",
    },
    storedAtMs: nowMs - 1_000,
  });
  persistedState.updateDoneReceipts([
    {
      messageId: "om_saved",
      state: "done",
      expiresAt: nowMs + 60_000,
    },
  ]);
  persistedState.flushNow();

  class FakeClient {
    constructor(config) {
      this.config = config;
    }
  }

  class FakeWsClient {
    constructor(config) {
      this.config = config;
    }
  }

  class FakeEventDispatcher {
    constructor(options) {
      this.options = options;
    }

    register(handlers) {
      this.handlers = handlers;
      return this;
    }
  }

  const runtime = createBotRuntime({
    sdk: {
      Client: FakeClient,
      WSClient: FakeWsClient,
      EventDispatcher: FakeEventDispatcher,
    },
    env: {
      APP_ID: "cli_test",
      APP_SECRET: "secret",
      CACHE_STATE_FILE: cacheStateFile,
    },
    fetchImpl: async () => {
      throw new Error("not used");
    },
  });

  assert.equal(runtime.rankingClient.snapshot.entries[0].name, "persisted-alpha");
  assert.equal(runtime.messageReceiptStore.reserve("om_saved").accepted, false);
});
