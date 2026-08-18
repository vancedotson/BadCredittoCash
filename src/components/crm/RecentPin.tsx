"use client";

import { useEffect, useState } from "react";

type Item = { id: string; name: string };

/** Records this contact into "recently viewed" and offers a pin toggle. Both
 * persist in localStorage and are read by the nav (CrmChrome). */
export function RecentPin({ id, name }: { id: string; name: string }) {
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        const r: Item[] = JSON.parse(localStorage.getItem("crm-recent") || "[]").filter((x: Item) => x.id !== id);
        r.unshift({ id, name });
        localStorage.setItem("crm-recent", JSON.stringify(r.slice(0, 8)));
      } catch { /* ignore */ }
      try { setPinned((JSON.parse(localStorage.getItem("crm-pinned") || "[]") as Item[]).some((x) => x.id === id)); } catch { /* ignore */ }
    });
    return () => cancelAnimationFrame(raf);
  }, [id, name]);

  function toggle() {
    try {
      let p: Item[] = JSON.parse(localStorage.getItem("crm-pinned") || "[]");
      if (p.some((x) => x.id === id)) { p = p.filter((x) => x.id !== id); setPinned(false); }
      else { p.unshift({ id, name }); setPinned(true); }
      localStorage.setItem("crm-pinned", JSON.stringify(p.slice(0, 20)));
    } catch { /* ignore */ }
  }

  return (
    <button type="button" onClick={toggle} className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium ${pinned ? "border-gold bg-gold/10 text-gold-deep" : "border-mist text-slate hover:bg-cloud"}`} title={pinned ? "Unpin" : "Pin to nav"}>
      {pinned ? "★ Pinned" : "☆ Pin"}
    </button>
  );
}
