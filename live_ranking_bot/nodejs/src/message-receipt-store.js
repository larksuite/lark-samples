export const DEFAULT_RECEIPT_TTL_MS = 15 * 60 * 1000;

export class MessageReceiptStore {
  constructor({
    ttlMs = DEFAULT_RECEIPT_TTL_MS,
    now = () => Date.now(),
    initialDoneReceipts = [],
    onChange = null,
  } = {}) {
    this.ttlMs = ttlMs;
    this.now = now;
    this.onChange = typeof onChange === "function" ? onChange : null;
    this.receipts = new Map();
    this.restoreDoneReceipts(initialDoneReceipts);
  }

  reserve(messageId) {
    if (!isTrackedMessageId(messageId)) {
      return { accepted: true, tracked: false };
    }

    this.cleanupExpired({ notify: true });

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
    this.emitChange();
  }

  clear(messageId) {
    if (!isTrackedMessageId(messageId)) {
      return;
    }

    if (this.receipts.delete(messageId)) {
      this.emitChange();
    }
  }

  cleanupExpired({ notify = false } = {}) {
    const now = this.now();
    let removed = false;

    for (const [messageId, receipt] of this.receipts.entries()) {
      if (receipt.expiresAt <= now) {
        this.receipts.delete(messageId);
        removed = true;
      }
    }

    if (removed && notify) {
      this.emitChange();
    }

    return removed;
  }

  restoreDoneReceipts(doneReceipts) {
    if (!Array.isArray(doneReceipts)) {
      return;
    }

    const now = this.now();

    for (const receipt of doneReceipts) {
      const normalized = normalizeDoneReceipt(receipt, now);
      if (!normalized) {
        continue;
      }

      this.receipts.set(normalized.messageId, {
        state: "done",
        expiresAt: normalized.expiresAt,
      });
    }
  }

  snapshotDoneReceipts() {
    this.cleanupExpired();

    return Array.from(this.receipts.entries())
      .filter(([, receipt]) => receipt.state === "done")
      .map(([messageId, receipt]) => ({
        messageId,
        state: "done",
        expiresAt: receipt.expiresAt,
      }))
      .sort((left, right) => left.messageId.localeCompare(right.messageId));
  }

  emitChange() {
    this.onChange?.(this.snapshotDoneReceipts());
  }
}

function isTrackedMessageId(messageId) {
  return typeof messageId === "string" && messageId.trim().length > 0;
}

function normalizeDoneReceipt(receipt, nowMs) {
  const messageId =
    typeof receipt?.messageId === "string" ? receipt.messageId.trim() : "";
  const expiresAt = Number(receipt?.expiresAt);

  if (!messageId || receipt?.state !== "done" || !Number.isFinite(expiresAt)) {
    return null;
  }

  if (expiresAt <= nowMs) {
    return null;
  }

  return {
    messageId,
    expiresAt,
  };
}
