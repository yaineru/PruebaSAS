import { ModulePage } from "@/components/module-page";
import { getModuleByKey } from "@/lib/modules";

export default async function MaintenancePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; q?: string; status?: string }>;
}) {
  const params = await searchParams;
  return (
    <ModulePage
      module={getModuleByKey("maintenance_records")!}
      error={params.error}
      q={params.q}
      status={params.status}
    />
  );
}
