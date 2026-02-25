export default async function OrganisationDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-zinc-900">Organisation</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Detail view coming soon.{" "}
        <span className="font-mono text-xs text-zinc-400">{orgId}</span>
      </p>
    </div>
  );
}
