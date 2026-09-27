import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema as s } from "@/lib/db";
import { AuthForm } from "../../auth-form";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await db.query.teamInvites.findFirst({ where: eq(s.teamInvites.token, token) });
  if (!invite) notFound();
  return <AuthForm mode="signup" inviteToken={token} />;
}
