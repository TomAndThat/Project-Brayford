"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  getUserOrganizations,
  getOrganization,
  getOrganizationMembersWithUsers,
  getOrganizationBrands,
  getOrganizationPendingInvitations,
  type OrganizationMemberWithUser,
} from "@brayford/firebase-utils";
import {
  toBranded,
  fromBranded,
  type UserId,
  type OrganizationDocument,
  type OrganizationMemberDocument,
  type BrandDocument,
  type InvitationDocument,
  hasPermission,
  USERS_VIEW,
  USERS_INVITE,
  USERS_UPDATE_ROLE,
  USERS_REMOVE,
  canModifyMemberRole,
  getRoleDisplayName,
} from "@brayford/core";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import InviteUserModal from "@/components/invitations/InviteUserModal";
import PendingInvitationsList from "@/components/invitations/PendingInvitationsList";
import RemoveUserConfirmDialog from "@/components/users/RemoveUserConfirmDialog";
import EditMemberModal from "@/components/users/EditMemberModal";

export default function UsersPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [currentMember, setCurrentMember] =
    useState<OrganizationMemberDocument | null>(null);
  const [members, setMembers] = useState<OrganizationMemberWithUser[]>([]);
  const [brands, setBrands] = useState<BrandDocument[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<
    InvitationDocument[]
  >([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [userToRemove, setUserToRemove] =
    useState<OrganizationMemberWithUser | null>(null);
  const [userToEdit, setUserToEdit] =
    useState<OrganizationMemberWithUser | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const loadUserData = useCallback(async () => {
    if (!user) return;

    try {
      const userId = toBranded<UserId>(user.uid);
      const memberships = await getUserOrganizations(userId);

      if (memberships.length === 0) {
        router.push("/onboarding");
        return;
      }

      // Get first organization and current member record
      const currentMembership = memberships[0]!;
      setCurrentMember(currentMembership);

      const orgId = currentMembership.organizationId;
      const org = await getOrganization(orgId);

      if (org) {
        setOrganization(org);
        // Load members, brands, and invitations in parallel
        const [orgMembers, orgBrands, orgInvitations] = await Promise.all([
          getOrganizationMembersWithUsers(orgId),
          getOrganizationBrands(orgId),
          getOrganizationPendingInvitations(orgId),
        ]);
        setMembers(orgMembers);
        setBrands(orgBrands);
        setPendingInvitations(orgInvitations);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin");
      return;
    }

    if (user) {
      loadUserData();
    }
  }, [user, authLoading, router, loadUserData]);

  // Check permissions after data loads
  useEffect(() => {
    if (!loading && currentMember && organization) {
      if (!hasPermission(currentMember, USERS_VIEW)) {
        alert("You don't have permission to view team members.");
        router.push("/dashboard");
      }
    }
  }, [loading, currentMember, organization, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/signin");
  };

  const handleInviteUser = () => {
    setIsInviteModalOpen(true);
  };

  const handleInviteSuccess = () => {
    // Reload data to show updated pending invitations
    loadUserData();
  };

  const handleEditUser = (member: OrganizationMemberWithUser) => {
    setUserToEdit(member);
  };

  const handleEditSuccess = async () => {
    // Reload data to show updated member info
    await loadUserData();

    // Show success notification
    setNotification({
      type: "success",
      message: "Member updated successfully",
    });

    // Auto-hide notification after 5 seconds
    setTimeout(() => setNotification(null), 5000);
  };

  const handleRemoveUser = (member: OrganizationMemberWithUser) => {
    setUserToRemove(member);
  };

  const confirmRemoveUser = async () => {
    if (!userToRemove || !organization || !user) return;

    const userName =
      userToRemove.user?.displayName || userToRemove.user?.email || "this user";

    try {
      // Get ID token for API authentication
      const idToken = await user.getIdToken();

      // Call secure API route (uses Firebase Admin SDK)
      const response = await fetch(
        `/api/organizations/${fromBranded(organization.id)}/members/${fromBranded(userToRemove.id)}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove user");
      }

      // Update local state to remove member from table
      setMembers((prev) => prev.filter((m) => m.id !== userToRemove.id));

      // Show success notification
      setNotification({
        type: "success",
        message: `${userName} has been removed from the organisation`,
      });

      // Auto-hide notification after 5 seconds
      setTimeout(() => setNotification(null), 5000);
    } catch (error) {
      console.error("Error removing user:", error);
      setNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to remove user. Please try again.",
      });
      // Auto-hide error after 7 seconds
      setTimeout(() => setNotification(null), 7000);
    } finally {
      setUserToRemove(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user || !organization || !currentMember) {
    return null;
  }

  // Check permissions for current user
  const canInvite = hasPermission(currentMember, USERS_INVITE);
  const canUpdateRoles = hasPermission(currentMember, USERS_UPDATE_ROLE);
  const canRemove = hasPermission(currentMember, USERS_REMOVE);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        organizationName={organization.name}
        onSignOut={handleSignOut}
        currentMember={currentMember}
        pageTitle="Team Members"
        breadcrumb={{
          label: "Back to Dashboard",
          onClick: () => router.push("/dashboard"),
        }}
      />

      {/* Notification Banner */}
      {notification && (
        <div
          className={`fixed top-20 right-4 z-50 max-w-md rounded-lg shadow-lg p-4 ${
            notification.type === "success"
              ? "bg-green-50 border border-green-200"
              : "bg-red-50 border border-red-200"
          }`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {notification.type === "success" ? (
                <svg
                  className="h-5 w-5 text-green-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5 text-red-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <div className="ml-3 flex-1">
              <p
                className={`text-sm font-medium ${
                  notification.type === "success"
                    ? "text-green-800"
                    : "text-red-800"
                }`}
              >
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className={`ml-3 inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                notification.type === "success"
                  ? "text-green-500 hover:bg-green-100 focus:ring-green-600"
                  : "text-red-500 hover:bg-red-100 focus:ring-red-600"
              }`}
            >
              <span className="sr-only">Dismiss</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
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
              onClick={handleInviteUser}
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

        {/* Members List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {members.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500">No team members found.</p>
            </div>
          ) : members.length === 1 ? (
            <div className="p-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                It's just you for now
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Invite team members to collaborate on events and manage your
                organisation.
              </p>
              {canInvite && (
                <button
                  onClick={handleInviteUser}
                  className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Invite Your First Team Member
                </button>
              )}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Brand Access
                  </th>
                  {(canUpdateRoles || canRemove) && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {members.map((member) => {
                  const isCurrentUser = fromBranded(member.userId) === user.uid;
                  const canModify = canModifyMemberRole(currentMember, member);

                  return (
                    <tr key={fromBranded(member.id)}>
                      {/* User Info */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {member.user?.photoURL ? (
                            <img
                              src={member.user.photoURL}
                              alt={member.user.displayName || "User"}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-gray-600 font-medium">
                                {member.user?.displayName?.[0]?.toUpperCase() ||
                                  "?"}
                              </span>
                            </div>
                          )}
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {member.user?.displayName || "Unknown User"}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-gray-500">
                                  (You)
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {member.user?.email || "No email"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            member.role === "owner"
                              ? "bg-purple-100 text-purple-800"
                              : member.role === "admin"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {getRoleDisplayName(member.role)}
                        </span>
                      </td>

                      {/* Joined Date */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {member.joinedAt.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      {/* Brand Access */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {member.role === "owner" || member.role === "admin" ? (
                          <span className="text-gray-400 italic">
                            All brands
                          </span>
                        ) : member.brandAccess.length === 0 ? (
                          <span className="text-gray-400 italic">
                            No brands
                          </span>
                        ) : (
                          <span>
                            {member.brandAccess.length} brand
                            {member.brandAccess.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      {(canUpdateRoles || canRemove) && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {canModify && !isCurrentUser ? (
                            <div className="flex justify-end gap-2">
                              {canUpdateRoles && (
                                <button
                                  onClick={() => handleEditUser(member)}
                                  className="text-blue-600 hover:text-blue-900"
                                  data-testid="edit-user-btn"
                                >
                                  Edit
                                </button>
                              )}
                              {canRemove && (
                                <button
                                  onClick={() => handleRemoveUser(member)}
                                  className="text-red-600 hover:text-red-900"
                                  data-testid="remove-user-btn"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}

                {/* Pending Invitations */}
                <PendingInvitationsList
                  invitations={pendingInvitations}
                  organizationId={organization.id}
                  canManageInvitations={canInvite}
                  onRefresh={loadUserData}
                />
              </tbody>
            </table>
          )}
        </div>

        {/* Info Box */}
        <div
          className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4"
          data-testid="roles-info-box"
        >
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">About Roles</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <strong>Owner:</strong> Full control including billing and
                    organisation settings
                  </li>
                  <li>
                    <strong>Admin:</strong> Can manage team members and all
                    brands
                  </li>
                  <li>
                    <strong>Member:</strong> Access to assigned brands only
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Invite User Modal */}
      {currentMember && organization && (
        <InviteUserModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          organizationId={organization.id}
          organizationName={organization.name}
          currentMember={currentMember}
          brands={brands}
          onSuccess={handleInviteSuccess}
        />
      )}

      {/* Edit Member Modal */}
      {userToEdit && currentMember && organization && (
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
      {userToRemove && organization && (
        <RemoveUserConfirmDialog
          isOpen={true}
          userName={userToRemove.user?.displayName || "User"}
          userEmail={userToRemove.user?.email || ""}
          organizationName={organization.name}
          onConfirm={confirmRemoveUser}
          onCancel={() => setUserToRemove(null)}
        />
      )}
    </div>
  );
}
