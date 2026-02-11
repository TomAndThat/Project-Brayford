export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="mb-4 text-2xl font-semibold text-zinc-900">No Access</h1>
        <p className="text-lg text-zinc-600">
          You don't have access to any events. Scan a QR code at the event
          you're at to get involved.
        </p>
      </div>
    </div>
  );
}
