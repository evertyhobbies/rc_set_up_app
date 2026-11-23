import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { carModels, modelFiles } from "@/db/schema";
import { isUuid } from "@/lib/rows";
import { templateForModel } from "@/lib/templates";
import { ensureMaster, eventDefaults, listVersions } from "@/lib/modelSetups";
import { PageHeader, btnGhost, btnPrimary } from "@/components/PageHeader";
import { SaveVersionForm } from "@/components/SaveVersionForm";
import { ImportFilledSheet } from "@/components/ImportFilledSheet";
import { FileManager } from "@/components/FileManager";

export const dynamic = "force-dynamic";

/** A model/year: its master setup (edited on the PDF sheet) and saved versions. */
export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [model] = await db.select().from(carModels).where(eq(carModels.id, id));
  if (!model) notFound();

  const template = await templateForModel(model.id);
  const master = await ensureMaster(model.id);
  const [versions, files, defaults] = await Promise.all([
    listVersions(model.id),
    db.select().from(modelFiles).where(eq(modelFiles.carModelId, model.id)).orderBy(desc(modelFiles.createdAt)),
    eventDefaults(template.id, master.id),
  ]);
  const base = `/models/${model.id}/setups`;

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-surface-0 px-5 py-8">
      <PageHeader
        back="/models"
        eyebrow={`${model.carClass}${model.scale ? ` · ${model.scale}` : ""}`}
        title={`${model.manufacturer} ${model.name}`}
        right={<Link href={`/admin/models/${model.id}`} className={btnGhost}>Admin</Link>}
      />

      {!template.sheetName ? (
        <section className="mb-6 rounded-md border border-warn/40 bg-warn/5 p-4 text-sm text-ink-secondary">
          No setup sheet for this model yet.{" "}
          <Link href={`/admin/models/${model.id}`} className="text-accent">Upload it in Admin</Link> to start the master setup.
        </section>
      ) : (
        <>
          <section className="mb-5 rounded-md border border-accent/40 bg-surface-1 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-accent">Master</div>
                <div className="text-sm text-ink-secondary">The working setup: edit it on the sheet, then save versions.</div>
              </div>
              <div className="flex gap-2">
                <Link href={`${base}/${master.id}?view=summary`} className={btnGhost}>Summary</Link>
                <Link href={`${base}/${master.id}?view=sheet`} className={btnPrimary}>Edit on sheet</Link>
              </div>
            </div>
            <div className="mt-4 border-t border-line pt-4">
              <SaveVersionForm
                carModelId={model.id}
                nextVersion={(versions[0]?.versionNo ?? 0) + 1}
                defaults={defaults}
                versionsBase={base}
              />
            </div>
          </section>

          <section className="mb-8">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Versions</h2>
            </div>
            <div className="mb-3">
              <ImportFilledSheet carModelId={model.id} templateId={template.id} nextVersion={(versions[0]?.versionNo ?? 0) + 1} />
            </div>
            {versions.length === 0 && <p className="text-sm text-ink-muted">No versions yet. Save the master as v1 when it&apos;s ready.</p>}
            <div className="flex flex-col gap-2">
              {versions.map((v) => (
                <Link
                  key={v.id}
                  href={`${base}/${v.id}?view=summary`}
                  className="flex items-center gap-3 rounded-md border border-line bg-surface-1 px-4 py-3 transition-colors hover:border-accent/40"
                >
                  <span className="w-10 shrink-0 font-mono text-sm text-accent">v{v.versionNo}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink-primary">{v.name}</div>
                    <div className="text-xs text-ink-secondary">
                      {[v.track, v.eventDate?.toISOString().slice(0, 10)].filter(Boolean).join(" · ") || `Saved ${v.createdAt.toISOString().slice(0, 10)}`}
                    </div>
                  </div>
                  <span className="font-mono text-xs text-ink-muted">→</span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Files</h2>
          {model.downloadsUrl && (
            <a href={model.downloadsUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-accent">
              {model.manufacturer} downloads ↗
            </a>
          )}
        </div>
        <FileManager
          carModelId={model.id}
          readOnly
          files={files.map((f) => ({ id: f.id, kind: f.kind, title: f.title, filename: f.filename, size: f.size, createdAt: f.createdAt.toISOString() }))}
        />
      </section>
    </main>
  );
}
