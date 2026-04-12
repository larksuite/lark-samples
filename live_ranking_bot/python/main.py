import atexit
import json
import os
import re
import tempfile
import threading
import time
from copy import deepcopy
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional
from urllib import error, parse, request

try:
    import lark_oapi as lark
except ImportError:  # pragma: no cover - covered indirectly by startup guard
    lark = None


DEFAULT_AISTUPID_BASE_URL = "https://aistupidlevel.info"
DEFAULT_FEISHU_DOMAIN = "https://open.feishu.cn"
DEFAULT_CACHE_STATE_FILE = ".cache/lazybot-state.json"
DEFAULT_RANKING_CACHE_TTL_MS = 30 * 60 * 1000
DEFAULT_RECEIPT_TTL_MS = 15 * 60 * 1000
CURRENT_SCHEMA_VERSION = 1
DEFAULT_SAVE_DEBOUNCE_SECONDS = 0.1
SUPPORTED_COMMANDS = {"/rank", "/leaderboard"}
LEADING_MENTION_PATTERN = re.compile(r"^\s*<at\b([^>]*)>.*?</at>\s*", re.IGNORECASE | re.DOTALL)
LEADING_SEPARATOR_PATTERN = re.compile(r"^[\s\u3000:：]+")
SCORES_PATH = "/api/dashboard/scores"
CACHED_DASHBOARD_PATH = "/api/dashboard/cached"


class RuntimeConfig:
    def __init__(
        self,
        app_id: str,
        app_secret: str,
        domain: str,
        aistupid_base_url: str,
        cache_state_file: str,
        bot_open_id: Optional[str],
        bot_user_id: Optional[str],
        rank_limit: int,
    ) -> None:
        self.app_id = app_id
        self.app_secret = app_secret
        self.domain = domain
        self.aistupid_base_url = aistupid_base_url
        self.cache_state_file = cache_state_file
        self.bot_open_id = bot_open_id
        self.bot_user_id = bot_user_id
        self.rank_limit = rank_limit


def load_runtime_config(env: Optional[Dict[str, str]] = None) -> RuntimeConfig:
    env = env or os.environ
    app_id = (env.get("APP_ID") or "").strip()
    app_secret = (env.get("APP_SECRET") or "").strip()

    if not app_id:
        raise ValueError("APP_ID is required")

    if not app_secret:
        raise ValueError("APP_SECRET is required")

    return RuntimeConfig(
        app_id=app_id,
        app_secret=app_secret,
        domain=(env.get("BASE_DOMAIN") or DEFAULT_FEISHU_DOMAIN).strip(),
        aistupid_base_url=(env.get("AISTUPID_BASE_URL") or DEFAULT_AISTUPID_BASE_URL).strip(),
        cache_state_file=trim_optional_value(env.get("CACHE_STATE_FILE")) or DEFAULT_CACHE_STATE_FILE,
        bot_open_id=trim_optional_value(env.get("BOT_OPEN_ID")),
        bot_user_id=trim_optional_value(env.get("BOT_USER_ID")),
        rank_limit=parse_rank_limit(env.get("RANK_LIMIT")),
    )


def parse_rank_limit(value: Optional[str]) -> int:
    try:
        parsed = int(value or "")
    except (TypeError, ValueError):
        return 10

    return parsed if parsed > 0 else 10


def trim_optional_value(value: Optional[str]) -> Optional[str]:
    if not isinstance(value, str):
        return None

    trimmed = value.strip()
    return trimmed or None


def normalize_whitespace(value: str) -> str:
    return " ".join(value.strip().split())


def parse_command(value: Any) -> Optional[Dict[str, str]]:
    if not isinstance(value, str):
        return None

    normalized = normalize_whitespace(value)
    if not normalized.startswith("/"):
        return None

    command = normalized.split(" ", 1)[0].lower()
    if command in SUPPORTED_COMMANDS:
        return {"type": "ranking", "command": command}

    return {"type": "unsupported", "command": command}


def get_supported_commands() -> List[str]:
    return sorted(SUPPORTED_COMMANDS, key=lambda item: (0 if item == "/rank" else 1, item))


def format_ranking_message(ranking: Dict[str, Any]) -> str:
    lines = ["AI Stupid Meter Live Ranking"]

    if ranking.get("isStale"):
        lines.append("Data may be stale while the bot refreshes the latest ranking.")

    summary = ranking["summary"]
    lines.extend(
        [
            f"Summary: {summary['snapshot']}",
            f"Updated: {format_utc_timestamp(summary['updatedAt'])}",
            "",
        ]
    )

    for index, entry in enumerate(ranking["entries"], start=1):
        lines.append(
            f"{index}. {entry['name']} - {entry['score']} ({entry['provider']}, {entry['trend']}/{entry['status']})"
        )

    return "\n".join(lines)


def format_usage_message() -> str:
    commands = get_supported_commands()
    return "\n".join(
        [
            "Supported commands:",
            f"{commands[0]} - show the live AI ranking",
            f"{commands[1]} - show the live AI ranking",
        ]
    )


