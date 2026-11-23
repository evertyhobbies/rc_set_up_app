import Link from "next/link";
import type { RenderSection } from "@/lib/getSetupData";
import { ValueInput } from "./ValueInput";
import { Readout } from "./Readout";

const CORNERS = ["FL", "FR", "RL", "RR"] as const;

/** Every field on the template, grouped by section. Main tier by default, all tiers on request. */
export function AllFields({
  sections,
  setupId,
  path,
  tier,
  hrefFor,
}: {
  sections: RenderSection[];
  setupId: string;
  path: string;
  tier: "main" | "all";
  hrefFor: (tier: "main" | "all") => string;
}) {
  const visible = sections
    .map((s) => ({ ...s, fields: s.fields.filter((f) => tier === "all" || f.tier === "main") }))
    .filter((s) => s.fields.length);

  return (
    <div>
      <div className="mb-3 inline-flex rounded-md border border-line bg-surface-1 p-0.5 text-xs">
        {(["main", "all"] as const).map((t) => (
          <Link
            key={t}
            href={hrefFor(t)}
            className={`rounded px-3 py-1 font-medium ${tier === t ? "bg-surface-2 text-ink-primary" : "text-ink-muted"}`}
          >
            {t === "main" ? "Main" : "Main + detail"}
          </Link>
        ))}
      </div>
      {!visible.length && (
        <p className="py-6 text-sm text-ink-muted">
          No {tier === "main" ? "main " : ""}fields yet.{tier === "main" && " Switch to Main + detail to see the setup-sheet fields."}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {visible.map((section) => (
          <section key={section.key} className="rounded-md border border-line bg-surface-1 px-4 py-2">
            <h2 className="pb-1 pt-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-muted">{section.label}</h2>
            <div className="divide-y divide-line/60">
              {section.fields.flatMap((f) =>
                f.scope === "corner"
                  ? CORNERS.map((c) =>
                      f.type === "computed" ? (
                        <Readout key={f.id + c} field={f} corner={c} label={`${f.label} ${c}`} />
                      ) : (
                        <ValueInput key={f.id + c} field={f} corner={c} setupId={setupId} path={path} label={`${f.label} ${c}`} />
                      )
                    )
                  : [
                      f.type === "computed" ? (
                        <Readout key={f.id} field={f} highlight />
                      ) : (
                        <ValueInput key={f.id} field={f} setupId={setupId} path={path} />
                      ),
                    ]
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
