"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { signOut } from "@brayford/firebase-utils";
import { useAuth } from "@/contexts/auth";

export function Header() {
  const { user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.push("/login");
    } catch {
      // signOut from firebase-utils already logs the error
      setSigningOut(false);
    }
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-6">
      <span className="text-sm font-semibold tracking-tight text-zinc-900">
        Project Brayford
        <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-500">
          Admin
        </span>
      </span>

      <div className="flex items-center gap-3">
        {user?.photoURL && (
          <Image
            src={user.photoURL}
            alt={user.displayName ?? "User avatar"}
            width={28}
            height={28}
            className="rounded-full"
          />
        )}
        <span className="text-sm text-zinc-600">
          {user?.displayName ?? user?.email}
        </span>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="rounded-md px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </header>
  );
}
