import json
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

import main


class FakeMessageSender:
    def __init__(self):
        self.calls = []
        self.failures = 0

    def send_text_message(self, chat_id, message_id, text):
        self.calls.append({"chat_id": chat_id, "message_id": message_id, "text": text})
        if self.failures > 0:
            self.failures -= 1
            self.calls.pop()
            raise RuntimeError("socket hang up")


class FakeLogger:
    def __init__(self):
        self.debug_calls = []
        self.error_calls = []
        self.warn_calls = []

    def debug(self, message, details=None):
        self.debug_calls.append((message, details))

    def error(self, message, details=None):
        self.error_calls.append((message, details))

    def warn(self, message, details=None):
        self.warn_calls.append((message, details))


def create_model_row(**overrides):
    row = {
        "id": "1",
        "name": "alpha",
        "provider": "openai",
        "vendor": "openai",
        "currentScore": 67,
        "score": 67,
        "trend": "up",
        "status": "good",
        "lastUpdated": "2026-04-12T03:00:04.636Z",
    }
    row.update(overrides)
    return row


def create_cached_payload(**overrides):
    payload = {
        "success": True,
        "data": {
            "modelScores": [create_model_row()],
            "recommendations": {"bestForCode": {"name": "alpha", "rank": 1}},
            "driftIncidents": [{"id": 1}, {"id": 2}],
            "degradations": [{"id": 11}],
            "transparencyMetrics": {
                "summary": {
                    "confidence": 60,
                    "lastUpdate": "2026-04-12T03:20:43.338Z",
                }
            },
        },
        "meta": {"cachedAt": "2026-04-12T03:18:10.820Z"},
    }
    for key, value in overrides.items():
        if key == "modelScores":
            payload["data"]["modelScores"] = value
        else:
            payload[key] = value
    return payload


def create_scores_payload(rows=None, **overrides):
    payload = {"success": True, "data": rows or [create_model_row()]}
    payload.update(overrides)
    return payload


def create_ranking_fixture():
    return {
        "entries": [
            {
                "name": "alpha",
                "provider": "openai",
                "score": 67,
                "trend": "up",
                "status": "good",
                "lastUpdated": "2026-04-12T03:00:04.636Z",
            }
        ],
        "summary": {
            "snapshot": "Best for code: alpha (#1), drift alerts 1, degradations 0, confidence 60%",
            "updatedAt": "2026-04-12T03:20:43.338Z",
        },
        "isStale": False,
    }


def create_bot_mention(**overrides):
    mention = {
        "key": "@_user_1",
        "name": "今天你的大模型变笨了吗",
        "id": {"open_id": "ou_bot", "user_id": "cli_bot"},
    }
    mention.update(overrides)
    if "id" in overrides:
        merged = {"open_id": "ou_bot", "user_id": "cli_bot"}
        merged.update(overrides["id"])
        mention["id"] = merged
    return mention


def create_direct_message(**overrides):
    message = {
        "chat_id": "oc_direct",
        "message_id": "om_direct",
        "message_type": "text",
        "chat_type": "p2p",
        "content": json.dumps({"text": "/rank"}),
    }
    message.update(overrides)
    return {"message": message}


def create_group_message(**overrides):
    message = {
        "chat_id": "oc_group",
        "message_id": "om_group",
        "message_type": "text",
        "chat_type": "group",
        "mentions": [create_bot_mention()],
        "content": json.dumps({"text": "@今天你的大模型变笨了吗 /rank"}),
    }
    message.update(overrides)
    return {"message": message}


