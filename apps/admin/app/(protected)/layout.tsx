import { AuthGuard } from "@/components/auth/AuthGuard";
import { Sidebar } from "@/components/layout/Sidebar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex h-screen bg-zinc-50">
        <Sidebar />
        <main className="flex-1 overflow-y-auto px-8 py-8">{children}</main>
      </div>
    </AuthGuard>
  );
}
