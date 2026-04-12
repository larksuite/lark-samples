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

function parseTextContent(request) {
  return JSON.parse(request.data.content).text;
}

function createBotMention(overrides = {}) {
  const base = {
    key: "@_user_1",
    name: "今天你的大模型变笨了吗",
    id: {
      open_id: "ou_bot",
      user_id: "cli_bot",
    },
  };

  return {
    ...base,
    ...overrides,
    id: {
      ...base.id,
      ...(overrides.id ?? {}),
    },
  };
}

function createDirectMessage({
  chatId = "oc_direct",
  messageId = "om_direct",
  messageType = "text",
  content = JSON.stringify({ text: "/rank" }),
} = {}) {
  return {
    chat_id: chatId,
    message_id: messageId,
    message_type: messageType,
    chat_type: "p2p",
    content,
  };
}

function createGroupMessage({
  chatId = "oc_group",
  messageId = "om_group",
  mentions = [createBotMention()],
  text = "@今天你的大模型变笨了吗 /rank",
  messageType = "text",
  content = JSON.stringify({ text }),
} = {}) {
  return {
    chat_id: chatId,
    message_id: messageId,
    message_type: messageType,
    chat_type: "group",
    mentions,
    content,
  };
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
    message: createDirectMessage(),
  });

  assert.equal(feishu.createCalls.length, 1);
  assert.equal(feishu.replyCalls.length, 0);
  assert.equal(feishu.createCalls[0].params.receive_id_type, "chat_id");
  assert.equal(feishu.createCalls[0].data.receive_id, "oc_direct");
  assert.equal(feishu.createCalls[0].data.uuid, "lazybot:om_direct");
  assert.match(parseTextContent(feishu.createCalls[0]), /AI Stupid Meter Live Ranking/);
});

test("uses direct create message for group commands with the bot display name", async () => {
  const feishu = createFeishuClientStub();
  const rankingClient = {
    fetchRanking: async () => createRankingFixture(),
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
  });

  await handler({
    message: createGroupMessage({
      messageId: "om_group_name",
      text: "@今天你的大模型变笨了吗 /leaderboard",
    }),
  });

  assert.equal(feishu.createCalls.length, 1);
  assert.equal(feishu.replyCalls.length, 0);
  assert.equal(feishu.createCalls[0].params.receive_id_type, "chat_id");
  assert.equal(feishu.createCalls[0].data.receive_id, "oc_group");
  assert.equal(feishu.createCalls[0].data.uuid, "lazybot:om_group_name");
  assert.match(parseTextContent(feishu.createCalls[0]), /AI Stupid Meter Live Ranking/);
});

test("supports group commands when receive events use mention keys", async () => {
  const feishu = createFeishuClientStub();
  const rankingClient = {
    fetchRanking: async () => createRankingFixture(),
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
  });

  await handler({
    message: createGroupMessage({
      messageId: "om_group_key",
      text: "@_user_1 /rank",
    }),
  });

  assert.equal(feishu.createCalls.length, 1);
  assert.equal(feishu.replyCalls.length, 0);
  assert.match(parseTextContent(feishu.createCalls[0]), /AI Stupid Meter Live Ranking/);
});

test("matches configured bot identity from Feishu mention ids", async () => {
  const feishu = createFeishuClientStub();
  const rankingClient = {
    fetchRanking: async () => createRankingFixture(),
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
    botIdentity: {
      openId: "ou_bot",
      userId: "cli_bot",
    },
  });

  await handler({
    message: createGroupMessage({
      messageId: "om_group_strict",
      text: "@今天你的大模型变笨了吗 /rank",
    }),
  });

  assert.equal(feishu.createCalls.length, 1);
  assert.equal(feishu.replyCalls.length, 0);
});

test("supports multiple leading mentions before a ranking command", async () => {
  const feishu = createFeishuClientStub();
  const rankingClient = {
    fetchRanking: async () => createRankingFixture(),
  };
  const otherMention = createBotMention({
    key: "@_user_2",
    name: "另一个人",
    id: {
      open_id: "ou_other",
      user_id: "cli_other",
    },
  });

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
    botIdentity: {
      openId: "ou_bot",
    },
  });

  await handler({
    message: createGroupMessage({
      messageId: "om_group_multiple",
      mentions: [createBotMention(), otherMention],
      text: "@_user_2 @_user_1 /rank",
    }),
  });

  assert.equal(feishu.createCalls.length, 1);
  assert.equal(feishu.replyCalls.length, 0);
});