def format_unavailable_message() -> str:
    return "Ranking unavailable right now. Please try again in a moment."


def format_utc_timestamp(value: Any) -> str:
    if not isinstance(value, str):
        return "unknown"

    normalized = value.replace("Z", "+00:00")
    try:
        from datetime import datetime, timezone

        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        parsed = parsed.astimezone(timezone.utc)
    except ValueError:
        return "unknown"

    return parsed.strftime("%Y-%m-%d %H:%M UTC")


class MessageReceiptStore:
    def __init__(
        self,
        ttl_ms: int = DEFAULT_RECEIPT_TTL_MS,
        now: Optional[Callable[[], int]] = None,
        initial_done_receipts: Optional[List[Dict[str, Any]]] = None,
        on_change: Optional[Callable[[List[Dict[str, Any]]], None]] = None,
    ) -> None:
        self.ttl_ms = ttl_ms
        self.now = now or (lambda: int(time.time() * 1000))
        self.on_change = on_change
        self.receipts: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        self.restore_done_receipts(initial_done_receipts or [])

    def reserve(self, message_id: Optional[str]) -> Dict[str, Any]:
        if not is_tracked_message_id(message_id):
            return {"accepted": True, "tracked": False}

        with self._lock:
            self.cleanup_expired(notify=True)
            existing = self.receipts.get(message_id)
            if existing:
                return {
                    "accepted": False,
                    "tracked": True,
                    "state": existing["state"],
                }

            self.receipts[message_id] = {
                "state": "inflight",
                "expiresAt": self.now() + self.ttl_ms,
            }
            return {"accepted": True, "tracked": True, "state": "inflight"}

    def mark_done(self, message_id: Optional[str]) -> None:
        if not is_tracked_message_id(message_id):
            return

        with self._lock:
            self.cleanup_expired()
            self.receipts[message_id] = {
                "state": "done",
                "expiresAt": self.now() + self.ttl_ms,
            }
            self.emit_change()

    def clear(self, message_id: Optional[str]) -> None:
        if not is_tracked_message_id(message_id):
            return

        with self._lock:
            if message_id in self.receipts:
                del self.receipts[message_id]
                self.emit_change()

    def cleanup_expired(self, notify: bool = False) -> bool:
        now_ms = self.now()
        expired = [
            message_id
            for message_id, receipt in self.receipts.items()
            if receipt["expiresAt"] <= now_ms
        ]

        for message_id in expired:
            del self.receipts[message_id]

        if expired and notify:
            self.emit_change()

        return bool(expired)

    def restore_done_receipts(self, receipts: List[Dict[str, Any]]) -> None:
        now_ms = self.now()
        for receipt in receipts:
            normalized = normalize_done_receipt(receipt, now_ms)
            if normalized:
                self.receipts[normalized["messageId"]] = {
                    "state": "done",
                    "expiresAt": normalized["expiresAt"],
                }

    def snapshot_done_receipts(self) -> List[Dict[str, Any]]:
        self.cleanup_expired()
        result = [
            {
                "messageId": message_id,
                "state": "done",
                "expiresAt": receipt["expiresAt"],
            }
            for message_id, receipt in self.receipts.items()
            if receipt["state"] == "done"
        ]
        return sorted(result, key=lambda item: item["messageId"])

    def emit_change(self) -> None:
        if self.on_change:
            self.on_change(self.snapshot_done_receipts())


