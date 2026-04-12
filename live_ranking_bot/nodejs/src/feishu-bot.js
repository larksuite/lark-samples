import { normalizeWhitespace, parseCommand } from "./commands.js";
import {
  formatRankingMessage,
  formatUnavailableMessage,
  formatUsageMessage,
} from "./formatter.js";
import { MessageReceiptStore } from "./message-receipt-store.js";

const LEADING_MENTION_PATTERN = /^\s*<at\b([^>]*)>.*?<\/at>\s*/is;
const LEADING_SEPARATOR_PATTERN = /^[\s\u3000:：]+/u;

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
      const commandContext = extractCommandContext({
        botIdentity,
        logger,
        message,
      });

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

      if (commandContext.command.type === "unsupported") {
        logDebug(logger, "Unsupported slash command", {
          chatId: message.chat_id,
          messageId: message.message_id,
          normalizedText: commandContext.normalizedText,
        });

        await sendTextMessage({
          feishuClient,
          message,
          text: formatUsageMessage(),
        });
        messageReceiptStore.markDone(message.message_id);
        return;
      }

      let responseText;

      try {
        const ranking = await rankingClient.fetchRanking();
        responseText = formatRankingMessage(ranking);
      } catch (error) {
        logger.error?.("Failed to fetch ranking", {
          chatId: message.chat_id,
          error: error?.message ?? String(error),
          messageId: message.message_id,
        });
        responseText = formatUnavailableMessage();
      }

      await sendTextMessage({
        feishuClient,
        message,
        text: responseText,
      });
      messageReceiptStore.markDone(message.message_id);
    } catch (error) {
      messageReceiptStore.clear(message.message_id);
      logger.error?.("Failed to handle incoming message", {
        chatId: message?.chat_id,
        error: error?.message ?? String(error),
        messageId: message?.message_id,
      });
    }
  };
}

function extractCommandContext({ botIdentity, logger, message }) {
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

  const strippedMentions = stripLeadingMentions({
    mentions: message.mentions,
    text: payload.text,
  });
  const normalizedText = normalizeWhitespace(strippedMentions.text);
  const parsedCommand = parseCommand(normalizedText);

  if (isGroupChat) {
    if (!strippedMentions.hadLeadingMention) {
      logDebug(logger, "Ignoring group message without a leading mention token", {
        chatId: message.chat_id,
        messageId: message.message_id,
      });
      return { ok: true, command: null };
    }

    if (
      !groupMessageTargetsBot({
        botIdentity,
        leadingMentions: strippedMentions.mentions,
        message,
      })
    ) {
      logDebug(
        logger,
        "Ignoring group message because mentions did not match the configured bot identity",
        {
          chatId: message.chat_id,
          messageId: message.message_id,
        },
      );
      return { ok: true, command: null };
    }

    if (parsedCommand === null) {
      logDebug(logger, "Ignoring group message because normalized text is not a supported slash command", {
        chatId: message.chat_id,
        messageId: message.message_id,
        normalizedText,
      });
      return { ok: true, command: null };
    }
  }

  return {
    ok: true,
    command: parsedCommand,
    normalizedText,
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
    matchesBotIdentity(mention, botIdentity),
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
  const normalized = normalizeMentionIdentity(candidate);

  if (botIdentity?.openId && normalized.openId === botIdentity.openId) {
    return true;
  }

  if (botIdentity?.userId && normalized.userId === botIdentity.userId) {
    return true;
  }

  return false;
}

function stripLeadingMentions({ mentions, text }) {
  const leadingMentions = stripLeadingMentionTokens(text, mentions);
  if (leadingMentions.hadLeadingMention) {
    return leadingMentions;
  }

  return stripLeadingMentionMarkup(text);
}

function stripLeadingMentionTokens(text, mentions) {
  const normalizedMentions = normalizeMentions(mentions);
  const leadingMentions = [];
  let remainingText = text;

  while (true) {
    const match = consumeLeadingMentionToken(remainingText, normalizedMentions);
    if (!match) {
      break;
    }

    leadingMentions.push(match.mention);
    remainingText = match.remainingText;
  }

  return {
    hadLeadingMention: leadingMentions.length > 0,
    mentions: leadingMentions,
    text: remainingText,
  };
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
    remainingText = remainingText.replace(LEADING_SEPARATOR_PATTERN, "");
  }

  return {
    hadLeadingMention: mentions.length > 0,
    mentions,
    text: remainingText,
  };
}

function consumeLeadingMentionToken(text, mentions) {
  const leadingWhitespaceLength = text.match(/^\s*/u)?.[0].length ?? 0;
  const trimmedText = text.slice(leadingWhitespaceLength);

  for (const mention of mentions) {
    for (const token of mention.tokens) {
      if (!token || !trimmedText.startsWith(token)) {
        continue;
      }

      const nextCharacter = trimmedText[token.length] ?? "";
      if (!isMentionBoundary(nextCharacter)) {
        continue;
      }

      return {
        mention,
        remainingText: trimmedText
          .slice(token.length)
          .replace(LEADING_SEPARATOR_PATTERN, ""),
      };
    }
  }

  return null;
}

function normalizeMentions(mentions) {
  if (!Array.isArray(mentions)) {
    return [];
  }

  return mentions
    .map((mention) => {
      const normalizedIdentity = normalizeMentionIdentity(mention);
      const tokens = buildMentionTokens(mention);

      if (tokens.length === 0) {
        return null;
      }

      return {
        ...normalizedIdentity,
        tokens,
      };
    })
    .filter(Boolean);
}

function buildMentionTokens(mention) {
  const rawTokens = new Set();

  if (typeof mention?.key === "string" && mention.key.trim().length > 0) {
    rawTokens.add(mention.key.trim());
  }

  if (typeof mention?.name === "string" && mention.name.trim().length > 0) {
    rawTokens.add(`@${mention.name.trim()}`);
  }

  return Array.from(rawTokens).sort((left, right) => right.length - left.length);
}

function isMentionBoundary(value) {
  return value === "" || /\s/u.test(value) || value === ":" || value === "：";
}

function normalizeMentionIdentity(value) {
  return {
    openId:
      value?.openId ??
      value?.open_id ??
      value?.id?.open_id ??
      value?.id?.openId ??
      null,
    userId:
      value?.userId ??
      value?.user_id ??
      value?.id?.user_id ??
      value?.id?.userId ??
      null,
    unionId:
      value?.unionId ??
      value?.union_id ??
      value?.id?.union_id ??
      value?.id?.unionId ??
      null,
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

function logDebug(logger, message, details) {
  logger.debug?.(message, details);
}