test("supports full-width separators after the leading mention", async () => {
  const feishu = createFeishuClientStub();
  const rankingClient = {
    fetchRanking: async () => createRankingFixture(),
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
  });

  await handler({
    message: createGroupMessage({
      messageId: "om_group_fullwidth",
      text: "@今天你的大模型变笨了吗：/rank",
    }),
  });

  assert.equal(feishu.createCalls.length, 1);
  assert.equal(feishu.replyCalls.length, 0);
});

test("falls back to legacy at-markup when mentions are missing", async () => {
  const feishu = createFeishuClientStub();
  const rankingClient = {
    fetchRanking: async () => createRankingFixture(),
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
    botIdentity: {
      openId: "ou_bot",
    },
  });

  await handler({
    message: createGroupMessage({
      messageId: "om_group_legacy",
      mentions: undefined,
      text: undefined,
      content: JSON.stringify({
        text: '<at open_id="ou_bot">今天你的大模型变笨了吗</at> /rank',
      }),
    }),
  });

  assert.equal(feishu.createCalls.length, 1);
  assert.equal(feishu.replyCalls.length, 0);
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
    message: createGroupMessage({
      messageId: "om_group_bare",
      mentions: [],
      text: "/rank",
    }),
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
    message: createGroupMessage({
      messageId: "om_group_hello",
      text: "@今天你的大模型变笨了吗 hello there",
    }),
  });

  assert.equal(feishu.createCalls.length, 0);
  assert.equal(feishu.replyCalls.length, 0);
});

test("ignores group slash commands that mention another user when bot identity is configured", async () => {
  const feishu = createFeishuClientStub();
  const rankingClient = {
    fetchRanking: async () => {
      throw new Error("should not fetch ranking");
    },
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
    botIdentity: {
      openId: "ou_bot",
    },
  });

  await handler({
    message: createGroupMessage({
      messageId: "om_group_other_user",
      mentions: [
        createBotMention({
          key: "@_user_2",
          name: "someone-else",
          id: { open_id: "ou_other" },
        }),
      ],
      text: "@someone-else /rank",
    }),
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
    message: createDirectMessage({
      content: JSON.stringify({ text: "/help" }),
    }),
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
    message: createGroupMessage({
      messageId: "om_group_help",
      text: "@今天你的大模型变笨了吗 /help",
    }),
  });

  assert.equal(feishu.createCalls.length, 1);
  assert.equal(feishu.replyCalls.length, 0);
  assert.equal(feishu.createCalls[0].data.receive_id, "oc_group");
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
    message: createDirectMessage({
      messageType: "image",
      content: JSON.stringify({ image_key: "img-key" }),
    }),
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
    message: createDirectMessage({
      messageId: "om_direct_bad_json",
      content: "{",
    }),
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
    message: createDirectMessage({
      content: JSON.stringify({ text: "hello there" }),
    }),
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
    message: createDirectMessage({
      messageId: "om_inflight",
    }),
  });
  const second = handler({
    message: createDirectMessage({
      messageId: "om_inflight",
    }),
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

  const message = createDirectMessage({
    messageId: "om_done",
  });

  await handler({ message });
  await handler({ message });

  assert.equal(fetchCalls, 1);
  assert.equal(feishu.createCalls.length, 1);
});

test("does not send the unavailable message twice for the same message id", async () => {
  const feishu = createFeishuClientStub();
  let fetchCalls = 0;
  const rankingClient = {
    fetchRanking: async () => {
      fetchCalls += 1;
      throw new Error("upstream unavailable");
    },
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
    logger: { debug() {}, error() {} },
  });

  const message = createDirectMessage({
    messageId: "om_retry",
  });

  await handler({ message });
  await handler({ message });

  assert.equal(fetchCalls, 1);
  assert.equal(feishu.createCalls.length, 1);
  assert.match(parseTextContent(feishu.createCalls[0]), /Ranking unavailable right now/);
});

test("retries the same message id after outbound send failure", async () => {
  const feishu = createFeishuClientStub();
  const rankingClient = {
    fetchRanking: async () => createRankingFixture(),
  };
  let sendCalls = 0;
  feishu.client.im.v1.message.create = async (payload) => {
    sendCalls += 1;
    if (sendCalls === 1) {
      throw new Error("socket hang up");
    }
    feishu.createCalls.push(payload);
  };

  const handler = createMessageHandler({
    feishuClient: feishu.client,
    rankingClient,
    logger: { debug() {}, error() {} },
  });

  const message = createDirectMessage({
    messageId: "om_send_retry",
  });

  await handler({ message });
  await handler({ message });

  assert.equal(sendCalls, 2);
  assert.equal(feishu.createCalls.length, 1);
});
