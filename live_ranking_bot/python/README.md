# Python Live Ranking Bot

Feishu long-connection bot that responds to `/rank` and `/leaderboard`
with the current AI Stupid Meter leaderboard.

The bot reads the live API from:

- `/api/dashboard/cached` for fast bootstrap, fallback ranking rows, and summary data
- `/api/dashboard/scores` for preferred live ranking refreshes

It keeps a 30-minute snapshot cache, persists the last ranking snapshot plus
recent done receipts to `.cache/lazybot-state.json` by default, and restores
that state on restart.

## Setup

macOS/Linux:

```bash
APP_ID=<app_id> APP_SECRET=<app_secret> ./bootstrap.sh
```

Windows:

```bat
set APP_ID=<app_id>&set APP_SECRET=<app_secret>&bootstrap.bat
```

Optional env vars:

- `BASE_DOMAIN`
- `AISTUPID_BASE_URL`
- `CACHE_STATE_FILE`
- `BOT_OPEN_ID`
- `BOT_USER_ID`
- `RANK_LIMIT`

## Feishu Requirements

Before testing the bot, make sure your Feishu app has:

1. Bot ability enabled.
2. `接收消息 v2.0` subscribed.
3. Direct-message receive permission enabled.
4. Group mention receive permission enabled for `@bot` messages.
5. The bot invited into the target group before testing group commands.

Group chats are mention-only in this sample. The bot ignores bare `/rank`
and `/leaderboard` in groups, but it posts a normal text message back into the
same group for `@bot /rank` and `@bot /leaderboard`.

The Python version matches the Node sample behavior:

- `/rank` and `/leaderboard` are equivalent aliases
- leading mention keys such as `@_user_1` are supported
- display-name mentions such as `@今天你的大模型变笨了吗` are supported
- legacy `<at ...>` markup remains a compatibility fallback
- strict group mention matching can be enabled with `BOT_OPEN_ID` and/or `BOT_USER_ID`

## Local Verification

Run the test suite with:

```bash
python3 -m unittest discover -s tests -p 'test*.py'
```
