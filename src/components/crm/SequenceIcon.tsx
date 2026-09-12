type IconName = "email" | "people" | "clock" | "retry" | "sent" | "alert" | "settings" | "chevron" | "info";

export function SequenceIcon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {name === "email" ? <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 6 8 6 8-6" /></> : null}
      {name === "people" ? <><circle cx="9" cy="8" r="3" /><path d="M3 21v-2a6 6 0 0 1 12 0v2m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2" /></> : null}
      {name === "clock" ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> : null}
      {name === "retry" ? <path d="M20 7a9 9 0 0 0-15-1L3 9m0-5v5h5M4 17a9 9 0 0 0 15 1l2-3m0 5v-5h-5" /> : null}
      {name === "sent" ? <path d="m21 3-7 18-4-7-7-4 18-7ZM10 14 21 3" /> : null}
      {name === "alert" ? <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5m0 3h.01" /></> : null}
      {name === "settings" ? <><path d="m9 3-.5 3-2 1-3-.5-1 3 2.5 2v2L2.5 15l1 3 3-.5 2 1 .5 3h6l.5-3 2-1 3 .5 1-3-2.5-1.5v-2l2.5-2-1-3-3 .5-2-1L15 3H9Z" /><circle cx="12" cy="12" r="3" /></> : null}
      {name === "chevron" ? <path d="m5 9 7 7 7-7" /> : null}
      {name === "info" ? <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10h.01" /></> : null}
    </svg>
  );
}
