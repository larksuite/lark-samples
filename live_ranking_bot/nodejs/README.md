# Live Ranking Bot

This sample is a Feishu long-connection bot based on the official echo-bot
pattern. Instead of echoing user text, it responds to `/rank` and
`/leaderboard` with the current AI Stupid Meter leaderboard.

## Features

- Uses the Feishu long-connection SDK event flow
- Supports `/rank` and `/leaderboard`
- Fetches live ranking data from `https://aistupidlevel.info`
- Returns a plain-text Top N response with global index, trend, and update time

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

## Test

Run `npm test`.
