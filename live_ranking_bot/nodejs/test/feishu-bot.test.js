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

test("uses create message for direct chat ranking command", async () => {
  const feishu = createFeishuClientStub();
  const rankingClient = {
    fetchRanking: async () => ({
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
        globalScore: 84,
        trend: "stable",
        updatedAt: "2026-04-12T03:20:43.338Z",
      },
    }),
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
    fetchRanking: async () => ({
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
        globalScore: 84,
        trend: "stable",
        updatedAt: "2026-04-12T03:20:43.338Z",
      },
    }),
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
      content: JSON.stringify({ text: "/leaderboard" }),
    },
  });

  assert.equal(feishu.createCalls.length, 0);
  assert.equal(feishu.replyCalls.length, 1);
  assert.equal(feishu.replyCalls[0].path.message_id, "om_group");
  assert.match(parseTextContent(feishu.replyCalls[0]), /AI Stupid Meter Live Ranking/);
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
