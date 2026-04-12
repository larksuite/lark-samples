# Live Ranking Bot

This sample is a Feishu long-connection bot based on the official echo-bot
pattern. Instead of echoing user text, it responds to `/rank` and
`/leaderboard` with the current AI Stupid Meter leaderboard.

## Features

- Uses the Feishu long-connection SDK event flow
- Supports `/rank` and `/leaderboard`
- Fetches live ranking data from `https://aistupidlevel.info`
- Bootstraps from `/api/dashboard/cached` for fast startup, summary data, and fallback rows
- Refreshes entries from `/api/dashboard/scores` in the background
- Keeps a 30-minute in-memory snapshot cache for faster repeated commands
- Deduplicates repeated Feishu deliveries by `message_id`
- Uses deterministic outbound `uuid` values to reduce duplicate sends
- Requires `@bot` mentions for group commands and posts the response back into the same group
- Supports optional strict mention matching via bot identity env vars

## Environment variables

- `APP_ID`
- `APP_SECRET`
- `BASE_DOMAIN` optional, defaults to `https://open.feishu.cn`
- `AISTUPID_BASE_URL` optional, defaults to `https://aistupidlevel.info`
- `BOT_OPEN_ID` optional, used for strict group mention matching
- `BOT_USER_ID` optional, used for strict group mention matching
- `RANK_LIMIT` optional, defaults to `10`

## Start the sample

macOS/Linux: `APP_ID=<app_id> APP_SECRET=<app_secret> ./bootstrap.sh`

Windows: `set APP_ID=<app_id>&set APP_SECRET=<app_secret>&bootstrap.bat`

Or run manually:

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and fill in your Feishu app credentials.
3. Start the bot with `npm start`.

## Feishu requirements

Before testing the sample, make sure your Feishu app has:

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

## Test

Run `npm test`.

## Manual smoke test

1. DM the bot with `/rank` three times and confirm each message gets one reply.
2. Invite the bot into a group and send `@bot /rank`; confirm there is one
   group message back in the same chat.
3. Send `@bot hello` in the same group; confirm there is no ranking reply.
4. If you still see duplicate replies, check that only one long-connection
   consumer is attached to the Feishu app.
