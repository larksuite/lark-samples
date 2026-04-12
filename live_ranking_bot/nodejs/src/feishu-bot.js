import { normalizeWhitespace, parseCommand } from "./commands.js";
import {
  formatRankingMessage,
  formatUnavailableMessage,
  formatUsageMessage,
} from "./formatter.js";
import { MessageReceiptStore } from "./message-receipt-store.js";

const LEADING_MENTION_PATTERN = /^\s*<at\b([^>]*)>.*?<\/at>\s*/is;

export function createMessageHandler({
  botIdentity = {},
  feishuClient,
  messageReceiptStore = new MessageReceiptStore(),
  rankingClient,
  logger = console,
}) {
  return async function handleMessageEvent(data) {
    const message = data?.message;

    if (!message) {
      return;
    }

    const reservation = messageReceiptStore.reserve(message.message_id);
    if (!reservation.accepted) {
      return;
    }

    try {
      const commandContext = extractCommandContext(message, botIdentity);

      if (!commandContext.ok) {
        await sendTextMessage({
          feishuClient,
          message,
          text: formatUsageMessage(),
        });
        messageReceiptStore.markDone(message.message_id);
        return;
      }

      if (commandContext.command === null) {
        messageReceiptStore.markDone(message.message_id);
        return;
      }

      let responseText = formatUsageMessage();

      if (commandContext.command.type === "ranking") {
        try {
          const ranking = await rankingClient.fetchRanking();
          responseText = formatRankingMessage(ranking);
        } catch (error) {
          logger.error?.("Failed to fetch ranking", error);
          responseText = formatUnavailableMessage();
        }
      }

      await sendTextMessage({
        feishuClient,
        message,
        text: responseText,
      });
      messageReceiptStore.markDone(message.message_id);
    } catch (error) {
      messageReceiptStore.clear(message.message_id);
      logger.error?.("Failed to handle incoming message", error);
    }
  };
}

function extractCommandContext(message, botIdentity) {
  const isGroupChat = message.chat_type !== "p2p";

  if (message.message_type !== "text") {
    if (isGroupChat && !shouldInspectGroupMessage(message, botIdentity)) {
      return { ok: true, command: null };
    }

    return { ok: false };
  }

  let payload;
  try {
    payload = JSON.parse(message.content);
  } catch (error) {
    if (isGroupChat && !shouldInspectGroupMessage(message, botIdentity)) {
      return { ok: true, command: null };
    }

    return { ok: false };
  }

  if (typeof payload.text !== "string") {
    if (isGroupChat && !shouldInspectGroupMessage(message, botIdentity)) {
      return { ok: true, command: null };
    }

    return { ok: false };
  }

  const strippedMentions = stripLeadingMentionMarkup(payload.text);
  const normalizedText = normalizeWhitespace(strippedMentions.text);

  if (isGroupChat) {
    if (!strippedMentions.hadLeadingMention) {
      return { ok: true, command: null };
    }

    if (
      !groupMessageTargetsBot({
        botIdentity,
        leadingMentions: strippedMentions.mentions,
        message,
      })
    ) {
      return { ok: true, command: null };
    }

    if (!normalizedText.startsWith("/")) {
      return { ok: true, command: null };
    }
  }

  return {
    ok: true,
    command: parseCommand(normalizedText),
  };
}

function shouldInspectGroupMessage(message, botIdentity) {
  if (hasConfiguredBotIdentity(botIdentity)) {
    return hasConfiguredBotMention(message, botIdentity);
  }

  return hasAnyMentionSignal(message);
}

function groupMessageTargetsBot({ botIdentity, leadingMentions, message }) {
  if (!hasConfiguredBotIdentity(botIdentity)) {
    return true;
  }

  if (leadingMentions.some((mention) => matchesBotIdentity(mention, botIdentity))) {
    return true;
  }

  return hasConfiguredBotMention(message, botIdentity);
}

function hasConfiguredBotMention(message, botIdentity) {
  if (!Array.isArray(message.mentions)) {
    return false;
  }

  return message.mentions.some((mention) =>
    matchesBotIdentity(mention?.id ?? {}, botIdentity),
  );
}

function hasAnyMentionSignal(message) {
  if (Array.isArray(message.mentions) && message.mentions.length > 0) {
    return true;
  }

  return typeof message.content === "string" && /<at\b/i.test(message.content);
}

function hasConfiguredBotIdentity(botIdentity) {
  return Boolean(botIdentity?.openId || botIdentity?.userId);
}

function matchesBotIdentity(candidate, botIdentity) {
  if (botIdentity?.openId && candidate?.openId === botIdentity.openId) {
    return true;
  }

  if (botIdentity?.userId && candidate?.userId === botIdentity.userId) {
    return true;
  }

  return false;
}

function stripLeadingMentionMarkup(text) {
  const mentions = [];
  let remainingText = text;

  while (true) {
    const match = remainingText.match(LEADING_MENTION_PATTERN);
    if (!match) {
      break;
    }

    mentions.push(parseMentionAttributes(match[1]));
    remainingText = remainingText.slice(match[0].length);
  }

  return {
    hadLeadingMention: mentions.length > 0,
    mentions,
    text: remainingText,
  };
}

function parseMentionAttributes(rawAttributes = "") {
  const mention = {};
  const attributePattern = /([a-z_]+)=(?:"([^"]*)"|'([^']*)')/gi;
  let match;

  while ((match = attributePattern.exec(rawAttributes)) !== null) {
    const [, name, doubleQuotedValue, singleQuotedValue] = match;
    const value = doubleQuotedValue ?? singleQuotedValue ?? "";

    if (name === "user_id") {
      mention.userId = value;
    }

    if (name === "open_id") {
      mention.openId = value;
    }

    if (name === "union_id") {
      mention.unionId = value;
    }
  }

  return mention;
}

async function sendTextMessage({ feishuClient, message, text }) {
  const content = JSON.stringify({ text });

  await feishuClient.im.v1.message.create({
    params: {
      receive_id_type: "chat_id",
    },
    data: {
      receive_id: message.chat_id,
      content,
      msg_type: "text",
      uuid: buildOutboundUuid(message.message_id),
    },
  });
}

function buildOutboundUuid(messageId) {
  if (typeof messageId !== "string" || messageId.trim().length === 0) {
    return undefined;
  }

  return `lazybot:${messageId}`;
}
