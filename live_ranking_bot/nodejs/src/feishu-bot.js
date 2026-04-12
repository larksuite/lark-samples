import { normalizeWhitespace, parseCommand } from "./commands.js";
import {
  formatRankingMessage,
  formatUnavailableMessage,
  formatUsageMessage,
} from "./formatter.js";
import { MessageReceiptStore } from "./message-receipt-store.js";

export function createMessageHandler({
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
      const commandContext = extractCommandContext(message);

      if (!commandContext.ok) {
        await sendManagedTextMessage({
          feishuClient,
          message,
          messageReceiptStore,
          onSuccess: "done",
          text: formatUsageMessage(),
        });
        return;
      }

      if (commandContext.command === null) {
        messageReceiptStore.markDone(message.message_id);
        return;
      }

      if (commandContext.command.type === "unsupported") {
        await sendManagedTextMessage({
          feishuClient,
          message,
          messageReceiptStore,
          onSuccess: "done",
          text: formatUsageMessage(),
        });
        return;
      }

      try {
        const ranking = await rankingClient.fetchRanking();

        await sendManagedTextMessage({
          feishuClient,
          message,
          messageReceiptStore,
          onSuccess: "done",
          text: formatRankingMessage(ranking),
        });
      } catch (error) {
        logger.error?.("Failed to fetch ranking", error);

        await sendManagedTextMessage({
          feishuClient,
          message,
          messageReceiptStore,
          onSuccess: "clear",
          text: formatUnavailableMessage(),
        });
      }
    } catch (error) {
      messageReceiptStore.clear(message.message_id);
      logger.error?.("Failed to handle incoming message", error);
    }
  };
}

function extractCommandContext(message) {
  const isGroupChat = message.chat_type !== "p2p";
  const hasMentionSignal = hasMentionedBotSignal(message);

  if (isGroupChat && !hasMentionSignal) {
    return { ok: true, command: null };
  }

  if (message.message_type !== "text") {
    return { ok: false };
  }

  try {
    const payload = JSON.parse(message.content);

    if (typeof payload.text !== "string") {
      return { ok: false };
    }

    const strippedText = stripMentionMarkup(payload.text);
    const normalizedText = normalizeWhitespace(strippedText);

    if (isGroupChat && !normalizedText.startsWith("/")) {
      return { ok: true, command: null };
    }

    return {
      ok: true,
      command: parseCommand(normalizedText),
    };
  } catch (error) {
    return { ok: false };
  }
}

function hasMentionedBotSignal(message) {
  if (Array.isArray(message.mentions) && message.mentions.length > 0) {
    return true;
  }

  return typeof message.content === "string" && /<at\b/i.test(message.content);
}

function stripMentionMarkup(text) {
  return text.replace(/<at\b[^>]*>.*?<\/at>/gis, " ");
}

async function sendManagedTextMessage({
  feishuClient,
  message,
  messageReceiptStore,
  onSuccess,
  text,
}) {
  await sendTextMessage({
    feishuClient,
    message,
    text,
  });

  if (onSuccess === "clear") {
    messageReceiptStore.clear(message.message_id);
    return;
  }

  messageReceiptStore.markDone(message.message_id);
}

async function sendTextMessage({ feishuClient, message, text }) {
  const content = JSON.stringify({ text });

  if (message.chat_type === "p2p") {
    await feishuClient.im.v1.message.create({
      params: {
        receive_id_type: "chat_id",
      },
      data: {
        receive_id: message.chat_id,
        content,
        msg_type: "text",
      },
    });
    return;
  }

  await feishuClient.im.v1.message.reply({
    path: {
      message_id: message.message_id,
    },
    data: {
      content,
      msg_type: "text",
    },
  });
}
