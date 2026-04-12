import { parseCommand } from "./commands.js";
import {
  formatRankingMessage,
  formatUnavailableMessage,
  formatUsageMessage,
} from "./formatter.js";

export function createMessageHandler({
  feishuClient,
  rankingClient,
  logger = console,
}) {
  return async function handleMessageEvent(data) {
    const message = data?.message;

    if (!message) {
      return;
    }

    const parsedText = parseMessageText(message);

    if (!parsedText.ok) {
      await sendTextMessage({
        feishuClient,
        message,
        text: formatUsageMessage(),
      });
      return;
    }

    const command = parseCommand(parsedText.text);

    if (command === null) {
      return;
    }

    if (command.type === "unsupported") {
      await sendTextMessage({
        feishuClient,
        message,
        text: formatUsageMessage(),
      });
      return;
    }

    try {
      const ranking = await rankingClient.fetchRanking();

      await sendTextMessage({
        feishuClient,
        message,
        text: formatRankingMessage(ranking),
      });
    } catch (error) {
      logger.error?.("Failed to fetch ranking", error);

      await sendTextMessage({
        feishuClient,
        message,
        text: formatUnavailableMessage(),
      });
    }
  };
}

function parseMessageText(message) {
  if (message.message_type !== "text") {
    return { ok: false };
  }

  try {
    const payload = JSON.parse(message.content);

    if (typeof payload.text !== "string") {
      return { ok: false };
    }

    return {
      ok: true,
      text: payload.text.trim().replace(/\s+/g, " "),
    };
  } catch (error) {
    return { ok: false };
  }
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
