"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  getUserOrganizations,
  getOrganization,
  getOrganizationMembersWithUsers,
  type OrganizationMemberWithUser,
} from "@brayford/firebase-utils";
import {
  toBranded,
  fromBranded,
  type UserId,
  type OrganizationDocument,
  type OrganizationMemberDocument,
  hasPermission,
  USERS_INVITE,
  USERS_UPDATE_ROLE,
  USERS_REMOVE,
  canModifyMemberRole,
  getRoleDisplayName,
} from "@brayford/core";

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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin");
      return;
    }

    if (user) {
      loadUserData();
    }
  }, [user, authLoading, router]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [dropdownOpen]);

  const loadUserData = async () => {
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
        // Load all members with user details
        const orgMembers = await getOrganizationMembersWithUsers(orgId);
        setMembers(orgMembers);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await signOut();
    router.push("/signin");
  };

  const handleInviteUser = () => {
    // TODO: Open invite modal
    alert("Invite user functionality coming soon!");
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
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <button
              onClick={() => router.push("/dashboard")}
              className="text-sm text-blue-600 hover:text-blue-800 mb-1 flex items-center gap-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
            <p className="text-sm text-gray-500">{organization.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-3 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
              >
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700">
                    {user.displayName}
                  </p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-pink-500 flex items-center justify-center text-white font-semibold">
                    {user.displayName?.charAt(0).toUpperCase() || "U"}
                  </div>
                )}
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-200">
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

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
                                  onClick={() =>
                                    alert(
                                      "Change role functionality coming soon!",
                                    )
                                  }
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  Edit
                                </button>
                              )}
                              {canRemove && (
                                <button
                                  onClick={() =>
                                    alert(
                                      "Remove user functionality coming soon!",
                                    )
                                  }
                                  className="text-red-600 hover:text-red-900"
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
              </tbody>
            </table>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
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
    </div>
  );
}
