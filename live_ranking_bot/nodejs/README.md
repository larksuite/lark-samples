# Live Ranking Bot

This sample is a Feishu long-connection bot based on the official echo-bot
pattern. Instead of echoing user text, it responds to `/rank` and
`/leaderboard` with the current AI Stupid Meter leaderboard.

## Features

- Uses the Feishu long-connection SDK event flow
- Supports `/rank` and `/leaderboard`
- Fetches live ranking data from `https://aistupidlevel.info`
- Reads ranked models from `/api/dashboard/scores`
- Reads cached summary, drift, and transparency data from `/api/dashboard/cached`
- Deduplicates repeated Feishu deliveries by `message_id`
- Requires `@bot` mentions for group commands to avoid noisy group replies
- Returns a plain-text Top N response with summary text and update time

## Environment variables

- `APP_ID`
- `APP_SECRET`
- `BASE_DOMAIN` optional, defaults to `https://open.feishu.cn`
- `AISTUPID_BASE_URL` optional, defaults to `https://aistupidlevel.info`
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

Group chats are mention-only in this sample. The bot ignores bare `/rank`
and `/leaderboard` in groups, but it responds to `@bot /rank` and
`@bot /leaderboard`.

## Test

Run `npm test`.

## Manual smoke test

1. DM the bot with `/rank` three times and confirm each message gets one reply.
2. Invite the bot into a group and send `@bot /rank`; confirm there is one reply.
3. Send `@bot hello` in the same group; confirm there is no ranking reply.
