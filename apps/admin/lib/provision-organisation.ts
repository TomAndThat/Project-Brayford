/**
 * Provision Organisation
 *
 * Handles the admin-side provisioning of a new organisation:
 * 1. Creates the Firestore organisation document
 * 2. Creates a 30-day owner invitation
 * 3. Queues the invitation email via the emailQueue collection
 *
 * Only callable by superAdmins (Firestore rules enforce this).
 */

import { collection, doc, setDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db, createInvitation } from "@brayford/firebase-utils";
import { generateInvitationToken } from "@brayford/core";

export interface ProvisionOrganisationInput {
  name: string;
  billingEmail: string;
  billingMethod: "enterprise" | "self_serve";
  billingTier: "per_brand" | "flat_rate";
  type: "individual" | "team" | "enterprise";
  primaryEmailDomain: string;
  ownerName: string;
  ownerEmail: string;
  provisionedByUid: string;
  superAdminName: string;
}

const OWNER_INVITATION_EXPIRY_DAYS = 30;

export async function provisionOrganisation(
  input: ProvisionOrganisationInput,
): Promise<string> {
  const orgRef = doc(collection(db, "organizations"));
  const orgId = orgRef.id;

  // 1. Create organisation document
  await setDoc(orgRef, {
    name: input.name,
    billingEmail: input.billingEmail.toLowerCase().trim(),
    billingMethod: input.billingMethod,
    billingTier: input.billingTier,
    type: input.type,
    primaryEmailDomain: input.primaryEmailDomain.toLowerCase().trim(),
    allowedDomains: [],
    requireDomainMatch: false,
    domainVerified: false,
    createdAt: serverTimestamp(),
    createdBy: input.provisionedByUid,
    deletionRequestId: null,
    softDeletedAt: null,
  });

  // 2. Create owner invitation (30-day expiry — longer than the standard 7 days
  //    used for team invitations, to allow for enterprise onboarding timelines)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + OWNER_INVITATION_EXPIRY_DAYS);

  const token = generateInvitationToken();

  await createInvitation({
    email: input.ownerEmail,
    organizationId: orgId,
    organizationName: input.name,
    role: "owner",
    brandAccess: [],
    autoGrantNewBrands: true,
    invitedBy: input.provisionedByUid,
    token,
    expiresAt,
    metadata: {
      inviterName: "Project Brayford Admin",
    },
  });

  // 3. Queue the owner invitation email
  const creatorAppUrl =
    process.env.NEXT_PUBLIC_CREATOR_APP_URL ?? "http://localhost:3001";

  const supportUrl =
    process.env.NEXT_PUBLIC_SUPPORT_URL ?? "https://brayford.live/support";

  await addDoc(collection(db, "emailQueue"), {
    type: "org-owner-invitation",
    deliveryMode: "immediate",
    status: "pending",
    to: input.ownerEmail.toLowerCase().trim(),
    templateAlias: "pb-admin-org-owner-invitation",
    templateData: {
      name: input.ownerName,
      org_name: input.name,
      action_url: `${creatorAppUrl}/invitation/${token}`,
      support_url: supportUrl,
      superadmin_name: input.superAdminName,
    },
    metadata: {
      organizationId: orgId,
      userId: input.provisionedByUid,
    },
    createdAt: serverTimestamp(),
    attempts: 0,
  });

  return orgId;
}
