"use client";

import { useState, useEffect } from "react";
import { useAuth } from "./use-auth";
import { isSuperAdmin } from "@brayford/core";

/**
 * Hook to detect if current user is in support mode (super admin)
 *
 * Returns support mode status and loading state. Use this to conditionally
 * display the support mode banner and enable super admin features.
 *
 * @returns Object with isSupportMode boolean and loading state
 *
 * @example
 * ```tsx
 * function DashboardLayout() {
 *   const { isSupportMode, loading } = useSupportMode();
 *
 *   if (loading) return <LoadingSpinner />;
 *
 *   return (
 *     <>
 *       {isSupportMode && <SupportModeBanner />}
 *       <div className={isSupportMode ? "mt-12" : ""}>
 *         {children}
 *       </div>
 *     </>
 *   );
 * }
 * ```
 */
export function useSupportMode() {
  const { user } = useAuth();
  const [isSupportMode, setIsSupportMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsSupportMode(false);
      setLoading(false);
      return;
    }

    isSuperAdmin(user)
      .then((result) => {
        setIsSupportMode(result);
      })
      .catch((error) => {
        console.error("Error checking support mode:", error);
        setIsSupportMode(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user]);

  return { isSupportMode, loading };
}
