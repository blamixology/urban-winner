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

/** Plain signup creates a fresh organization; an invite token joins the inviter's instead. */
export async function signup(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = creds.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Email valid și parolă de minim 8 caractere." };
  const { email, password, name } = parsed.data;
  const inviteToken = String(form.get("inviteToken") || "").trim() || null;
  const passwordHash = await bcrypt.hash(password, 12);

  const result = await db.transaction(async (tx) => {
    let organizationId: string;
    if (inviteToken) {
      const invite = await tx.query.teamInvites.findFirst({ where: eq(s.teamInvites.token, inviteToken) });
      if (!invite) return { error: "Linkul de invitație nu mai este valid." } as const;
      organizationId = invite.organizationId;
    } else {
      const [org] = await tx.insert(s.organizations).values({}).returning({ id: s.organizations.id });
      organizationId = org.id;
    }
    const [user] = await tx
      .insert(s.users)
      .values({ organizationId, email, name: name || null, passwordHash })
      .onConflictDoNothing({ target: s.users.email })
      .returning({ id: s.users.id });
    if (!user) return { error: "Există deja un cont cu acest email." } as const;
    if (inviteToken) await tx.delete(s.teamInvites).where(eq(s.teamInvites.token, inviteToken));
    return { userId: user.id } as const;
  });

  if ("error" in result) return { error: result.error };
  await createSession(result.userId);
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
