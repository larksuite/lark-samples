const SUPPORTED_COMMANDS = new Set(["/rank", "/leaderboard"]);

export function parseCommand(input) {
  if (typeof input !== "string") {
    return null;
  }

  const normalized = normalizeWhitespace(input);

  if (!normalized.startsWith("/")) {
    return null;
  }

  const [command] = normalized.split(" ");
  const lowered = command.toLowerCase();

  if (SUPPORTED_COMMANDS.has(lowered)) {
    return {
      type: "ranking",
      command: lowered,
    };
  }

  return {
    type: "unsupported",
    command: lowered,
  };
}

export function normalizeWhitespace(input) {
  return input.trim().replace(/\s+/g, " ");
}

export function getSupportedCommands() {
  return Array.from(SUPPORTED_COMMANDS);
}
