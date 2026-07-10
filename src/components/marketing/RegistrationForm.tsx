"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { track, getUtmParams } from "@/lib/tracking";
import { ButtonShine } from "./ButtonShine";

/**
 * Webinar registration form. Posts to /api/lead and tracks the behaviour.
 * Brand-styled: gold submit (Ink text), legible inputs, low-pressure copy.
 */
export function RegistrationForm() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      source: "vance-webinar",
      utm: getUtmParams(),
    };

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Registration failed.");
      }

      track("webinar_registered", { source: payload.source });
      router.push("/thank-you");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const inputClass =
    "w-full rounded-lg border border-mist bg-card px-4 py-3 text-body outline-none transition-colors placeholder:text-slate/60 focus:border-trust";

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-left">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-body">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          placeholder="Your name"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-body">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-medium text-body">
          Phone <span className="font-normal text-slate">(optional)</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="(405) 000-0000"
          className={inputClass}
        />
      </div>

      {error ? <p className="text-sm text-red">{error}</p> : null}

      <button
        type="submit"
        disabled={status === "loading"}
        className="relative min-h-[52px] w-full overflow-hidden rounded-full bg-gold px-6 py-4 font-heading text-[17px] font-semibold text-ink transition-colors hover:bg-gold-deep disabled:opacity-60"
      >
        {status === "loading" ? "Reserving your seat…" : "Save My Seat — Free"}
        <ButtonShine />
      </button>
      <p className="text-center text-sm text-slate">
        Free. No judgment. We&apos;ll email you the link. No spam, ever.
      </p>
    </form>
  );
}
