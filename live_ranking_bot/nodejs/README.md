# Lazybot

Feishu long-connection bot that responds to `/rank` and `/leaderboard`
with the current AI Stupid Meter leaderboard.

The bot reads the live API from:

- `/api/dashboard/cached` for fast bootstrap, fallback ranking rows, and summary data
- `/api/dashboard/scores` for preferred live ranking refreshes

It keeps a 30-minute in-memory snapshot cache and refreshes the ranking in the
background so repeated commands return quickly. It also persists the latest
ranking snapshot plus recent done receipts into `./.cache/lazybot-state.json`
by default, so the bot can resume warm after a restart.

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and fill in your Feishu app credentials.
3. Start the bot with `npm start`.

Optional env vars:

- `CACHE_STATE_FILE` to override the persisted state path
- `BOT_OPEN_ID` / `BOT_USER_ID` for strict group-mention identity matching
- `RANK_LIMIT` to change the number of rows shown

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

If you want strict mention matching, set `BOT_OPEN_ID` and/or `BOT_USER_ID`.
Without those values, the sample falls back to a leading-mention check and
assumes the app only receives `@bot` group events.

Real Feishu receive events carry group mentions as JSON `content.text` plus a
separate `mentions` array. This sample strips leading mention keys such as
`@_user_1`, display-name mentions such as `@今天你的大模型变笨了吗`, and keeps
legacy `<at ...>` markup as a compatibility fallback.

## Commands

- `/rank`
- `/leaderboard`

## Manual Smoke Test

1. DM the bot with `/rank` three times and confirm each message gets one reply.
2. Invite the bot into a group and send `@bot /rank`; confirm there is one
   group message back in the same chat.
3. Send `@bot hello` in the same group; confirm there is no ranking reply.
4. Restart the bot after one successful `/rank`, then send `/rank` again and
   confirm the first reply is still fast because the last snapshot was restored.
5. If group `@bot /rank` still does not arrive, re-check that `接收消息 v2.0`
   is subscribed in the Feishu app config in addition to the required scopes.
6. If you still see duplicate replies, check that only one long-connection
   consumer is attached to the Feishu app.