class PersistedBotState:
    def __init__(
        self,
        file_path: str = DEFAULT_CACHE_STATE_FILE,
        logger: Any = None,
        debounce_seconds: float = DEFAULT_SAVE_DEBOUNCE_SECONDS,
        now: Optional[Callable[[], int]] = None,
    ) -> None:
        self.file_path = Path(file_path).expanduser().resolve()
        self.logger = logger or LoggerAdapter()
        self.debounce_seconds = debounce_seconds
        self.now = now or (lambda: int(time.time() * 1000))
        self.pending_timer: Optional[threading.Timer] = None
        self.dirty = False
        self.state = {"rankingSnapshot": None, "receipts": []}
        self._lock = threading.Lock()
        self._registered_exit = False

    def load_state(self) -> Dict[str, Any]:
        try:
            raw = self.file_path.read_text(encoding="utf-8")
            parsed = json.loads(raw)
            self.state = normalize_persisted_state(parsed, self.now())
        except FileNotFoundError:
            self.state = {"rankingSnapshot": None, "receipts": []}
        except Exception as exc:  # pylint: disable=broad-except
            self.logger.warn(
                "Failed to load persisted bot state",
                {"error": str(exc), "filePath": str(self.file_path)},
            )
            self.state = {"rankingSnapshot": None, "receipts": []}

        return self.get_hydrated_state()

    def update_ranking_snapshot(self, snapshot: Optional[Dict[str, Any]]) -> None:
        with self._lock:
            self.state["rankingSnapshot"] = normalize_ranking_snapshot(snapshot)
            self.mark_dirty()

    def update_done_receipts(self, done_receipts: List[Dict[str, Any]]) -> None:
        with self._lock:
            self.state["receipts"] = normalize_done_receipts(done_receipts, self.now())
            self.mark_dirty()

    def flush_now(self) -> bool:
        with self._lock:
            if self.pending_timer:
                self.pending_timer.cancel()
                self.pending_timer = None

            if not self.dirty:
                return False

            self.file_path.parent.mkdir(parents=True, exist_ok=True)
            payload = json.dumps(
                {
                    "schemaVersion": CURRENT_SCHEMA_VERSION,
                    "savedAt": iso_now(self.now()),
                    "rankingSnapshot": self.state["rankingSnapshot"],
                    "receipts": self.state["receipts"],
                },
                indent=2,
                ensure_ascii=False,
            )

            with tempfile.NamedTemporaryFile(
                "w",
                encoding="utf-8",
                delete=False,
                dir=str(self.file_path.parent),
                prefix=f"{self.file_path.name}.",
                suffix=".tmp",
            ) as temp_handle:
                temp_handle.write(payload)
                temp_name = temp_handle.name

            Path(temp_name).replace(self.file_path)
            self.dirty = False
            return True

    def install_process_hooks(self) -> None:
        if self._registered_exit:
            return

        atexit.register(self._safe_flush)
        self._registered_exit = True

    def dispose(self) -> None:
        with self._lock:
            if self.pending_timer:
                self.pending_timer.cancel()
                self.pending_timer = None

    def get_hydrated_state(self) -> Dict[str, Any]:
        return {
            "rankingSnapshot": clone_snapshot(self.state["rankingSnapshot"]),
            "doneReceipts": deepcopy(self.state["receipts"]),
        }

    def mark_dirty(self) -> None:
        self.dirty = True
        if self.pending_timer:
            self.pending_timer.cancel()

        self.pending_timer = threading.Timer(self.debounce_seconds, self._safe_flush)
        self.pending_timer.daemon = True
        self.pending_timer.start()

    def _safe_flush(self) -> None:
        try:
            self.flush_now()
        except Exception as exc:  # pylint: disable=broad-except
            self.logger.warn(
                "Failed to persist bot state",
                {"error": str(exc), "filePath": str(self.file_path)},
            )


