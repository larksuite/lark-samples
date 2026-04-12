export const DEFAULT_RECEIPT_TTL_MS = 15 * 60 * 1000;

export class MessageReceiptStore {
  constructor({
    ttlMs = DEFAULT_RECEIPT_TTL_MS,
    now = () => Date.now(),
  } = {}) {
    this.ttlMs = ttlMs;
    this.now = now;
    this.receipts = new Map();
  }

  reserve(messageId) {
    if (!isTrackedMessageId(messageId)) {
      return { accepted: true, tracked: false };
    }

    this.cleanupExpired();

    const existing = this.receipts.get(messageId);
    if (existing) {
      return {
        accepted: false,
        tracked: true,
        state: existing.state,
      };
    }

    this.receipts.set(messageId, {
      state: "inflight",
      expiresAt: this.now() + this.ttlMs,
    });

    return {
      accepted: true,
      tracked: true,
      state: "inflight",
    };
  }

  markDone(messageId) {
    if (!isTrackedMessageId(messageId)) {
      return;
    }

    this.cleanupExpired();
    this.receipts.set(messageId, {
      state: "done",
      expiresAt: this.now() + this.ttlMs,
    });
  }

  clear(messageId) {
    if (!isTrackedMessageId(messageId)) {
      return;
    }

    this.receipts.delete(messageId);
  }

  cleanupExpired() {
    const now = this.now();

    for (const [messageId, receipt] of this.receipts.entries()) {
      if (receipt.expiresAt <= now) {
        this.receipts.delete(messageId);
      }
    }
  }
}

function isTrackedMessageId(messageId) {
  return typeof messageId === "string" && messageId.trim().length > 0;
}
