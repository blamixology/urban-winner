import { eq } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { inviteLink } from "@/lib/team";
import { createInvite, revokeInvite, updateAccountPhone } from "../actions";

export default async function Account() {
  const user = await requireUser();
  const [members, invite] = await Promise.all([
    db.query.users.findMany({ where: eq(s.users.organizationId, user.organizationId) }),
    db.query.teamInvites.findFirst({ where: eq(s.teamInvites.organizationId, user.organizationId) }),
  ]);

  return (
    <div className="max-w-md space-y-6">
      <h1 className="h1">Cont</h1>

      <section className="card space-y-3">
        <h2 className="h2">Telefonul tău</h2>
        <p className="text-sm text-neutral-500">Pentru alerte SMS când o curățenie e la risc (nepornită cu mai puțin de o oră înainte de check-in).</p>
        <form action={updateAccountPhone} className="flex gap-2">
          <input name="phone" defaultValue={user.phone ?? ""} placeholder="07…" className="input flex-1" />
          <button className="btn-ghost shrink-0">Salvează</button>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Echipa contului</h2>
        <ul className="space-y-1 text-sm">
          {members.map((m) => (
            <li key={m.id} className="flex justify-between">
              <span>{m.name || m.email}</span>
              <span className="text-neutral-500">{m.email}</span>
            </li>
          ))}
        </ul>
        {invite ? (
          <div className="space-y-2">
            <input readOnly value={inviteLink(invite.token)} className="input font-mono text-xs" />
            <div className="flex gap-2">
              <form action={createInvite}><button className="btn-ghost">Link nou</button></form>
              <form action={revokeInvite}><button className="btn-ghost">Anulează invitația</button></form>
            </div>
          </div>
        ) : (
          <form action={createInvite}><button className="btn-ghost">Invită un coleg</button></form>
        )}
      </section>
    </div>
  );
}