class RankingClient:
    def __init__(
        self,
        base_url: str = DEFAULT_AISTUPID_BASE_URL,
        fetch_json_impl: Optional[Callable[[str, str], Any]] = None,
        rank_limit: int = 10,
        cache_ttl_ms: int = DEFAULT_RANKING_CACHE_TTL_MS,
        now: Optional[Callable[[], int]] = None,
        initial_snapshot: Optional[Dict[str, Any]] = None,
        on_snapshot_change: Optional[Callable[[Optional[Dict[str, Any]]], None]] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.fetch_json_impl = fetch_json_impl or self.fetch_json
        self.rank_limit = parse_rank_limit(str(rank_limit))
        self.cache_ttl_ms = cache_ttl_ms
        self.now = now or (lambda: int(time.time() * 1000))
        self.on_snapshot_change = on_snapshot_change
        self.snapshot = normalize_snapshot(initial_snapshot)
        self._lock = threading.Lock()
        self._refresh_thread: Optional[threading.Thread] = None

    def fetch_ranking(self) -> Dict[str, Any]:
        snapshot = self.snapshot
        if snapshot:
            ranking = snapshot_to_public_ranking(snapshot, self.is_snapshot_stale(snapshot))
            self.refresh_in_background()
            return ranking

        try:
            snapshot = self.bootstrap_from_cached()
            self.set_snapshot(snapshot)
            self.refresh_in_background()
            return snapshot_to_public_ranking(snapshot, self.is_snapshot_stale(snapshot))
        except Exception:
            snapshot = self.perform_refresh()
            return snapshot_to_public_ranking(snapshot, self.is_snapshot_stale(snapshot))

    def bootstrap_from_cached(self) -> Dict[str, Any]:
        cached_payload = self.fetch_json_impl(CACHED_DASHBOARD_PATH, "dashboard cached")
        validate_cached_dashboard_payload(cached_payload)
        return create_snapshot(
            map_entries_from_cached_payload(cached_payload, self.rank_limit),
            map_summary(cached_payload),
            self.now(),
        )

    def refresh_in_background(self) -> None:
        with self._lock:
            if self._refresh_thread and self._refresh_thread.is_alive():
                return

            thread = threading.Thread(target=self._run_refresh_background, daemon=True)
            self._refresh_thread = thread
            thread.start()

    def _run_refresh_background(self) -> None:
        try:
            self.perform_refresh()
        except Exception:
            return

    def perform_refresh(self) -> Dict[str, Any]:
        scores_payload = None
        scores_error = None

        try:
            scores_payload = self.fetch_json_impl(SCORES_PATH, "dashboard scores")
        except Exception as exc:  # pylint: disable=broad-except
            scores_error = exc

        cached_payload = self.fetch_json_impl(CACHED_DASHBOARD_PATH, "dashboard cached")
        validate_cached_dashboard_payload(cached_payload)

        entries = resolve_refresh_entries(
            cached_dashboard_payload=cached_payload,
            rank_limit=self.rank_limit,
            scores_payload=scores_payload,
            scores_error=scores_error,
        )
        snapshot = create_snapshot(entries, map_summary(cached_payload), self.now())
        self.set_snapshot(snapshot)
        return snapshot

    def set_snapshot(self, snapshot: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        normalized = normalize_snapshot(snapshot)
        if not normalized:
            self.snapshot = None
            return None

        self.snapshot = normalized
        if self.on_snapshot_change:
            self.on_snapshot_change(clone_snapshot(normalized))
        return normalized

    def is_snapshot_stale(self, snapshot: Dict[str, Any]) -> bool:
        return self.now() - snapshot["storedAtMs"] > self.cache_ttl_ms

    def fetch_json(self, path: str, label: str) -> Any:
        url = parse.urljoin(f"{self.base_url}/", path.lstrip("/"))
        try:
            with request.urlopen(url, timeout=15) as response:
                status_code = getattr(response, "status", response.getcode())
                if status_code < 200 or status_code >= 300:
                    raise RuntimeError(f"{capitalize(label)} request failed with status {status_code}")
                try:
                    return json.loads(response.read().decode("utf-8"))
                except json.JSONDecodeError as exc:
                    raise RuntimeError(f"Failed to parse {label} JSON") from exc
        except error.HTTPError as exc:
            raise RuntimeError(f"{capitalize(label)} request failed with status {exc.code}") from exc
        except error.URLError as exc:
            raise RuntimeError(str(exc.reason)) from exc


class LoggerAdapter:
    def debug(self, message: str, details: Optional[Dict[str, Any]] = None) -> None:
        print(message, details or {})

    def error(self, message: str, details: Optional[Dict[str, Any]] = None) -> None:
        print(message, details or {})

    def warn(self, message: str, details: Optional[Dict[str, Any]] = None) -> None:
        print(message, details or {})


class FeishuMessageSender:
    def __init__(self, client: Any) -> None:
        self.client = client

    def send_text_message(self, chat_id: str, message_id: str, text: str) -> None:
        if lark is None:
            raise RuntimeError("lark-oapi is required to send messages")

        from lark_oapi.api.im.v1 import CreateMessageRequest, CreateMessageRequestBody

        content = json.dumps({"text": text}, ensure_ascii=False)
        request_builder = (
            CreateMessageRequest.builder()
            .receive_id_type("chat_id")
            .request_body(
                CreateMessageRequestBody.builder()
                .receive_id(chat_id)
                .msg_type("text")
                .content(content)
                .uuid(build_outbound_uuid(message_id))
                .build()
            )
            .build()
        )

        response = self.client.im.v1.message.create(request_builder)
        if not response.success():
            raise RuntimeError(
                f"client.im.v1.message.create failed, code: {response.code}, msg: {response.msg}, log_id: {response.get_log_id()}"
            )


def create_message_handler(
    message_sender: Any,
    ranking_client: RankingClient,
    message_receipt_store: Optional[MessageReceiptStore] = None,
    bot_identity: Optional[Dict[str, Optional[str]]] = None,
    logger: Any = None,
) -> Callable[[Dict[str, Any]], None]:
    receipt_store = message_receipt_store or MessageReceiptStore()
    bot_identity = bot_identity or {}
    logger = logger or LoggerAdapter()

    def handle_message_event(data: Dict[str, Any]) -> None:
        message = data.get("message")
        if not message:
            return

        reservation = receipt_store.reserve(message.get("message_id"))
        if not reservation["accepted"]:
            return

        try:
            command_context = extract_command_context(message, bot_identity, logger)
            if not command_context["ok"]:
                message_sender.send_text_message(
                    message["chat_id"], message["message_id"], format_usage_message()
                )
                receipt_store.mark_done(message["message_id"])
                return

            if command_context["command"] is None:
                receipt_store.mark_done(message["message_id"])
                return

            if command_context["command"]["type"] == "unsupported":
                log_debug(
                    logger,
                    "Unsupported slash command",
                    {
                        "chatId": message.get("chat_id"),
                        "messageId": message.get("message_id"),
                        "normalizedText": command_context["normalizedText"],
                    },
                )
                message_sender.send_text_message(
                    message["chat_id"], message["message_id"], format_usage_message()
                )
                receipt_store.mark_done(message["message_id"])
                return

            try:
                response_text = format_ranking_message(ranking_client.fetch_ranking())
            except Exception as exc:  # pylint: disable=broad-except
                logger.error(
                    "Failed to fetch ranking",
                    {
                        "chatId": message.get("chat_id"),
                        "error": str(exc),
                        "messageId": message.get("message_id"),
                    },
                )
                response_text = format_unavailable_message()

            message_sender.send_text_message(
                message["chat_id"], message["message_id"], response_text
            )
            receipt_store.mark_done(message["message_id"])
        except Exception as exc:  # pylint: disable=broad-except
            receipt_store.clear(message.get("message_id"))
            logger.error(
                "Failed to handle incoming message",
                {
                    "chatId": message.get("chat_id"),
                    "error": str(exc),
                    "messageId": message.get("message_id"),
                },
            )

    return handle_message_event


def extract_command_context(message: Dict[str, Any], bot_identity: Dict[str, Optional[str]], logger: Any) -> Dict[str, Any]:
    is_group_chat = message.get("chat_type") != "p2p"

    if message.get("message_type") != "text":
        if is_group_chat and not should_inspect_group_message(message, bot_identity):
            return {"ok": True, "command": None}
        return {"ok": False}

    try:
        payload = json.loads(message.get("content") or "")
    except json.JSONDecodeError:
        if is_group_chat and not should_inspect_group_message(message, bot_identity):
            return {"ok": True, "command": None}
        return {"ok": False}

    if not isinstance(payload.get("text"), str):
        if is_group_chat and not should_inspect_group_message(message, bot_identity):
            return {"ok": True, "command": None}
        return {"ok": False}

    stripped = strip_leading_mentions(payload["text"], message.get("mentions"))
    normalized_text = normalize_whitespace(stripped["text"])
    parsed_command = parse_command(normalized_text)

    if is_group_chat:
        if not stripped["hadLeadingMention"]:
            log_debug(
                logger,
                "Ignoring group message without a leading mention token",
                {"chatId": message.get("chat_id"), "messageId": message.get("message_id")},
            )
            return {"ok": True, "command": None}

        if not group_message_targets_bot(bot_identity, stripped["mentions"], message):
            log_debug(
                logger,
                "Ignoring group message because mentions did not match the configured bot identity",
                {"chatId": message.get("chat_id"), "messageId": message.get("message_id")},
            )
            return {"ok": True, "command": None}

        if parsed_command is None:
            log_debug(
                logger,
                "Ignoring group message because normalized text is not a supported slash command",
                {
                    "chatId": message.get("chat_id"),
                    "messageId": message.get("message_id"),
                    "normalizedText": normalized_text,
                },
            )
            return {"ok": True, "command": None}

    return {"ok": True, "command": parsed_command, "normalizedText": normalized_text}


def should_inspect_group_message(message: Dict[str, Any], bot_identity: Dict[str, Optional[str]]) -> bool:
    if has_configured_bot_identity(bot_identity):
        return has_configured_bot_mention(message, bot_identity)
    return has_any_mention_signal(message)


def group_message_targets_bot(bot_identity: Dict[str, Optional[str]], leading_mentions: List[Dict[str, Any]], message: Dict[str, Any]) -> bool:
    if not has_configured_bot_identity(bot_identity):
        return True

    if any(matches_bot_identity(mention, bot_identity) for mention in leading_mentions):
        return True

    return has_configured_bot_mention(message, bot_identity)


def has_configured_bot_mention(message: Dict[str, Any], bot_identity: Dict[str, Optional[str]]) -> bool:
    mentions = message.get("mentions") or []
    return any(matches_bot_identity(mention, bot_identity) for mention in mentions)


def has_any_mention_signal(message: Dict[str, Any]) -> bool:
    mentions = message.get("mentions") or []
    if mentions:
        return True
    return isinstance(message.get("content"), str) and "<at" in message["content"].lower()


def has_configured_bot_identity(bot_identity: Dict[str, Optional[str]]) -> bool:
    return bool(bot_identity.get("openId") or bot_identity.get("userId"))


def matches_bot_identity(candidate: Dict[str, Any], bot_identity: Dict[str, Optional[str]]) -> bool:
    normalized = normalize_mention_identity(candidate)
    if bot_identity.get("openId") and normalized["openId"] == bot_identity["openId"]:
        return True
    if bot_identity.get("userId") and normalized["userId"] == bot_identity["userId"]:
        return True
    return False


def strip_leading_mentions(text: str, mentions: Optional[List[Dict[str, Any]]]) -> Dict[str, Any]:
    stripped = strip_leading_mention_tokens(text, mentions)
    if stripped["hadLeadingMention"]:
        return stripped
    return strip_leading_mention_markup(text)


def strip_leading_mention_tokens(text: str, mentions: Optional[List[Dict[str, Any]]]) -> Dict[str, Any]:
    normalized_mentions = normalize_mentions(mentions or [])
    leading_mentions: List[Dict[str, Any]] = []
    remaining_text = text

    while True:
        match = consume_leading_mention_token(remaining_text, normalized_mentions)
        if not match:
            break
        leading_mentions.append(match["mention"])
        remaining_text = match["remainingText"]

    return {
        "hadLeadingMention": bool(leading_mentions),
        "mentions": leading_mentions,
        "text": remaining_text,
    }


def strip_leading_mention_markup(text: str) -> Dict[str, Any]:
    mentions: List[Dict[str, Any]] = []
    remaining_text = text

    while True:
        match = LEADING_MENTION_PATTERN.match(remaining_text)
        if not match:
            break
        mentions.append(parse_mention_attributes(match.group(1)))
        remaining_text = remaining_text[match.end():]
        remaining_text = LEADING_SEPARATOR_PATTERN.sub("", remaining_text)

    return {
        "hadLeadingMention": bool(mentions),
        "mentions": mentions,
        "text": remaining_text,
    }


def consume_leading_mention_token(text: str, mentions: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    trimmed_text = text.lstrip()
    for mention in mentions:
        for token in mention["tokens"]:
            if not token or not trimmed_text.startswith(token):
                continue
            next_character = trimmed_text[len(token):len(token) + 1]
            if not is_mention_boundary(next_character):
                continue
            return {
                "mention": mention,
                "remainingText": LEADING_SEPARATOR_PATTERN.sub("", trimmed_text[len(token):]),
            }
    return None


def normalize_mentions(mentions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized = []
    for mention in mentions:
        tokens = build_mention_tokens(mention)
        if not tokens:
            continue
        mention_identity = normalize_mention_identity(mention)
        mention_identity["tokens"] = tokens
        normalized.append(mention_identity)
    return normalized


def build_mention_tokens(mention: Dict[str, Any]) -> List[str]:
    raw_tokens = set()
    key = mention.get("key")
    name = mention.get("name")
    if isinstance(key, str) and key.strip():
        raw_tokens.add(key.strip())
    if isinstance(name, str) and name.strip():
        raw_tokens.add(f"@{name.strip()}")
    return sorted(raw_tokens, key=len, reverse=True)


def is_mention_boundary(value: str) -> bool:
    return value == "" or value.isspace() or value in {":", "："}


def normalize_mention_identity(value: Dict[str, Any]) -> Dict[str, Optional[str]]:
    nested_id = value.get("id") if isinstance(value, dict) else None
    return {
        "openId": first_non_empty(
            value.get("openId") if isinstance(value, dict) else None,
            value.get("open_id") if isinstance(value, dict) else None,
            nested_id.get("open_id") if isinstance(nested_id, dict) else None,
            nested_id.get("openId") if isinstance(nested_id, dict) else None,
        ),
        "userId": first_non_empty(
            value.get("userId") if isinstance(value, dict) else None,
            value.get("user_id") if isinstance(value, dict) else None,
            nested_id.get("user_id") if isinstance(nested_id, dict) else None,
            nested_id.get("userId") if isinstance(nested_id, dict) else None,
        ),
        "unionId": first_non_empty(
            value.get("unionId") if isinstance(value, dict) else None,
            value.get("union_id") if isinstance(value, dict) else None,
            nested_id.get("union_id") if isinstance(nested_id, dict) else None,
            nested_id.get("unionId") if isinstance(nested_id, dict) else None,
        ),
    }


def parse_mention_attributes(raw_attributes: str) -> Dict[str, Optional[str]]:
    mention: Dict[str, Optional[str]] = {}
    for name, double_quoted, single_quoted in re.findall(r"([a-z_]+)=(?:\"([^\"]*)\"|'([^']*)')", raw_attributes, re.IGNORECASE):
        value = double_quoted or single_quoted or ""
        if name == "user_id":
            mention["userId"] = value
        elif name == "open_id":
            mention["openId"] = value
        elif name == "union_id":
            mention["unionId"] = value
    return mention


def build_outbound_uuid(message_id: Optional[str]) -> Optional[str]:
    if not is_tracked_message_id(message_id):
        return None
    return f"lazybot:{message_id}"


def is_tracked_message_id(message_id: Optional[str]) -> bool:
    return isinstance(message_id, str) and bool(message_id.strip())


def normalize_done_receipt(receipt: Dict[str, Any], now_ms: int) -> Optional[Dict[str, Any]]:
    message_id = (receipt.get("messageId") or "").strip() if isinstance(receipt, dict) else ""
    expires_at = receipt.get("expiresAt") if isinstance(receipt, dict) else None

    if not message_id or receipt.get("state") != "done":
        return None
    if not isinstance(expires_at, (int, float)) or expires_at <= now_ms:
        return None

    return {"messageId": message_id, "state": "done", "expiresAt": int(expires_at)}


def normalize_done_receipts(receipts: List[Dict[str, Any]], now_ms: int) -> List[Dict[str, Any]]:
    result = [normalize_done_receipt(receipt, now_ms) for receipt in receipts if isinstance(receipt, dict)]
    return sorted([item for item in result if item], key=lambda item: item["messageId"])


def normalize_persisted_state(value: Dict[str, Any], now_ms: int) -> Dict[str, Any]:
    return {
        "rankingSnapshot": normalize_ranking_snapshot(value.get("rankingSnapshot") if isinstance(value, dict) else None),
        "receipts": normalize_done_receipts(value.get("receipts") if isinstance(value, dict) else [], now_ms),
    }


def normalize_ranking_snapshot(snapshot: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not isinstance(snapshot, dict):
        return None
    if not isinstance(snapshot.get("entries"), list) or not isinstance(snapshot.get("summary"), dict):
        return None
    stored_at = snapshot.get("storedAtMs")
    if not isinstance(stored_at, (int, float)):
        return None

    entries = []
    for entry in snapshot["entries"]:
        if not isinstance(entry, dict):
            continue
        entries.append(
            {
                "id": stringify_or_unknown(entry.get("id")),
                "name": stringify_or_unknown(entry.get("name")),
                "provider": stringify_or_unknown(entry.get("provider")),
                "score": normalize_snapshot_score(entry.get("score")),
                "trend": stringify_or_unknown(entry.get("trend")),
                "status": stringify_or_unknown(entry.get("status")),
                "lastUpdated": stringify_or_unknown(entry.get("lastUpdated")),
            }
        )

    return {
        "entries": entries,
        "summary": {
            "snapshot": stringify_or_unknown(snapshot["summary"].get("snapshot")),
            "updatedAt": stringify_or_unknown(snapshot["summary"].get("updatedAt")),
        },
        "storedAtMs": int(stored_at),
    }


def normalize_snapshot(snapshot: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    return normalize_ranking_snapshot(snapshot)


def clone_snapshot(snapshot: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    return deepcopy(snapshot) if snapshot else None


def validate_scores_payload(payload: Dict[str, Any]) -> None:
    if payload.get("success") is not True:
        raise RuntimeError("Dashboard scores response was unsuccessful")
    if not isinstance(payload.get("data"), list):
        raise RuntimeError("Dashboard scores payload is missing the ranking list")
    if not payload["data"]:
        raise RuntimeError("Dashboard scores returned no models")


def validate_cached_dashboard_payload(payload: Dict[str, Any]) -> None:
    if payload.get("success") is not True:
        raise RuntimeError("Dashboard cached response was unsuccessful")
    if not isinstance(payload.get("data"), dict):
        raise RuntimeError("Dashboard cached payload is missing summary data")


def map_entries_from_cached_payload(payload: Dict[str, Any], rank_limit: int) -> List[Dict[str, Any]]:
    model_scores = payload.get("data", {}).get("modelScores")
    if not isinstance(model_scores, list):
        raise RuntimeError("Dashboard cached payload is missing the ranking list")
    if not model_scores:
        raise RuntimeError("Dashboard cached returned no models")
    return map_entries(model_scores, rank_limit)


def resolve_refresh_entries(
    cached_dashboard_payload: Dict[str, Any],
    rank_limit: int,
    scores_payload: Optional[Dict[str, Any]],
    scores_error: Optional[Exception],
) -> List[Dict[str, Any]]:
    if scores_error is None and scores_payload is not None:
        try:
            validate_scores_payload(scores_payload)
            return map_entries(scores_payload["data"], rank_limit)
        except Exception:
            pass
    return map_entries_from_cached_payload(cached_dashboard_payload, rank_limit)


def map_entries(models: List[Dict[str, Any]], rank_limit: int) -> List[Dict[str, Any]]:
    entries = []
    for model in models[:rank_limit]:
        entries.append(
            {
                "id": str(model.get("id")),
                "name": str(model.get("name")),
                "provider": first_non_empty(model.get("provider"), model.get("vendor"), "unknown"),
                "score": get_model_score(model),
                "trend": first_non_empty(model.get("trend"), "unknown"),
                "status": first_non_empty(model.get("status"), "unknown"),
                "lastUpdated": first_non_empty(model.get("lastUpdated"), "unknown"),
            }
        )
    return entries


def map_summary(payload: Dict[str, Any]) -> Dict[str, str]:
    data = payload.get("data", {})
    summary = data.get("transparencyMetrics", {}).get("summary", {})
    best_for_code = data.get("recommendations", {}).get("bestForCode")
    drift_count = len(data.get("driftIncidents") or [])
    degradation_count = len(data.get("degradations") or [])
    parts = []

    if isinstance(best_for_code, dict) and best_for_code.get("name"):
        parts.append(
            f"Best for code: {best_for_code['name']}{format_optional_rank(best_for_code.get('rank'))}"
        )

    parts.append(f"drift alerts {drift_count}")
    parts.append(f"degradations {degradation_count}")

    if isinstance(summary.get("confidence"), (int, float)):
        parts.append(f"confidence {summary['confidence']}%")

    return {
        "snapshot": ", ".join(parts),
        "updatedAt": first_non_empty(summary.get("lastUpdate"), payload.get("meta", {}).get("cachedAt"), "unknown"),
    }


def create_snapshot(entries: List[Dict[str, Any]], summary: Dict[str, str], stored_at_ms: int) -> Dict[str, Any]:
    return {"entries": entries, "summary": summary, "storedAtMs": stored_at_ms}


def snapshot_to_public_ranking(snapshot: Dict[str, Any], is_stale: bool) -> Dict[str, Any]:
    return {
        "entries": deepcopy(snapshot["entries"]),
        "summary": deepcopy(snapshot["summary"]),
        "isStale": is_stale,
    }


def get_model_score(model: Dict[str, Any]) -> Any:
    if isinstance(model.get("currentScore"), (int, float)):
        return model["currentScore"]
    if isinstance(model.get("score"), (int, float)):
        return model["score"]
    raise RuntimeError(f"Dashboard scores model {model.get('name')} is missing score")


def normalize_snapshot_score(value: Any) -> int:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return 0
    return int(numeric) if numeric.is_integer() else numeric


def stringify_or_unknown(value: Any) -> str:
    if isinstance(value, str) and value:
        return value
    return "unknown"


def format_optional_rank(rank: Any) -> str:
    if isinstance(rank, int) and rank > 0:
        return f" (#{rank})"
    return ""


def capitalize(value: str) -> str:
    return value[0].upper() + value[1:] if value else value


def first_non_empty(*values: Any) -> Optional[str]:
    for value in values:
        if isinstance(value, str) and value:
            return value
    return None


def iso_now(now_ms: int) -> str:
    from datetime import datetime, timezone

    return datetime.fromtimestamp(now_ms / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def log_debug(logger: Any, message: str, details: Dict[str, Any]) -> None:
    if hasattr(logger, "debug"):
        logger.debug(message, details)


def convert_event_to_message(data: Any) -> Dict[str, Any]:
    event = getattr(data, "event", None)
    message = getattr(event, "message", None)
    if message is None:
        return {}

    mentions = []
    for mention in getattr(message, "mentions", []) or []:
        mention_id = getattr(mention, "id", None)
        mentions.append(
            {
                "key": getattr(mention, "key", None),
                "name": getattr(mention, "name", None),
                "id": {
                    "open_id": getattr(mention_id, "open_id", None),
                    "user_id": getattr(mention_id, "user_id", None),
                    "union_id": getattr(mention_id, "union_id", None),
                },
            }
        )

    return {
        "message": {
            "chat_id": getattr(message, "chat_id", None),
            "message_id": getattr(message, "message_id", None),
            "message_type": getattr(message, "message_type", None),
            "chat_type": getattr(message, "chat_type", None),
            "content": getattr(message, "content", None),
            "mentions": mentions,
        }
    }


def create_bot_runtime(
    env: Optional[Dict[str, str]] = None,
    fetch_json_impl: Optional[Callable[[str, str], Any]] = None,
    logger: Any = None,
) -> Dict[str, Any]:
    if lark is None:
        raise RuntimeError("lark-oapi is required. Install it with pip install -r requirements.txt")

    logger = logger or LoggerAdapter()
    config = load_runtime_config(env)
    state_store = PersistedBotState(file_path=config.cache_state_file, logger=logger)
    persisted_state = state_store.load_state()

    client = (
        lark.Client.builder()
        .app_id(config.app_id)
        .app_secret(config.app_secret)
        .domain(config.domain)
        .build()
    )
    message_sender = FeishuMessageSender(client)
    ranking_client = RankingClient(
        base_url=config.aistupid_base_url,
        fetch_json_impl=fetch_json_impl,
        rank_limit=config.rank_limit,
        initial_snapshot=persisted_state["rankingSnapshot"],
        on_snapshot_change=state_store.update_ranking_snapshot,
    )
    receipt_store = MessageReceiptStore(
        initial_done_receipts=persisted_state["doneReceipts"],
        on_change=state_store.update_done_receipts,
    )
    handler = create_message_handler(
        message_sender=message_sender,
        ranking_client=ranking_client,
        message_receipt_store=receipt_store,
        bot_identity={"openId": config.bot_open_id, "userId": config.bot_user_id},
        logger=logger,
    )

    def on_message(data: Any) -> None:
        handler(convert_event_to_message(data))

    event_handler = (
        lark.EventDispatcherHandler.builder("", "")
        .register_p2_im_message_receive_v1(on_message)
        .build()
    )
    ws_client = lark.ws.Client(
        config.app_id,
        config.app_secret,
        event_handler=event_handler,
        log_level=lark.LogLevel.DEBUG,
    )
    state_store.install_process_hooks()

    return {
        "config": config,
        "event_handler": event_handler,
        "message_sender": message_sender,
        "message_receipt_store": receipt_store,
        "persisted_state": persisted_state,
        "ranking_client": ranking_client,
        "state_store": state_store,
        "ws_client": ws_client,
    }


def main() -> None:
    runtime = create_bot_runtime()
    runtime["ws_client"].start()


if __name__ == "__main__":
    main()
