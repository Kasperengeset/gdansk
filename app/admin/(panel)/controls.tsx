"use client";

// Små klientkomponenter for adminhandlinger: knapper med bekreftelse og skjemaer med feilmelding.

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { ActionResult } from "../actions";

export function ActionButton({
  action,
  children,
  confirm,
  className = "btn",
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  confirm?: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  return (
    <span className="inline-flex flex-col">
      <button
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          startTransition(async () => setError((await action())?.error));
        }}
      >
        {children}
      </button>
      {error && <span className="error mt-1">{error}</span>}
    </span>
  );
}

/**
 * Skjema som sender til en server action. Bruker onSubmit i stedet for `action`-propen,
 * slik at React ikke tømmer feltene når serveren svarer med en feilmelding.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        startTransition(async () => {
          const result = await action(undefined, data);
          setError(result?.error);
          if (result?.ok && resetOnSuccess) form.reset();
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {error && <p className="error mt-2">{error}</p>}
    </form>
  );
}

/** Henter siden på nytt med jevne mellomrom, så oversikten er fersk. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
