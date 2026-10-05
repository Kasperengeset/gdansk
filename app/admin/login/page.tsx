"use client";

import { useActionState } from "react";
import { adminLoginAction } from "../actions";

export default function AdminLogin() {
  const [state, action, pending] = useActionState(adminLoginAction, undefined);
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
      <p className="eyebrow">Arrangør</p>
      <h1 className="mt-1 mb-6 text-3xl font-extrabold">Admin</h1>
      <form action={action} className="card space-y-4">
        <div>
          <label className="label" htmlFor="password">
            Passord
          </label>
          <input className="input" id="password" name="password" type="password" required autoFocus />
        </div>
        {state?.error && <p className="error">{state.error}</p>}
        <button className="btn btn-primary w-full" disabled={pending}>
          Logg inn
        </button>
      </form>
    </main>
  );
}
