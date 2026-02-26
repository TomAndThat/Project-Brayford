"use client";

import { useState } from "react";
import type { OrganizationMemberWithUser } from "@brayford/firebase-utils";
import { useUsersPageData } from "@/hooks/use-users-page-data";
import { useToast } from "@/components/shared/Toast";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import MembersTable from "@/components/users/MembersTable";
import RolesInfoBox from "@/components/users/RolesInfoBox";
import InviteUserModal from "@/components/invitations/InviteUserModal";
import EditMemberModal from "@/components/users/EditMemberModal";
import RemoveUserConfirmDialog from "@/components/users/RemoveUserConfirmDialog";

export default function UsersPage() {
  const { showToast } = useToast();
  const {
    user,
    loading,
    organization,
    currentMember,
    members,
    brands,
    pendingInvitations,
    canInvite,
    canUpdateRoles,
    canRemove,
    reload,
    handleSignOut,
    handleRemoveUser,
  } = useUsersPageData();

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [userToRemove, setUserToRemove] =
    useState<OrganizationMemberWithUser | null>(null);
  const [userToEdit, setUserToEdit] =
    useState<OrganizationMemberWithUser | null>(null);

  // ── Loading / guard states ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user || !organization || !currentMember) {
    return null;
  }

  const confirmRemove = async () => {
    if (!userToRemove) return;
    await handleRemoveUser(userToRemove);
    setUserToRemove(null);
  };

  const handleEditSuccess = async () => {
    await reload();
    showToast("Member updated successfully", { variant: "success" });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        organizationName={organization.name}
        onSignOut={handleSignOut}
        currentMember={currentMember}
        pageTitle="Team Members"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header with Invite Button */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Team Members</h2>
            <p className="text-gray-600 mt-1">
              Manage who has access to your organisation
            </p>
          </div>
          {canInvite && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              data-testid="invite-user-btn"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Invite User
            </button>
          )}
        </div>

        {/* Members Table */}
        <MembersTable
          members={members}
          currentMember={currentMember}
          currentUserId={user.uid}
          organizationId={organization.id}
          invitations={pendingInvitations}
          canInvite={canInvite}
          canUpdateRoles={canUpdateRoles}
          canRemove={canRemove}
          onInviteUser={() => setIsInviteModalOpen(true)}
          onEditUser={setUserToEdit}
          onRemoveUser={setUserToRemove}
          onRefresh={reload}
        />

        {/* Roles Info */}
        <RolesInfoBox />
      </main>

      {/* Invite User Modal */}
      <InviteUserModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        organizationId={organization.id}
        organizationName={organization.name}
        currentMember={currentMember}
        brands={brands}
        onSuccess={reload}
      />

      {/* Edit Member Modal */}
      {userToEdit && (
        <EditMemberModal
          isOpen={true}
          member={userToEdit}
          currentMember={currentMember}
          brands={brands}
          onClose={() => setUserToEdit(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Remove User Confirmation Dialog */}
      {userToRemove && (
        <RemoveUserConfirmDialog
          isOpen={true}
          userName={userToRemove.user?.displayName || "User"}
          userEmail={userToRemove.user?.email || ""}
          organizationName={organization.name}
          onConfirm={confirmRemove}
          onCancel={() => setUserToRemove(null)}
        />
      )}
    </div>
  );
}
