import { SignInButton } from "@/components/auth/SignInButton";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-zinc-900">
            Project Brayford
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Admin Portal</p>
        </div>

        <SignInButton />

        <p className="mt-6 text-center text-xs text-zinc-400">
          Access is restricted to Project Brayford staff.
        </p>
      </div>
    </div>
  );
}
