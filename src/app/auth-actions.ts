"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema as s } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";

export type AuthState = { error?: string } | undefined;

const creds = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  name: z.string().trim().max(100).optional(),
});

export async function signup(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = creds.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Email valid și parolă de minim 8 caractere." };
  const { email, password, name } = parsed.data;
  const [user] = await db
    .insert(s.users)
    .values({ email, name: name || null, passwordHash: await bcrypt.hash(password, 12) })
    .onConflictDoNothing({ target: s.users.email })
    .returning({ id: s.users.id });
  if (!user) return { error: "Există deja un cont cu acest email." };
  await createSession(user.id);
  redirect("/app");
}

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = creds.omit({ name: true }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Email sau parolă greșită." };
  const user = await db.query.users.findFirst({ where: eq(s.users.email, parsed.data.email) });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return { error: "Email sau parolă greșită." };
  await createSession(user.id);
  redirect("/app");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}
