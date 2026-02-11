"use client";

import { ReactNode } from "react";
import { useSupportMode } from "@/hooks/use-support-mode";
import SupportModeBanner from "@/components/support/SupportModeBanner";

interface DashboardLayoutProps {
  children: ReactNode;
  organizationName?: string;
}

/**
 * Shared layout for all dashboard pages
 *
 * Handles support mode banner display and provides proper spacing
 * for the dashboard header and content. The banner appears automatically
 * when a super admin is viewing any organization.
 *
 * @param children - Dashboard page content
 * @param organizationName - Current organization name for support banner
 */
export default function DashboardLayoutWrapper({
  children,
  organizationName,
}: DashboardLayoutProps) {
  const { isSupportMode } = useSupportMode();

  return (
    <>
      {isSupportMode && (
        <SupportModeBanner organizationName={organizationName} />
      )}
      <div className={isSupportMode ? "pt-[52px]" : ""}>{children}</div>
    </>
  );
}
