import { relations } from "drizzle-orm";
import { boolean, index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const ts = (name: string) => timestamp(name, { withTimezone: true });

export const feedSource = pgEnum("feed_source", ["AIRBNB", "BOOKING", "OTHER"]);
export const turnoverStatus = pgEnum("turnover_status", ["PENDING", "IN_PROGRESS", "DONE", "ISSUE", "CANCELLED"]);
export const orgPlan = pgEnum("user_plan", ["FREE", "PRO"]); // SQL type name kept from before the org refactor

/** The billing/ownership unit. A host and any teammates they invite share one organization. */
export const organizations = pgTable("organizations", {
  id: id(),
  plan: orgPlan("plan").notNull().default("FREE"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: id(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  name: text("name"),
  phone: text("phone"), // for at-risk SMS alerts
  passwordHash: text("password_hash").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/** A pending, single-use link a host shares to bring a teammate into their organization. */
export const teamInvites = pgTable("team_invites", {
  id: id(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const cleaners = pgTable(
  "cleaners",
  {
    id: id(),
    organizationId: text("owner_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    token: text("token").notNull().unique(),
    active: boolean("active").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("cleaners_owner_idx").on(t.organizationId)],
);

export const properties = pgTable(
  "properties",
  {
    id: id(),
    organizationId: text("owner_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address"),
    checkInTime: text("check_in_time").notNull().default("15:00"), // HH:mm Europe/Bucharest
    checkOutTime: text("check_out_time").notNull().default("11:00"),
    feeRon: integer("fee_ron").notNull().default(0), // per turnover, whole RON
    siturCode: text("situr_code"),
    defaultCleanerId: text("default_cleaner_id").references(() => cleaners.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("properties_owner_idx").on(t.organizationId)],
);

/** Which cleaners a property's team draws from — the assign dropdown is limited to these once any are set. */
export const propertyCleaners = pgTable(
  "property_cleaners",
  {
    propertyId: text("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
    cleanerId: text("cleaner_id").notNull().references(() => cleaners.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.propertyId, t.cleanerId] })],
);

export const calendarFeeds = pgTable(
  "calendar_feeds",
  {
    id: id(),
    propertyId: text("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
    source: feedSource("source").notNull().default("OTHER"),
    url: text("url").notNull(),
    lastSyncedAt: ts("last_synced_at"),
    lastError: text("last_error"),
  },
  (t) => [index("feeds_property_idx").on(t.propertyId)],
);

export const reservations = pgTable(
  "reservations",
  {
    id: id(),
    feedId: text("feed_id").notNull().references(() => calendarFeeds.id, { onDelete: "cascade" }),
    uid: text("uid").notNull(),
    start: ts("start").notNull(),
    end: ts("end").notNull(),
    summary: text("summary"),
    cancelled: boolean("cancelled").notNull().default(false),
    updatedAt: ts("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("reservations_feed_uid").on(t.feedId, t.uid)],
);

export const turnovers = pgTable(
  "turnovers",
  {
    id: id(),
    propertyId: text("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
    reservationId: text("reservation_id").notNull().unique().references(() => reservations.id, { onDelete: "cascade" }),
    cleanerId: text("cleaner_id").references(() => cleaners.id, { onDelete: "set null" }),
    dueFrom: ts("due_from").notNull(),
    dueBy: ts("due_by").notNull(),
    status: turnoverStatus("status").notNull().default("PENDING"),
    feeRon: integer("fee_ron").notNull().default(0),
    notes: text("notes"),
    startedAt: ts("started_at"),
    completedAt: ts("completed_at"),
    remindedAt: ts("reminded_at"),
    atRiskNotifiedAt: ts("at_risk_notified_at"),
    issueResolvedAt: ts("issue_resolved_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("turnovers_property_due").on(t.propertyId, t.dueFrom), index("turnovers_cleaner_due").on(t.cleanerId, t.dueFrom)],
);

export const checklistItems = pgTable("checklist_items", {
  id: id(),
  propertyId: text("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  position: integer("position").notNull().default(0),
});

export const turnoverChecks = pgTable(
  "turnover_checks",
  {
    turnoverId: text("turnover_id").notNull().references(() => turnovers.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull().references(() => checklistItems.id, { onDelete: "cascade" }),
    checkedAt: ts("checked_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.turnoverId, t.itemId] })],
);

export const photos = pgTable("photos", {
  id: id(),
  turnoverId: text("turnover_id").notNull().references(() => turnovers.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/** Guest identity for the SITUR register (EU Reg. 2024/1028) — iCal carries none of this, so it's entered by hand. */
export const guestRegistrations = pgTable("guest_registrations", {
  turnoverId: text("turnover_id").primaryKey().references(() => turnovers.id, { onDelete: "cascade" }),
  guestName: text("guest_name"),
  guestIdDoc: text("guest_id_doc"),
  guestCount: integer("guest_count").notNull().default(1),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ── relations (for db.query.*.findMany({ with })) ──
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  properties: many(properties),
  cleaners: many(cleaners),
  invites: many(teamInvites),
}));
export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, { fields: [users.organizationId], references: [organizations.id] }),
}));
export const teamInvitesRelations = relations(teamInvites, ({ one }) => ({
  organization: one(organizations, { fields: [teamInvites.organizationId], references: [organizations.id] }),
}));
export const cleanersRelations = relations(cleaners, ({ one, many }) => ({
  organization: one(organizations, { fields: [cleaners.organizationId], references: [organizations.id] }),
  turnovers: many(turnovers),
  properties: many(propertyCleaners),
}));
export const propertiesRelations = relations(properties, ({ one, many }) => ({
  organization: one(organizations, { fields: [properties.organizationId], references: [organizations.id] }),
  defaultCleaner: one(cleaners, { fields: [properties.defaultCleanerId], references: [cleaners.id] }),
  feeds: many(calendarFeeds),
  turnovers: many(turnovers),
  checklist: many(checklistItems),
  cleaners: many(propertyCleaners),
}));
export const propertyCleanersRelations = relations(propertyCleaners, ({ one }) => ({
  property: one(properties, { fields: [propertyCleaners.propertyId], references: [properties.id] }),
  cleaner: one(cleaners, { fields: [propertyCleaners.cleanerId], references: [cleaners.id] }),
}));
export const guestRegistrationsRelations = relations(guestRegistrations, ({ one }) => ({
  turnover: one(turnovers, { fields: [guestRegistrations.turnoverId], references: [turnovers.id] }),
}));
export const feedsRelations = relations(calendarFeeds, ({ one, many }) => ({
  property: one(properties, { fields: [calendarFeeds.propertyId], references: [properties.id] }),
  reservations: many(reservations),
}));
export const reservationsRelations = relations(reservations, ({ one }) => ({
  feed: one(calendarFeeds, { fields: [reservations.feedId], references: [calendarFeeds.id] }),
  turnover: one(turnovers, { fields: [reservations.id], references: [turnovers.reservationId] }),
}));
export const turnoversRelations = relations(turnovers, ({ one, many }) => ({
  property: one(properties, { fields: [turnovers.propertyId], references: [properties.id] }),
  reservation: one(reservations, { fields: [turnovers.reservationId], references: [reservations.id] }),
  cleaner: one(cleaners, { fields: [turnovers.cleanerId], references: [cleaners.id] }),
  checks: many(turnoverChecks),
  photos: many(photos),
  guestRegistration: one(guestRegistrations, { fields: [turnovers.id], references: [guestRegistrations.turnoverId] }),
}));
export const checklistRelations = relations(checklistItems, ({ one }) => ({
  property: one(properties, { fields: [checklistItems.propertyId], references: [properties.id] }),
}));
export const checksRelations = relations(turnoverChecks, ({ one }) => ({
  turnover: one(turnovers, { fields: [turnoverChecks.turnoverId], references: [turnovers.id] }),
  item: one(checklistItems, { fields: [turnoverChecks.itemId], references: [checklistItems.id] }),
}));
export const photosRelations = relations(photos, ({ one }) => ({
  turnover: one(turnovers, { fields: [photos.turnoverId], references: [turnovers.id] }),
}));

export type TurnoverStatus = (typeof turnoverStatus.enumValues)[number];
