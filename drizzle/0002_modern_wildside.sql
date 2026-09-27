CREATE TABLE "guest_registrations" (
	"turnover_id" text PRIMARY KEY NOT NULL,
	"guest_name" text,
	"guest_id_doc" text,
	"guest_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"plan" "user_plan" DEFAULT 'FREE' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "property_cleaners" (
	"property_id" text NOT NULL,
	"cleaner_id" text NOT NULL,
	CONSTRAINT "property_cleaners_property_id_cleaner_id_pk" PRIMARY KEY("property_id","cleaner_id")
);
--> statement-breakpoint
CREATE TABLE "team_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "cleaners" DROP CONSTRAINT "cleaners_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "properties" DROP CONSTRAINT "properties_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "turnovers" ADD COLUMN "at_risk_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "turnovers" ADD COLUMN "issue_resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "organization_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_turnover_id_turnovers_id_fk" FOREIGN KEY ("turnover_id") REFERENCES "public"."turnovers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_cleaners" ADD CONSTRAINT "property_cleaners_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_cleaners" ADD CONSTRAINT "property_cleaners_cleaner_id_cleaners_id_fk" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaners" ADD CONSTRAINT "cleaners_owner_id_organizations_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_organizations_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;