# urban-winner

Turnover (cleaning) operations for short-term rental hosts in Romania. It syncs Airbnb and Booking calendars, schedules cleanings automatically, and gives each cleaner a link to a checklist and photo upload. Hosts get a monthly payout statement per cleaner in RON, a monthly SITUR occupancy report with a manual guest register, automatic day-before SMS reminders to cleaners and at-risk alerts to the host, per-property cleaner teams, cleaner performance stats, an issues inbox, teammate accounts, and a Pro plan (Stripe) beyond the first free property.

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

- **Accounts are organizations, not single users.** Every host and any teammates they invite share one `organizations` row (billing plan, Stripe ids) — `src/db/schema.ts`. `/app/account` lets a host set their own phone number and generate a one-time invite link (`/invite/{token}`); whoever signs up through it joins the same organization instead of creating a new one, with equal access.
- **Hosts** sign up, add properties, and paste each listing's iCal export URL (Airbnb or Booking). They add cleaners and set a default cleaner and a fee per turnover.
- **Sync** (`src/lib/sync.ts`) upserts reservations by UID. Future bookings that disappear from a feed are marked cancelled. Turnovers are then rebuilt: one per checkout day, with a window from check-out to the next check-in. Only `PENDING` turnovers are ever changed, so work a cleaner has started is never overwritten. A feed that fails to sync surfaces as a banner on the dashboard until fixed.
- **Property teams** (`/app/properties/{id}`): a host can restrict which cleaners a property's assign dropdown offers; with none picked, any active cleaner still works, matching the old behaviour.
- **Cleaners** open `/c/{token}` on their phone: tap Start, tick the checklist, upload photos, add notes or flag an issue, then tap Done. Hosts can revoke a link with "Link nou". A reported issue shows up in `/app/issues` until a host marks it resolved, and `/app/cleaners` shows each cleaner's completed/issue counts and average turnaround over the last 90 days.
- **Payouts** (`/app/payouts`, with CSV export) add up completed turnovers × fee per cleaner per month.
- **SITUR compliance** (`/app/compliance`, with CSV export) reports arrivals and nights per property per month against its SITUR code, plus a manual guest register (name, ID document, headcount) per stay — iCal feeds carry no guest identity, so that part can't be automated without a PMS integration.
- **Reminders**: `/api/cron/notify` texts a cleaner once, a day before their next turnover starts, and texts every host phone on file once when a turnover goes at-risk (`src/lib/notify.ts`, SMSO.ro).
- **Billing** (`/app/billing`): Free plan is capped at 1 property per organization; Stripe Checkout upgrades to Pro (`src/lib/billing.ts`, `src/app/api/billing/*`).

## Layout

```
src/db/schema.ts        tables + relations (organizations own properties/cleaners; users belong to one)
src/lib/turnovers.ts    pure turnover planning (tested)
src/lib/ical.ts         feed parsing + sync diff (tested)
src/lib/sync.ts         DB sync + turnover rebuild
src/lib/stats.ts        cleaner performance aggregation
src/app/app/*           host dashboard
src/app/c/*             cleaner mobile pages
src/app/invite/*        teammate invite acceptance
src/app/api/*           cron, photos, payouts/SITUR CSV, billing
```
