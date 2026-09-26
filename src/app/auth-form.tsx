"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, type AuthState } from "./auth-actions";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? login : signup, undefined);
  return (
    <main className="mx-auto max-w-sm px-4 py-20">
      <h1 className="h1">{mode === "login" ? "Autentificare" : "Cont nou"}</h1>
      <form action={action} className="mt-6 space-y-4">
        {mode === "signup" && (
          <div>
            <label className="label" htmlFor="name">Nume</label>
            <input className="input" id="name" name="name" autoComplete="name" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Parolă</label>
          <input className="input" id="password" name="password" type="password" required minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button className="btn w-full" disabled={pending}>{mode === "login" ? "Intră în cont" : "Creează cont"}</button>
      </form>
      <p className="mt-4 text-sm text-neutral-600">
        {mode === "login" ? <>Nu ai cont? <Link className="underline" href="/signup">Înregistrează-te</Link></>
          : <>Ai deja cont? <Link className="underline" href="/login">Autentifică-te</Link></>}
      </p>
    </main>
  );
}
