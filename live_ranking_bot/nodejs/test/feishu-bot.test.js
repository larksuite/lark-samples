import test from "node:test";
import assert from "node:assert/strict";

import { createMessageHandler } from "../src/feishu-bot.js";

function createFeishuClientStub() {
  const createCalls = [];
  const replyCalls = [];

  return {
    createCalls,
    replyCalls,
    client: {
      im: {
        v1: {
          message: {
            create: async (payload) => {
              createCalls.push(payload);
            },
            reply: async (payload) => {
              replyCalls.push(payload);
            },
          },
        },
      },
    },
  };
}

function parseTextContent(request) {
  return JSON.parse(request.data.content).text;
}

function createRankingFixture() {
  return {
    entries: [
      {
        name: "alpha",
        provider: "openai",
        score: 67,
        trend: "up",
        status: "good",
        lastUpdated: "2026-04-12T03:00:04.636Z",
      },
    ],
    summary: {
      snapshot: "Best for code: alpha (#1), drift alerts 1, degradations 0, confidence 60%",
      updatedAt: "2026-04-12T03:20:43.338Z",
    },
  };
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

test("uses create message for direct chat ranking command", async () => {
  const feishu = createFeishuClientStub();
  const rankingClient = {
    fetchRanking: async () => createRankingFixture(),
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
  });

  await handler({
    message: {
      chat_id: "oc_direct",
      message_id: "om_direct",
      message_type: "text",
      chat_type: "p2p",
      content: JSON.stringify({ text: "/rank" }),
    },
  });

  assert.equal(feishu.createCalls.length, 1);
  assert.equal(feishu.replyCalls.length, 0);
  assert.equal(feishu.createCalls[0].params.receive_id_type, "chat_id");
  assert.equal(feishu.createCalls[0].data.receive_id, "oc_direct");
  assert.match(parseTextContent(feishu.createCalls[0]), /AI Stupid Meter Live Ranking/);
});

test("uses reply message for group chat ranking command", async () => {
  const feishu = createFeishuClientStub();
  const rankingClient = {
    fetchRanking: async () => createRankingFixture(),
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
  });

  await handler({
    message: {
      chat_id: "oc_group",
      message_id: "om_group",
      message_type: "text",
      chat_type: "group",
      mentions: [{ key: "@_user_1", name: "lazybot" }],
      content: JSON.stringify({
        text: '<at user_id="ou_bot">lazybot</at> /leaderboard',
      }),
    },
  });

  assert.equal(feishu.createCalls.length, 0);
  assert.equal(feishu.replyCalls.length, 1);
  assert.equal(feishu.replyCalls[0].path.message_id, "om_group");
  assert.match(parseTextContent(feishu.replyCalls[0]), /AI Stupid Meter Live Ranking/);
});

test("uses create message for direct /leaderboard command", async () => {
  const feishu = createFeishuClientStub();
  const rankingClient = {
    fetchRanking: async () => createRankingFixture(),
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
  });

  await handler({
    message: {
      chat_id: "oc_direct",
      message_id: "om_direct_leaderboard",
      message_type: "text",
      chat_type: "p2p",
      content: JSON.stringify({ text: "/leaderboard" }),
    },
  });

  assert.equal(feishu.createCalls.length, 1);
  assert.equal(feishu.replyCalls.length, 0);
  assert.match(parseTextContent(feishu.createCalls[0]), /AI Stupid Meter Live Ranking/);
});

test("ignores bare group slash commands without a bot mention", async () => {
  const feishu = createFeishuClientStub();
  const rankingClient = {
    fetchRanking: async () => {
      throw new Error("should not fetch ranking");
    },
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
  });

  await handler({
    message: {
      chat_id: "oc_group",
      message_id: "om_group_bare",
      message_type: "text",
      chat_type: "group",
      content: JSON.stringify({ text: "/rank" }),
    },
  });

  assert.equal(feishu.createCalls.length, 0);
  assert.equal(feishu.replyCalls.length, 0);
});

test("ignores group bot mentions that are not slash commands", async () => {
  const feishu = createFeishuClientStub();
  const rankingClient = {
    fetchRanking: async () => {
      throw new Error("should not fetch ranking");
    },
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
  });

  await handler({
    message: {
      chat_id: "oc_group",
      message_id: "om_group_hello",
      message_type: "text",
      chat_type: "group",
      mentions: [{ key: "@_user_1", name: "lazybot" }],
      content: JSON.stringify({
        text: '<at user_id="ou_bot">lazybot</at> hello there',
      }),
    },
  });

  assert.equal(feishu.createCalls.length, 0);
  assert.equal(feishu.replyCalls.length, 0);
});

test("sends usage guidance for unsupported slash commands", async () => {
  const feishu = createFeishuClientStub();
  const rankingClient = {
    fetchRanking: async () => {
      throw new Error("should not fetch ranking");
    },
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
  });

  await handler({
    message: {
      chat_id: "oc_direct",
      message_id: "om_direct",
      message_type: "text",
      chat_type: "p2p",
      content: JSON.stringify({ text: "/help" }),
    },
  });

  assert.equal(feishu.createCalls.length, 1);
  assert.match(parseTextContent(feishu.createCalls[0]), /Supported commands:/);
});

