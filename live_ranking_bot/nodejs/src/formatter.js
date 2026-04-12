import { getSupportedCommands } from "./commands.js";

export function formatRankingMessage({ entries, summary }) {
  const lines = [
    "AI Stupid Meter Live Ranking",
    `Summary: ${summary.snapshot}`,
    `Updated: ${formatUtcTimestamp(summary.updatedAt)}`,
    "",
  ];

  entries.forEach((entry, index) => {
    lines.push(
      `${index + 1}. ${entry.name} - ${entry.score} (${entry.provider}, ${entry.trend}/${entry.status})`,
    );
  });

  return lines.join("\n");
}

export function formatUsageMessage() {
  const supportedCommands = getSupportedCommands();

  return [
    "Supported commands:",
    `${supportedCommands[0]} - show the live AI ranking`,
    `${supportedCommands[1]} - show the live AI ranking`,
  ].join("\n");
}

export function formatUnavailableMessage() {
  return "Ranking unavailable right now. Please try again in a moment.";
}

export function formatUtcTimestamp(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute} UTC`;
}
