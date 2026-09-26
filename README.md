# urban-winner

Turnover (cleaning) operations for short-term rental hosts in Romania. It syncs Airbnb and Booking calendars, schedules cleanings automatically, and gives each cleaner a link to a checklist and photo upload. Hosts get a monthly payout statement per cleaner in RON, a monthly SITUR occupancy report, automatic day-before SMS reminders to cleaners, and a Pro plan (Stripe) beyond the first free property.

See [`docs/SPEC.md`](docs/SPEC.md) for the product spec, market check and roadmap.

## Stack

Next.js 15 (App Router, server actions) · TypeScript · Tailwind v4 · Drizzle ORM + PostgreSQL · `jose` sessions · `node-ical` · Vitest

## Run locally

```bash
cp .env.example .env            # set SESSION_SECRET (openssl rand -base64 48)
docker compose up -d db         # Postgres 16 on :5432
npm install
npm run db:migrate
npm run dev                     # http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit tests: timezone maths, turnover planning, iCal parsing and sync diffing |
| `npm run db:generate` | Create a new SQL migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Drizzle Studio |

## Deploy (Docker)

```bash
SESSION_SECRET=... CRON_SECRET=... APP_URL=https://your.domain docker compose --profile app up -d --build
```

This starts Postgres, the app (migrations run on boot), and a small cron container. The cron container calls `POST /api/cron/sync` and `POST /api/cron/notify` every 30 minutes with `Authorization: Bearer $CRON_SECRET`. Photos are stored in the `uploads` volume.

### Optional: billing (Stripe) and SMS reminders (SMSO.ro)

Both are off by default (Free plan only, reminders logged not sent) until you set their env vars — see `.env.example`.

- **Billing:** create a recurring Price in Stripe, set `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID`, and point a webhook at `/api/billing/webhook` for `checkout.session.completed`, `customer.subscription.updated` and `customer.subscription.deleted` (set `STRIPE_WEBHOOK_SECRET` to its signing secret). `/app/billing` then offers a real Stripe Checkout + customer portal, and hosts on the Free plan are capped at 1 property (`src/lib/billing.ts`).
- **SMS reminders:** set `SMSO_API_KEY` / `SMSO_SENDER` (an [SMSO.ro](https://smso.ro) sender ID). `/api/cron/notify` then texts each cleaner once, ~24h before their next turnover starts, with the property, time and their `/c/{token}` link.

## How it works

- **Hosts** sign up, add properties, and paste each listing's iCal export URL (Airbnb or Booking). They add cleaners and set a default cleaner and a fee per turnover.
- **Sync** (`src/lib/sync.ts`) upserts reservations by UID. Future bookings that disappear from a feed are marked cancelled. Turnovers are then rebuilt: one per checkout day, with a window from check-out to the next check-in. Only `PENDING` turnovers are ever changed, so work a cleaner has started is never overwritten.
- **Cleaners** open `/c/{token}` on their phone: tap Start, tick the checklist, upload photos, add notes or flag an issue, then tap Done. Hosts can revoke a link with "Link nou".
- **Payouts** (`/app/payouts`, with CSV export) add up completed turnovers × fee per cleaner per month.
- **SITUR compliance** (`/app/compliance`, with CSV export) reports arrivals and nights per property per month against its SITUR code. It's an occupancy summary, not the full guest register the May 2026 rules also require — iCal feeds carry no guest identity, so that register still needs a manual entry point or a PMS integration.
- **Reminders**: `/api/cron/notify` texts a cleaner once, a day before their next turnover starts (`src/lib/notify.ts`, SMSO.ro).
- **Billing** (`/app/billing`): Free plan is capped at 1 property; Stripe Checkout upgrades to Pro (`src/lib/billing.ts`, `src/app/api/billing/*`).

## Layout

```
src/db/schema.ts        tables + relations
src/lib/turnovers.ts    pure turnover planning (tested)
src/lib/ical.ts         feed parsing + sync diff (tested)
src/lib/sync.ts         DB sync + turnover rebuild
src/app/app/*           host dashboard
src/app/c/*             cleaner mobile pages
src/app/api/*           cron, photos, payouts CSV
```