test("sends usage guidance for unsupported slash commands in a mentioned group message", async () => {
  const feishu = createFeishuClientStub();
  const rankingClient = {
    fetchRanking: async () => {
      throw new Error("should not fetch ranking");
    },
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
  });

  await handler({
    message: {
      chat_id: "oc_group",
      message_id: "om_group_help",
      message_type: "text",
      chat_type: "group",
      mentions: [{ key: "@_user_1", name: "lazybot" }],
      content: JSON.stringify({
        text: '<at user_id="ou_bot">lazybot</at> /help',
      }),
    },
  });

  assert.equal(feishu.replyCalls.length, 1);
  assert.match(parseTextContent(feishu.replyCalls[0]), /Supported commands:/);
});

test("sends usage guidance for non-text payloads", async () => {
  const feishu = createFeishuClientStub();
  const rankingClient = {
    fetchRanking: async () => {
      throw new Error("should not fetch ranking");
    },
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
  });

  await handler({
    message: {
      chat_id: "oc_direct",
      message_id: "om_direct",
      message_type: "image",
      chat_type: "p2p",
      content: JSON.stringify({ image_key: "img-key" }),
    },
  });

  assert.equal(feishu.createCalls.length, 1);
  assert.match(parseTextContent(feishu.createCalls[0]), /Supported commands:/);
});

test("sends usage guidance for malformed json text payloads", async () => {
  const feishu = createFeishuClientStub();
  const rankingClient = {
    fetchRanking: async () => {
      throw new Error("should not fetch ranking");
    },
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
  });

  await handler({
    message: {
      chat_id: "oc_direct",
      message_id: "om_direct_bad_json",
      message_type: "text",
      chat_type: "p2p",
      content: "{",
    },
  });

  assert.equal(feishu.createCalls.length, 1);
  assert.match(parseTextContent(feishu.createCalls[0]), /Supported commands:/);
});

test("ignores unrelated non-command text", async () => {
  const feishu = createFeishuClientStub();
  const rankingClient = {
    fetchRanking: async () => {
      throw new Error("should not fetch ranking");
    },
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
  });

  await handler({
    message: {
      chat_id: "oc_direct",
      message_id: "om_direct",
      message_type: "text",
      chat_type: "p2p",
      content: JSON.stringify({ text: "hello there" }),
    },
  });

  assert.equal(feishu.createCalls.length, 0);
  assert.equal(feishu.replyCalls.length, 0);
});

test("ignores duplicate deliveries while the first request is still inflight", async () => {
  const feishu = createFeishuClientStub();
  const ranking = createRankingFixture();
  const pending = createDeferred();
  let fetchCalls = 0;
  const rankingClient = {
    fetchRanking: async () => {
      fetchCalls += 1;
      await pending.promise;
      return ranking;
    },
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
  });

  const first = handler({
    message: {
      chat_id: "oc_direct",
      message_id: "om_inflight",
      message_type: "text",
      chat_type: "p2p",
      content: JSON.stringify({ text: "/rank" }),
    },
  });
  const second = handler({
    message: {
      chat_id: "oc_direct",
      message_id: "om_inflight",
      message_type: "text",
      chat_type: "p2p",
      content: JSON.stringify({ text: "/rank" }),
    },
  });

  await Promise.resolve();

  assert.equal(fetchCalls, 1);
  assert.equal(feishu.createCalls.length, 0);

  pending.resolve();
  await Promise.all([first, second]);

  assert.equal(feishu.createCalls.length, 1);
});

test("ignores duplicate deliveries after a successful reply", async () => {
  const feishu = createFeishuClientStub();
  let fetchCalls = 0;
  const rankingClient = {
    fetchRanking: async () => {
      fetchCalls += 1;
      return createRankingFixture();
    },
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
  });

  const message = {
    chat_id: "oc_direct",
    message_id: "om_done",
    message_type: "text",
    chat_type: "p2p",
    content: JSON.stringify({ text: "/rank" }),
  };

  await handler({ message });
  await handler({ message });

  assert.equal(fetchCalls, 1);
  assert.equal(feishu.createCalls.length, 1);
});

test("retries the same message id after ranking fetch failure", async () => {
  const feishu = createFeishuClientStub();
  let fetchCalls = 0;
  const rankingClient = {
    fetchRanking: async () => {
      fetchCalls += 1;

      if (fetchCalls === 1) {
        throw new Error("upstream unavailable");
      }

      return createRankingFixture();
    },
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
    logger: { error() {} },
  });

  const message = {
    chat_id: "oc_direct",
    message_id: "om_retry",
    message_type: "text",
    chat_type: "p2p",
    content: JSON.stringify({ text: "/rank" }),
  };

  await handler({ message });
  await handler({ message });

  assert.equal(fetchCalls, 2);
  assert.equal(feishu.createCalls.length, 2);
  assert.match(parseTextContent(feishu.createCalls[0]), /Ranking unavailable right now/);
  assert.match(parseTextContent(feishu.createCalls[1]), /AI Stupid Meter Live Ranking/);
});
