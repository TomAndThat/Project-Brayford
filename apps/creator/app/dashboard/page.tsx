"use client";

import { useDashboardData } from "@/hooks/use-dashboard-data";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardLayoutWrapper from "@/components/dashboard/DashboardLayoutWrapper";
import OrgSwitcher from "@/components/dashboard/OrgSwitcher";
import DashboardQuickActions from "@/components/dashboard/DashboardQuickActions";
import DashboardEventsList from "@/components/dashboard/DashboardEventsList";

export default function DashboardPage() {
  const {
    user,
    loading,
    organization,
    events,
    allOrgs,
    currentMember,
    sandboxLoading,
    sandboxError,
    handleOrgChange,
    handleSignOut,
    handleOpenSandbox,
  } = useDashboardData();

  // ── Loading / guard states ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user || !organization) {
    return null;
  }

  return (
    <DashboardLayoutWrapper organizationName={organization.name}>
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader
          user={user}
          organizationName={organization.name}
          onSignOut={handleSignOut}
          currentMember={currentMember ?? undefined}
          orgSwitcher={
            allOrgs.length > 1 ? (
              <OrgSwitcher
                organizations={allOrgs}
                currentOrgId={organization.id}
                onOrgChange={handleOrgChange}
              />
            ) : undefined
          }
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Welcome Section */}
          <div className="bg-white rounded-lg shadow-md p-8 mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome to your Dashboard!
            </h2>
            <p className="text-lg text-gray-600">
              You&apos;re all set up. Let&apos;s create your first event.
            </p>
          </div>

          {/* Quick Actions */}
          {currentMember && (
            <DashboardQuickActions
              currentMember={currentMember}
              sandboxLoading={sandboxLoading}
              sandboxError={sandboxError}
              onOpenSandbox={handleOpenSandbox}
            />
          )}

          {/* Events Section */}
          <DashboardEventsList events={events} />
        </main>
      </div>
    </DashboardLayoutWrapper>
  );
}
