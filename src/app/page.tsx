import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-20">
      <p className="text-sm font-medium text-emerald-700">Pentru gazde Airbnb &amp; Booking</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Curățenie între sejururi, fără haos pe WhatsApp.</h1>
      <p className="mt-4 text-neutral-600">
        Sincronizăm calendarele Airbnb și Booking, programăm automat curățenia, iar echipa ta primește un link
        cu checklist și poze. La final de lună ai decontul pe fiecare persoană, în lei.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/signup" className="btn">Începe gratuit</Link>
        <Link href="/login" className="btn-ghost">Autentificare</Link>
      </div>
    </main>
  );
}
