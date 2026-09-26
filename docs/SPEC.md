# urban-winner: MVP spec

Codename: **urban-winner**. The product name is still open.

## Problem

Romanian short-term rental hosts and small property managers (1–30 units) run turnovers on WhatsApp and memory:

- They check the Airbnb and Booking calendars by hand.
- They message the cleaner the night before.
- They chase photos to prove the unit is ready.
- They add up at month-end what they owe each cleaner.

Missed or late cleanings lead to bad reviews, and bad reviews lose bookings.

## Market check (Sept 2026)

| Tool | Price | Notes |
|---|---|---|
| Turno | Free tier; Pro from ~$8/property/mo | Strongest direct competitor. US-centric cleaner marketplace, English only |
| Breezeway | Free for 1 property; from $19/property/mo | Full ops suite. Larger tiers are quote-only |
| ResortCleaning | From ~$5/property/mo | Older product, PMS-oriented |
| Properly, Operto | Quote-only | Aimed at mid-size or large operators |

**Honest read:** the core feature (calendar sync, cleaner scheduling, checklists) is commoditised and has free tiers. A clone won't win. Our angle is **local fit**:

1. **Romanian-first:** RO interface, RON pricing, and cleaners get a link over WhatsApp or SMS. Cleaners don't have to install an app or create an account.
2. **Cleaner payouts in RON:** a per-turnover fee and a monthly statement per cleaner. Later, e-Factura for PFA/SRL cleaners.
3. **Compliance helper (phase 2):** new rules from 20 May 2026 follow EU Reg. 2024/1028. They add a SITUR unique code per unit and mandatory guest records, and hosts on CNP have e-Factura obligations. We'd store the SITUR code per property and generate a monthly occupancy report from synced reservations. No local competitor bundles ops with compliance.

**Validation before heavy build:** talk to 10 hosts in Bucharest or Brașov host Facebook groups. Success means 3 or more say they'd pay 25 lei/property/month.

## Pricing hypothesis

- Free: 1 property.
- 25 lei/property/month after that.
- Managers with 10 or more units get a volume discount.

## Users

- **Host / manager (owner):** web dashboard.
- **Cleaner:** mobile web page opened from a private link. No login.

## MVP scope

### In scope

1. Host sign-up/login (email + password).
2. Properties: name, address, check-in and check-out times, iCal URLs (Airbnb, Booking, other), default cleaner, fee per turnover (RON), checklist template, SITUR code (optional).
3. **iCal sync:** a cron endpoint pulls every feed every 30 minutes. It upserts reservations by feed UID and removes cancelled ones.
4. **Turnover generation:** one turnover per property per check-out day. The window runs from check-out time to the next check-in. With no next booking, it's due by the same day's check-in time, so last-minute bookings are safe. The same stay exported by two feeds (e.g. Booking re-exporting an imported Airbnb booking) is deduped. Airbnb "Not available" owner blocks are ignored. It's auto-assigned to the default cleaner.
5. **Cleaner page** (`/c/{token}`): upcoming turnovers, then Start, then checklist ticks, photos, a notes/issue flag, and Done.
6. **Host dashboard:** today, tomorrow, the next 7 days, status colours, and flags for unassigned or at-risk turnovers (not started within 1h of the next check-in).
7. **Payout statement:** completed turnovers × fee per cleaner per month, with CSV export.

### Out of scope (later)

WhatsApp/SMS notifications, PMS APIs (Hostaway, Smoobu), inventory and linen, maintenance tickets, multi-cleaner teams per property, the SITUR occupancy report, e-Factura, a native app, and billing (Stripe or Netopia).

## Data model

- `User`: a host account.
- `Property`: owned by a User, with a default cleaner.
- `CalendarFeed`: belongs to a Property. Holds the url, source, and lastSyncedAt.
- `Reservation`: belongs to a Feed. Holds the uid, start, end, summary, and a cancelled flag.
- `Cleaner`: belongs to a User. Holds name, phone, and a secret `token` for the link.
- `Turnover`: belongs to a Property and a Reservation. Holds the cleaner, `dueFrom`, `dueBy`, status (`PENDING`/`IN_PROGRESS`/`DONE`/`ISSUE`), a fee snapshot, and timestamps.
- `ChecklistItem`: belongs to a Property template.
- `TurnoverCheck`: one item ticked on one turnover.
- `Photo`: belongs to a Turnover. Holds the path.

## Stack

- Next.js (App Router, server actions), TypeScript, Tailwind.
- Drizzle ORM + PostgreSQL. Pure TypeScript, no engine binaries to download; migrations are SQL files in `drizzle/`.
- Auth: signed session cookie (`jose`) and bcrypt. Cleaners authenticate through their unguessable token.
- `node-ical` for feed parsing.
- Photos go to local disk (`UPLOAD_DIR`) in the MVP; S3-compatible storage comes later.
- Docker Compose (app + Postgres). The cron is an external curl to `/api/cron/sync` with `CRON_SECRET`.
- Vitest for domain logic (turnover generation and sync diffing).

## Milestones

1. **M1 (this scaffold):** schema, auth, properties, feeds, sync, turnovers, cleaner page, dashboard.
2. **M2:** payouts and CSV, at-risk flags, photo upload polish, and 10 host interviews.
3. **M3:** WhatsApp notifications, billing, and the SITUR/compliance module.
