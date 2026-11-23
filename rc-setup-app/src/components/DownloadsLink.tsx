"use client";

import { useState, useTransition } from "react";
import { saveDownloadsUrl } from "@/app/admin/models/[id]/actions";
import { btnGhost, btnPrimary, input } from "./PageHeader";

/** Admin field for the manufacturer's download page link. */
export function DownloadsLinkEditor({ carModelId, initial, path }: { carModelId: string; initial: string | null; path: string }) {
  const [url, setUrl] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = url.trim() !== saved;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          className={`${input} min-w-0 flex-1`}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://teamxray.com/x4/2026/en/download/"
          inputMode="url"
          aria-label="Manufacturer download page"
        />
        <button
          disabled={!dirty || pending}
          className={btnPrimary}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await saveDownloadsUrl(carModelId, url, path);
              if ("error" in res && res.error) setError(res.error);
              else setSaved(url.trim());
            })
          }
        >
          {pending ? "Saving…" : "Save link"}
        </button>
        {saved && !dirty && (
          <a href={saved} target="_blank" rel="noreferrer" className={btnGhost}>Open ↗</a>
        )}
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
