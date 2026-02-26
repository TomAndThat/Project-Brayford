"use client";

import {
  fromBranded,
  getRoleDisplayName,
  canModifyMemberRole,
  type OrganizationMemberDocument,
  type OrganizationId,
} from "@brayford/core";
import type { OrganizationMemberWithUser } from "@brayford/firebase-utils";
import type { InvitationDocument } from "@brayford/core";
import PendingInvitationsList from "@/components/invitations/PendingInvitationsList";

interface MembersTableProps {
  members: OrganizationMemberWithUser[];
  currentMember: OrganizationMemberDocument;
  currentUserId: string;
  organizationId: OrganizationId;
  invitations: InvitationDocument[];
  canInvite: boolean;
  canUpdateRoles: boolean;
  canRemove: boolean;
  onInviteUser: () => void;
  onEditUser: (member: OrganizationMemberWithUser) => void;
  onRemoveUser: (member: OrganizationMemberWithUser) => void;
  onRefresh: () => Promise<void>;
}

export default function MembersTable({
  members,
  currentMember,
  currentUserId,
  organizationId,
  invitations,
  canInvite,
  canUpdateRoles,
  canRemove,
  onInviteUser,
  onEditUser,
  onRemoveUser,
  onRefresh,
}: MembersTableProps) {
  // ── No members ──────────────────────────────────────────────────────
  if (members.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-12 text-center">
          <p className="text-gray-500">No team members found.</p>
        </div>
      </div>
    );
  }

  // ── Only the current user ───────────────────────────────────────────
  if (members.length === 1) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
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
            It&apos;s just you for now
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            Invite team members to collaborate on events and manage your
            organisation.
          </p>
          {canInvite && (
            <button
              onClick={onInviteUser}
              className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Invite Your First Team Member
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Members table ───────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
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
            const isCurrentUser = fromBranded(member.userId) === currentUserId;
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
                          {member.user?.displayName?.[0]?.toUpperCase() || "?"}
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
                    <span className="text-gray-400 italic">All brands</span>
                  ) : member.brandAccess.length === 0 ? (
                    <span className="text-gray-400 italic">No brands</span>
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
                            onClick={() => onEditUser(member)}
                            className="text-blue-600 hover:text-blue-900"
                            data-testid="edit-user-btn"
                          >
                            Edit
                          </button>
                        )}
                        {canRemove && (
                          <button
                            onClick={() => onRemoveUser(member)}
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
            invitations={invitations}
            organizationId={organizationId}
            canManageInvitations={canInvite}
            onRefresh={onRefresh}
          />
        </tbody>
      </table>
    </div>
  );
}