class ConfigTests(unittest.TestCase):
    def test_loads_required_config_with_defaults(self):
        config = main.load_runtime_config({"APP_ID": "cli_test", "APP_SECRET": "secret"})
        self.assertEqual(config.app_id, "cli_test")
        self.assertEqual(config.app_secret, "secret")
        self.assertEqual(config.domain, "https://open.feishu.cn")
        self.assertEqual(config.aistupid_base_url, "https://aistupidlevel.info")
        self.assertEqual(config.cache_state_file, ".cache/lazybot-state.json")
        self.assertEqual(config.rank_limit, 10)

    def test_optional_config_values(self):
        config = main.load_runtime_config(
            {
                "APP_ID": "cli_test",
                "APP_SECRET": "secret",
                "BOT_OPEN_ID": "ou_bot",
                "BOT_USER_ID": "cli_bot",
                "CACHE_STATE_FILE": "/tmp/lazybot-state.json",
                "RANK_LIMIT": "5",
            }
        )
        self.assertEqual(config.bot_open_id, "ou_bot")
        self.assertEqual(config.bot_user_id, "cli_bot")
        self.assertEqual(config.cache_state_file, "/tmp/lazybot-state.json")
        self.assertEqual(config.rank_limit, 5)

    def test_missing_required_config_raises(self):
        with self.assertRaisesRegex(ValueError, "APP_ID is required"):
            main.load_runtime_config({"APP_SECRET": "secret"})
        with self.assertRaisesRegex(ValueError, "APP_SECRET is required"):
            main.load_runtime_config({"APP_ID": "cli_test"})


class CommandAndFormatterTests(unittest.TestCase):
    def test_parse_command(self):
        self.assertEqual(main.parse_command("/rank"), {"type": "ranking", "command": "/rank"})
        self.assertEqual(
            main.parse_command("   /leaderboard   "),
            {"type": "ranking", "command": "/leaderboard"},
        )
        self.assertEqual(main.parse_command("/help"), {"type": "unsupported", "command": "/help"})
        self.assertIsNone(main.parse_command("rank"))

    def test_formatter(self):
        message = main.format_ranking_message(
            {
                "entries": [
                    {
                        "name": "alpha",
                        "provider": "openai",
                        "score": 67,
                        "trend": "up",
                        "status": "good",
                    }
                ],
                "summary": {
                    "snapshot": "Best for code: alpha (#1), drift alerts 2, degradations 1, confidence 60%",
                    "updatedAt": "2026-04-12T03:20:43.338Z",
                },
                "isStale": True,
            }
        )
        self.assertIn("AI Stupid Meter Live Ranking", message)
        self.assertIn("Data may be stale while the bot refreshes the latest ranking.", message)
        self.assertIn("1. alpha - 67 (openai, up/good)", message)
        self.assertIn("/rank", main.format_usage_message())
        self.assertEqual(
            main.format_unavailable_message(),
            "Ranking unavailable right now. Please try again in a moment.",
        )


class MessageReceiptStoreTests(unittest.TestCase):
    def test_restores_unexpired_done_receipts_and_snapshots(self):
        store = main.MessageReceiptStore(
            now=lambda: 1000,
            initial_done_receipts=[
                {"messageId": "om_saved", "state": "done", "expiresAt": 2000},
                {"messageId": "om_expired", "state": "done", "expiresAt": 999},
            ],
        )
        self.assertFalse(store.reserve("om_saved")["accepted"])
        self.assertTrue(store.reserve("om_new")["accepted"])
        self.assertEqual(
            store.snapshot_done_receipts(),
            [{"messageId": "om_saved", "state": "done", "expiresAt": 2000}],
        )

    def test_emits_change_on_mark_done_and_clear(self):
        snapshots = []
        store = main.MessageReceiptStore(now=lambda: 1000, on_change=snapshots.append)
        store.mark_done("om_saved")
        store.clear("om_saved")
        self.assertEqual(
            snapshots,
            [
                [{"messageId": "om_saved", "state": "done", "expiresAt": 901000}],
                [],
            ],
        )


