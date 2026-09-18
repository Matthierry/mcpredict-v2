# MC Predict v2

MC Predict v2 is an isolated Premier League model-versus-market dashboard. It imports the existing MC Predict output, retrieves current pre-match Bet365 prices from the Free 5DollarFootballAPI plan, removes the bookmaker margin and ranks comparable outcomes by probability edge and expected return.

The project is deliberately separate from `Matthierry/MCPredict.github.io`; it cannot change `mcpredict.com`.

## V1 scope

- Premier League (`E0`) first, with competition-aware tables ready for expansion.
- Bet365 pre-match Match Result and exact Over/Under 2.5 prices.
- Fair model odds, de-vigged market probability, available price, edge and expected return.
- Value and Probability views plus timestamped snapshots for later CLV analysis.
- Private Cloudflare Access beta at `v2-beta.mcpredict.com`.

## Architecture

```text
Published MC Predict CSV       5DollarFootballAPI
            │                         │
            └──── Cloudflare Worker ──┘
                         │
             fixture matching + value engine
                         │
                  Cloudflare D1
                         │
                  React + TypeScript
```

The browser never receives the football API key. Google Sheets remains the model-production interface; D1 holds the operational view and odds history.

## Value definitions

```text
fair market probability = (1 / outcome odds) / sum(1 / every outcome odds)
edge percentage points  = model probability - fair market probability
expected return         = model probability × market odds - 1
```

## Free-plan budget

Each run makes one seven-day Premier League fixture request and then requests odds only for matched fixtures, capped at twelve: at most thirteen requests. A thirty-minute cron remains below the documented sixty requests/hour and twenty requests/minute limits.

## Local verification

```bash
npm install
npm test
npm run build
```

For local Worker development create an uncommitted `.dev.vars` with `FIVE_DOLLAR_API_KEY` and `SYNC_TOKEN`.

## First beta deployment

```bash
npx wrangler login
npm run db:create
```

Copy the returned D1 ID into `wrangler.jsonc`, then run:

```bash
npm run db:migrate
npx wrangler secret put FIVE_DOLLAR_API_KEY
npx wrangler secret put SYNC_TOKEN
npm run deploy:beta
```

Protect `v2-beta.mcpredict.com` with Cloudflare Access, then make the first protected `POST /api/internal/sync` request.

## Routes

- `GET /api/v1/dashboard`
- `GET /api/v1/health`
- `POST /api/internal/sync` with `Authorization: Bearer <SYNC_TOKEN>`

The footer includes the Free-plan attribution: [Football data by 5DollarFootballAPI](https://5dollarfootballapi.com).
