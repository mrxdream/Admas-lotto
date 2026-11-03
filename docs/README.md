# Admas Lottery Checker

Telegram bot + admin panel for saving Admas lottery tickets and matching them against official draw results.

## Apps

| App | Path | Role |
|-----|------|------|
| **api** | `apps/api` | Express API, Prisma, matching, Telegram notifications |
| **bot** | `apps/bot` | Grammy Telegram bot (register users, parse SMS, save tickets) |
| **admin** | `apps/admin` | React admin UI (draws, prizes, verify, publish) |
| **worker** | `apps/worker` | Re-runs matching for published draws (cron-friendly) |

## Draw lifecycle

1. **DRAFT** — create draw, add prize entries (winning numbers)
2. **VERIFIED** — admin confirms the prize list is correct
3. **PUBLISHED** — system matches tickets by `drawDateText` + `ticketNumber`, marks winners, sends Telegram messages

## Matching rules

- Tickets are matched when their `drawDateText` equals the draw’s `drawDateText`
- A ticket wins if `ticketNumber` equals any prize `winningNumber` on that draw
- Only unchecked tickets are processed; re-running match is safe
- Notifications are sent once per winning ticket (`notifiedAt`)

## Setup

```bash
# API
cd apps/api
cp .env.example .env   # or use existing .env
npm install
npx prisma migrate deploy
npx prisma generate
npm run dev

# Bot (separate terminal)
cd apps/bot
npm install
npm run dev

# Admin UI
cd apps/admin
npm install
npm run dev

# Worker (optional, for late tickets)
cd apps/worker
npm install
npm start
```

## Main API routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/users/telegram` | bot secret | Register / update Telegram user |
| POST | `/api/tickets` | bot secret | Save a ticket |
| GET | `/api/tickets?telegramId=` | bot secret | List user’s tickets |
| POST | `/api/admin/auth/login` | — | Admin session login |
| GET | `/api/admin/draws` | admin | List draws + prizes |
| POST | `/api/admin/draws` | admin | Create draft draw |
| POST | `/api/admin/draws/:id/prizes` | admin | Add prize entry |
| DELETE | `/api/admin/draws/:id/prizes/:prizeId` | admin | Delete prize (draft only) |
| POST | `/api/admin/draws/:id/verify` | admin | DRAFT → VERIFIED |
| POST | `/api/admin/draws/:id/publish` | admin | VERIFIED → PUBLISHED + match + notify |
| POST | `/api/admin/draws/:id/match` | admin | Re-match published draw |
| GET | `/api/admin/draws/:id/winners` | admin | List winners |
| GET | `/api/admin/tickets` | admin | List tickets |
| GET | `/api/admin/users` | admin | List users |
| GET | `/api/admin/stats` | admin | Dashboard counts |

See `apps/api/admin-test.http` for ready-to-run examples.
