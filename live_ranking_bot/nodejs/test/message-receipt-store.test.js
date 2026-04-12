import test from "node:test";
import assert from "node:assert/strict";

import { MessageReceiptStore } from "../src/message-receipt-store.js";

test("restores unexpired done receipts and exposes a persistable snapshot", () => {
  const store = new MessageReceiptStore({
    now: () => 1_000,
    initialDoneReceipts: [
      {
        messageId: "om_saved",
        state: "done",
        expiresAt: 2_000,
      },
      {
        messageId: "om_expired",
        state: "done",
        expiresAt: 999,
      },
    ],
  });

  assert.equal(store.reserve("om_saved").accepted, false);
  assert.equal(store.reserve("om_new").accepted, true);
  assert.deepEqual(store.snapshotDoneReceipts(), [
    {
      messageId: "om_saved",
      state: "done",
      expiresAt: 2_000,
    },
  ]);
});

test("emits done-receipt snapshots after markDone and clear", () => {
  const snapshots = [];
  const store = new MessageReceiptStore({
    now: () => 1_000,
    onChange: (doneReceipts) => snapshots.push(doneReceipts),
  });

  store.markDone("om_saved");
  store.clear("om_saved");

  assert.deepEqual(snapshots, [
    [
      {
        messageId: "om_saved",
        state: "done",
        expiresAt: 901_000,
      },
    ],
    [],
  ]);
});
