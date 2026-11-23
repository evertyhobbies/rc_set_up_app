import { NewModelWizard } from "@/components/NewModelWizard";

export default async function NewModelPage({ searchParams }: { searchParams: Promise<{ admin?: string }> }) {
  const { admin } = await searchParams;
  return <NewModelWizard admin={admin !== undefined} />;
}