class PersistedBotStateTests(unittest.TestCase):
    def create_state_file(self):
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        return Path(temp_dir.name) / "state.json"

    def create_snapshot(self):
        return {
            "entries": [
                {
                    "id": "1",
                    "name": "alpha",
                    "provider": "openai",
                    "score": 67,
                    "trend": "up",
                    "status": "good",
                    "lastUpdated": "2026-04-12T03:00:04.636Z",
                }
            ],
            "summary": {
                "snapshot": "Best for code: alpha (#1), drift alerts 0, degradations 0, confidence 60%",
                "updatedAt": "2026-04-12T03:20:43.338Z",
            },
            "storedAtMs": 900,
        }

    def test_loads_empty_when_missing(self):
        state = main.PersistedBotState(file_path=str(self.create_state_file()))
        self.assertEqual(state.load_state(), {"rankingSnapshot": None, "doneReceipts": []})

    def test_saves_and_restores_state(self):
        file_path = self.create_state_file()
        state = main.PersistedBotState(file_path=str(file_path), now=lambda: 1000)
        state.update_ranking_snapshot(self.create_snapshot())
        state.update_done_receipts([{"messageId": "om_saved", "state": "done", "expiresAt": 2000}])
        state.flush_now()

        restored = main.PersistedBotState(file_path=str(file_path), now=lambda: 1500)
        self.assertEqual(
            restored.load_state(),
            {
                "rankingSnapshot": self.create_snapshot(),
                "doneReceipts": [{"messageId": "om_saved", "state": "done", "expiresAt": 2000}],
            },
        )

    def test_warns_and_starts_fresh_on_corrupt_state(self):
        file_path = self.create_state_file()
        file_path.write_text("{not-json", encoding="utf-8")
        logger = FakeLogger()
        state = main.PersistedBotState(file_path=str(file_path), logger=logger)
        self.assertEqual(state.load_state(), {"rankingSnapshot": None, "doneReceipts": []})
        self.assertEqual(len(logger.warn_calls), 1)


class RankingClientTests(unittest.TestCase):
    def test_bootstraps_from_cached_dashboard(self):
        client = main.RankingClient(
            fetch_json_impl=lambda path, label: (
                create_cached_payload(modelScores=[create_model_row(name="cached-alpha", score=62, currentScore=62)])
                if path == main.CACHED_DASHBOARD_PATH
                else (_ for _ in ()).throw(RuntimeError("scores unavailable"))
            )
        )
        ranking = client.fetch_ranking()
        self.assertEqual(ranking["entries"][0]["name"], "cached-alpha")
        self.assertFalse(ranking["isStale"])

    def test_warm_cache_returns_immediately_and_background_refresh_updates_snapshot(self):
        calls = []
        release = threading.Event()

        def fetch_json(path, label):
            calls.append(path)
            if len(calls) == 1 and path == main.CACHED_DASHBOARD_PATH:
                return create_cached_payload(modelScores=[create_model_row(name="bootstrap-alpha", score=61, currentScore=61)])
            if path == main.SCORES_PATH:
                release.wait(timeout=1)
                return create_scores_payload(rows=[create_model_row(name="refresh-alpha", score=66, currentScore=66)])
            return create_cached_payload(modelScores=[create_model_row(name="refresh-alpha", score=66, currentScore=66)])

        client = main.RankingClient(fetch_json_impl=fetch_json)
        client.fetch_ranking()
        release.set()
        time.sleep(0.05)
        calls.clear()
        release.clear()
        first = {}
        second = {}

        thread_one = threading.Thread(target=lambda: first.update(client.fetch_ranking()))
        thread_two = threading.Thread(target=lambda: second.update(client.fetch_ranking()))
        thread_one.start()
        thread_two.start()
        time.sleep(0.02)
        release.set()
        thread_one.join(timeout=1)
        thread_two.join(timeout=1)
        time.sleep(0.05)
        self.assertEqual(first["entries"][0]["name"], "refresh-alpha")
        self.assertEqual(second["entries"][0]["name"], "refresh-alpha")
        self.assertEqual(calls.count(main.SCORES_PATH), 1)
        self.assertEqual(calls.count(main.CACHED_DASHBOARD_PATH), 1)

    def test_hydrates_persisted_snapshot_and_marks_stale(self):
        now_ms = {"value": 0}
        client = main.RankingClient(
            cache_ttl_ms=100,
            now=lambda: now_ms["value"],
            initial_snapshot={
                "entries": [create_model_row(name="persisted-alpha", score=61, currentScore=61)],
                "summary": {"snapshot": "Best for code: persisted-alpha (#1)", "updatedAt": "2026-04-12T03:20:43.338Z"},
                "storedAtMs": 0,
            },
            fetch_json_impl=lambda path, label: (
                create_scores_payload(rows=[create_model_row(name="refresh-alpha", score=68, currentScore=68)])
                if path == main.SCORES_PATH
                else create_cached_payload(modelScores=[create_model_row(name="refresh-alpha", score=68, currentScore=68)])
            ),
        )
        fresh = client.fetch_ranking()
        self.assertFalse(fresh["isStale"])
        now_ms["value"] = 101
        stale = client.fetch_ranking()
        self.assertTrue(stale["isStale"])

    def test_keeps_last_good_snapshot_when_refresh_fails(self):
        phase = {"value": "bootstrap"}
        now_ms = {"value": 0}

        def fetch_json(path, label):
            if phase["value"] == "bootstrap" and path == main.CACHED_DASHBOARD_PATH:
                return create_cached_payload(modelScores=[create_model_row(name="alpha", score=63, currentScore=63)])
            raise RuntimeError("network offline")

        client = main.RankingClient(cache_ttl_ms=100, now=lambda: now_ms["value"], fetch_json_impl=fetch_json)
        initial = client.fetch_ranking()
        self.assertFalse(initial["isStale"])
        phase["value"] = "offline"
        now_ms["value"] = 101
        stale = client.fetch_ranking()
        self.assertEqual(stale["entries"][0]["name"], "alpha")
        self.assertTrue(stale["isStale"])

    def test_falls_back_to_live_refresh_if_cached_bootstrap_fails(self):
        state = {"cachedCalls": 0}

        def fetch_json(path, label):
            if path == main.CACHED_DASHBOARD_PATH:
                state["cachedCalls"] += 1
                if state["cachedCalls"] == 1:
                    raise RuntimeError("temporary outage")
                return create_cached_payload(modelScores=[create_model_row(name="cached-alpha", score=65, currentScore=65)])
            return create_scores_payload(rows=[create_model_row(name="live-alpha", score=69, currentScore=69)])

        client = main.RankingClient(fetch_json_impl=fetch_json)
        ranking = client.fetch_ranking()
        self.assertEqual(ranking["entries"][0]["name"], "live-alpha")

    def test_raises_when_no_snapshot_and_upstream_unavailable(self):
        client = main.RankingClient(fetch_json_impl=lambda path, label: (_ for _ in ()).throw(RuntimeError("status 503")))
        with self.assertRaisesRegex(RuntimeError, "status 503"):
            client.fetch_ranking()


