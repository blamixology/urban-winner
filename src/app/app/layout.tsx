import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "../auth-actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200 bg-white">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3 text-sm">
          <Link href="/app" className="font-semibold">urban-winner</Link>
          <Link href="/app" className="text-neutral-600 hover:text-neutral-900">Program</Link>
          <Link href="/app/properties" className="text-neutral-600 hover:text-neutral-900">Proprietăți</Link>
          <Link href="/app/cleaners" className="text-neutral-600 hover:text-neutral-900">Echipă</Link>
          <Link href="/app/payouts" className="text-neutral-600 hover:text-neutral-900">Decont</Link>
          <Link href="/app/compliance" className="text-neutral-600 hover:text-neutral-900">SITUR</Link>
          <Link href="/app/billing" className="text-neutral-600 hover:text-neutral-900">Abonament</Link>
          <span className="ml-auto text-neutral-500">{user.email}</span>
          <form action={logout}><button className="text-neutral-600 hover:text-neutral-900">Ieșire</button></form>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
