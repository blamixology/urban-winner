import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

export { schema };
export type DB = NodePgDatabase<typeof schema>;

const g = globalThis as unknown as { db?: DB };
export const db: DB = g.db ?? drizzle(new Pool({ connectionString: process.env.DATABASE_URL, max: 10 }), { schema });
if (process.env.NODE_ENV !== "production") g.db = db;
