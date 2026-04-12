import test from "node:test";
import assert from "node:assert/strict";

import { createBotRuntime } from "../src/app.js";

test("creates bot runtime with SDK wiring", () => {
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
      RANK_LIMIT: "5",
    },
    fetchImpl: async () => {
      throw new Error("not used");
    },
  });

  assert.equal(runtime.baseConfig.appId, "cli_test");
  assert.equal(runtime.baseConfig.appSecret, "secret");
  assert.equal(runtime.baseConfig.domain, "https://open.feishu.cn");
  assert.equal(runtime.config.rankLimit, 5);
  assert.ok(runtime.feishuClient instanceof FakeClient);
  assert.ok(runtime.wsClient instanceof FakeWsClient);
  assert.ok(runtime.eventDispatcher instanceof FakeEventDispatcher);
  assert.equal(typeof runtime.messageReceiptStore.reserve, "function");
  assert.equal(
    typeof runtime.eventDispatcher.handlers["im.message.receive_v1"],
    "function",
  );
});
