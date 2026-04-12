import * as Lark from "@larksuiteoapi/node-sdk";

import { loadRuntimeConfig } from "./config.js";
import { createMessageHandler } from "./feishu-bot.js";
import { MessageReceiptStore } from "./message-receipt-store.js";
import { PersistedBotState } from "./persisted-bot-state.js";
import { RankingClient } from "./ranking-client.js";

export function createBotRuntime({
  sdk = Lark,
  env = process.env,
  fetchImpl = globalThis.fetch,
  logger = console,
  processRef = process,
} = {}) {
  const config = loadRuntimeConfig(env);
  const baseConfig = {
    appId: config.appId,
    appSecret: config.appSecret,
    domain: config.domain,
  };

  const feishuClient = new sdk.Client(baseConfig);
  const wsClient = new sdk.WSClient(baseConfig);
  const stateStore = new PersistedBotState({
    filePath: config.cacheStateFile,
    logger,
  });
  const persistedState = stateStore.loadState();
  const rankingClient = new RankingClient({
    baseUrl: config.aistupidBaseUrl,
    fetchImpl,
    rankLimit: config.rankLimit,
    initialSnapshot: persistedState.rankingSnapshot,
    onSnapshotChange: (snapshot) => stateStore.updateRankingSnapshot(snapshot),
  });
  const messageReceiptStore = new MessageReceiptStore({
    initialDoneReceipts: persistedState.doneReceipts,
    onChange: (doneReceipts) => stateStore.updateDoneReceipts(doneReceipts),
  });
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
    persistedState,
    rankingClient,
    stateStore,
    processRef,
    wsClient,
  };
}

export function startBot(options) {
  const runtime = createBotRuntime(options);
  runtime.stateStore.installProcessHooks(runtime.processRef);

  runtime.wsClient.start({
    eventDispatcher: runtime.eventDispatcher,
  });

  return runtime;
}
