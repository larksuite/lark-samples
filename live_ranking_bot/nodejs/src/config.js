import { DEFAULT_AISTUPID_BASE_URL } from "./ranking-client.js";

const DEFAULT_FEISHU_DOMAIN = "https://open.feishu.cn";

export function loadRuntimeConfig(env = process.env) {
  const appId = env.APP_ID?.trim();
  const appSecret = env.APP_SECRET?.trim();

  if (!appId) {
    throw new Error("APP_ID is required");
  }

  if (!appSecret) {
    throw new Error("APP_SECRET is required");
  }

  return {
    appId,
    appSecret,
    domain: env.BASE_DOMAIN?.trim() || DEFAULT_FEISHU_DOMAIN,
    aistupidBaseUrl:
      env.AISTUPID_BASE_URL?.trim() || DEFAULT_AISTUPID_BASE_URL,
    botOpenId: trimOptionalValue(env.BOT_OPEN_ID),
    botUserId: trimOptionalValue(env.BOT_USER_ID),
    rankLimit: parseRankLimit(env.RANK_LIMIT),
  };
}

function parseRankLimit(value) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 10;
  }

  return parsed;
}

function trimOptionalValue(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
