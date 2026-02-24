"use client";

import { useEffect, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { onAuthChange } from "@brayford/firebase-utils";
import { isSuperAdmin as checkSuperAdmin } from "@brayford/core";
import { AuthContext } from "@/contexts/auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        const adminStatus = await checkSuperAdmin(firebaseUser);
        setIsSuperAdmin(adminStatus);
      } else {
        setIsSuperAdmin(false);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, isSuperAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
