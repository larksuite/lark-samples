import * as Lark from "@larksuiteoapi/node-sdk";

import { loadRuntimeConfig } from "./config.js";
import { createMessageHandler } from "./feishu-bot.js";
import { MessageReceiptStore } from "./message-receipt-store.js";
import { RankingClient } from "./ranking-client.js";

export function createBotRuntime({
  sdk = Lark,
  env = process.env,
  fetchImpl = globalThis.fetch,
  logger = console,
} = {}) {
  const config = loadRuntimeConfig(env);
  const baseConfig = {
    appId: config.appId,
    appSecret: config.appSecret,
    domain: config.domain,
  };

  const feishuClient = new sdk.Client(baseConfig);
  const wsClient = new sdk.WSClient(baseConfig);
  const rankingClient = new RankingClient({
    baseUrl: config.aistupidBaseUrl,
    fetchImpl,
    rankLimit: config.rankLimit,
  });
  const messageReceiptStore = new MessageReceiptStore();
  const eventDispatcher = new sdk.EventDispatcher({}).register({
    "im.message.receive_v1": createMessageHandler({
      botIdentity: {
        openId: config.botOpenId,
        userId: config.botUserId,
      },
      feishuClient,
      messageReceiptStore,
      rankingClient,
      logger,
    }),
  });

  return {
    baseConfig,
    config,
    eventDispatcher,
    feishuClient,
    messageReceiptStore,
    rankingClient,
    wsClient,
  };
}

export function startBot(options) {
  const runtime = createBotRuntime(options);

  runtime.wsClient.start({
    eventDispatcher: runtime.eventDispatcher,
  });

  return runtime;
}