class MessageHandlerTests(unittest.TestCase):
    def create_handler(self, ranking_client=None, bot_identity=None, logger=None, store=None, sender=None):
        return main.create_message_handler(
            message_sender=sender or FakeMessageSender(),
            ranking_client=ranking_client or mock.Mock(fetch_ranking=mock.Mock(return_value=create_ranking_fixture())),
            message_receipt_store=store or main.MessageReceiptStore(),
            bot_identity=bot_identity or {},
            logger=logger or FakeLogger(),
        )

    def test_direct_rank_and_leaderboard(self):
        sender = FakeMessageSender()
        handler = self.create_handler(sender=sender)
        handler(create_direct_message())
        handler(create_direct_message(message_id="om_leaderboard", content=json.dumps({"text": "/leaderboard"})))
        self.assertEqual(len(sender.calls), 2)
        self.assertIn("AI Stupid Meter Live Ranking", sender.calls[0]["text"])

    def test_group_rank_with_display_name_and_mention_key(self):
        sender = FakeMessageSender()
        handler = self.create_handler(sender=sender)
        handler(create_group_message())
        handler(create_group_message(message_id="om_group_key", content=json.dumps({"text": "@_user_1 /rank"})))
        self.assertEqual(len(sender.calls), 2)
        self.assertEqual(sender.calls[0]["chat_id"], "oc_group")

    def test_group_rank_with_multiple_mentions_and_full_width_separator(self):
        sender = FakeMessageSender()
        handler = self.create_handler(sender=sender, bot_identity={"openId": "ou_bot"})
        handler(
            create_group_message(
                message_id="om_multi",
                mentions=[create_bot_mention(), create_bot_mention(key="@_user_2", name="另一个人", id={"open_id": "ou_other"})],
                content=json.dumps({"text": "@_user_2 @_user_1 /rank"}),
            )
        )
        handler(
            create_group_message(
                message_id="om_fullwidth",
                content=json.dumps({"text": "@今天你的大模型变笨了吗：/rank"}),
            )
        )
        self.assertEqual(len(sender.calls), 2)

    def test_group_requires_leading_mention(self):
        sender = FakeMessageSender()
        handler = self.create_handler(sender=sender)
        handler(create_group_message(message_id="om_bare", mentions=[], content=json.dumps({"text": "/rank"})))
        self.assertEqual(sender.calls, [])

    def test_group_ignores_non_command_text(self):
        sender = FakeMessageSender()
        handler = self.create_handler(sender=sender)
        handler(create_group_message(message_id="om_hello", content=json.dumps({"text": "@今天你的大模型变笨了吗 hello there"})))
        self.assertEqual(sender.calls, [])

    def test_strict_bot_identity_mismatch_is_ignored(self):
        sender = FakeMessageSender()
        handler = self.create_handler(sender=sender, bot_identity={"openId": "ou_bot"})
        handler(
            create_group_message(
                message_id="om_other",
                mentions=[create_bot_mention(key="@_user_2", name="someone-else", id={"open_id": "ou_other"})],
                content=json.dumps({"text": "@someone-else /rank"}),
            )
        )
        self.assertEqual(sender.calls, [])

    def test_legacy_at_markup_fallback(self):
        sender = FakeMessageSender()
        handler = self.create_handler(sender=sender, bot_identity={"openId": "ou_bot"})
        handler(
            create_group_message(
                message_id="om_legacy",
                mentions=[],
                content=json.dumps({"text": '<at open_id="ou_bot">今天你的大模型变笨了吗</at> /rank'}),
            )
        )
        self.assertEqual(len(sender.calls), 1)

    def test_unsupported_commands_send_usage(self):
        sender = FakeMessageSender()
        handler = self.create_handler(sender=sender)
        handler(create_direct_message(content=json.dumps({"text": "/help"})))
        handler(create_group_message(message_id="om_help_group", content=json.dumps({"text": "@今天你的大模型变笨了吗 /help"})))
        self.assertEqual(len(sender.calls), 2)
        self.assertIn("Supported commands:", sender.calls[0]["text"])

    def test_non_text_and_bad_json_direct_messages_send_usage(self):
        sender = FakeMessageSender()
        handler = self.create_handler(sender=sender)
        handler(create_direct_message(message_type="image", content=json.dumps({"image_key": "img"})))
        handler(create_direct_message(message_id="om_bad_json", content="{"))
        self.assertEqual(len(sender.calls), 2)
        self.assertIn("Supported commands:", sender.calls[0]["text"])

    def test_duplicate_inflight_and_done_deliveries_are_ignored(self):
        sender = FakeMessageSender()
        pending = threading.Event()
        release = threading.Event()
        fetch_calls = {"count": 0}

        def fetch_ranking():
            fetch_calls["count"] += 1
            pending.set()
            release.wait(timeout=1)
            return create_ranking_fixture()

        handler = self.create_handler(
            sender=sender,
            ranking_client=mock.Mock(fetch_ranking=mock.Mock(side_effect=fetch_ranking)),
        )

        thread = threading.Thread(target=lambda: handler(create_direct_message(message_id="om_inflight")))
        thread.start()
        pending.wait(timeout=1)
        handler(create_direct_message(message_id="om_inflight"))
        release.set()
        thread.join(timeout=1)
        handler(create_direct_message(message_id="om_inflight"))
        self.assertEqual(fetch_calls["count"], 1)
        self.assertEqual(len(sender.calls), 1)

    def test_unavailable_message_sent_once(self):
        sender = FakeMessageSender()
        handler = self.create_handler(
            sender=sender,
            ranking_client=mock.Mock(fetch_ranking=mock.Mock(side_effect=RuntimeError("upstream unavailable"))),
            logger=FakeLogger(),
        )
        message = create_direct_message(message_id="om_unavailable")
        handler(message)
        handler(message)
        self.assertEqual(len(sender.calls), 1)
        self.assertIn("Ranking unavailable right now", sender.calls[0]["text"])

    def test_retries_after_send_failure(self):
        sender = FakeMessageSender()
        sender.failures = 1
        handler = self.create_handler(sender=sender, logger=FakeLogger())
        message = create_direct_message(message_id="om_retry")
        handler(message)
        handler(message)
        self.assertEqual(len(sender.calls), 1)


if __name__ == "__main__":
    unittest.main()
