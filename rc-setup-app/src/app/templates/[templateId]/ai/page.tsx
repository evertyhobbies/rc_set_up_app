import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { rows, isUuid } from "@/lib/rows";
import { PageHeader } from "@/components/PageHeader";
import { AiBuilder } from "@/components/AiBuilder";

export const dynamic = "force-dynamic";

export default async function AiBuildPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ car?: string }>;
}) {
  const { templateId } = await params;
  const { car } = await searchParams;
  if (!isUuid(templateId)) notFound();
  const [t] = await rows<{ sheet_name: string | null; ai_sections: number }>(sql`
    SELECT sheet_name,
           (SELECT count(*)::int FROM template_sections s WHERE s.template_id = t.id AND s.source = 'ai') AS ai_sections
      FROM setup_templates t WHERE id = ${templateId}`);
  if (!t?.sheet_name) notFound();
  const back = car && isUuid(car) ? `/cars/${car}` : "/models";

  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-surface-0 px-5 py-8">
      <PageHeader back={back} eyebrow={t.sheet_name} title="Build setup with AI" />
      <p className="mb-5 max-w-3xl text-sm text-ink-secondary">
        Claude reads the sheet and splits it into sections, then reads each section up close and works out a label,
        unit, main/detail tier and storage for every box, linking boxes to your summary fields where they match.
        Nothing is saved until you review it and press Apply.
        {t.ai_sections > 0 && " Running it again keeps all entered values."}
      </p>
      <AiBuilder templateId={templateId} doneHref={back} />
    </main>
  );
}
