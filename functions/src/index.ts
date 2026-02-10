/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {initializeApp} from "firebase-admin/app";
import {sendDeletionCompleteEmail} from "@brayford/email-utils";
import type {OrganizationId} from "@brayford/core";
import {updateUserClaims} from "./claims.js";

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// ===== Claims Sync =====

/**
 * Firestore trigger: Sync custom claims when organisation membership changes
 *
 * Fires on any create, update, or delete of an organizationMembers document.
 * Rebuilds the user's full custom claims from all their current memberships,
 * then bumps claimsVersion on the user doc to trigger a client-side token refresh.
 *
 * This covers all membership mutations:
 * - Invitation accepted (member created)
 * - Role changed (member updated)
 * - Brand access changed (member updated)
 * - Member removed (member deleted)
 * - Organisation created (owner member created)
 */
export const onMembershipChange = onDocumentWritten(
  {
    document: "organizationMembers/{memberId}",
    maxInstances: 10,
  },
  async (event) => {
    // Get the userId from either the new or old document (handles deletes)
    const afterData = event.data?.after?.data();
    const beforeData = event.data?.before?.data();

    const userId = (afterData?.userId ?? beforeData?.userId) as string | undefined;

    if (!userId) {
      logger.warn("Membership change event with no userId", {
        memberId: event.params.memberId,
      });
      return;
    }

    const changeType = !beforeData ? "create" :
      !afterData ? "delete" : "update";

    logger.info(`Membership ${changeType} for user ${userId}`, {
      memberId: event.params.memberId,
      userId,
      changeType,
      organizationId: (afterData?.organizationId ?? beforeData?.organizationId) as string,
    });

    try {
      await updateUserClaims(userId);
    } catch (error) {
      logger.error(`Failed to update claims for user ${userId}:`, error);
      // Don't rethrow — we don't want infinite retries for permanent failures
    }
  },
);

// ===== Scheduled Functions =====

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

/**
 * Scheduled function: Clean up soft-deleted organisations
 * 
 * Runs daily at 2am UTC.
 * Permanently deletes organisations that were soft-deleted >= 28 days ago.
 * 
 * Process per organisation:
 * 1. Find all members, brands, invitations
 * 2. Delete members (and user accounts if they have no other org memberships)
 * 3. Delete brands
 * 4. Delete pending invitations
 * 5. Create permanent audit record in /deletedOrganizationsAudit
 * 6. Delete the organisation document
 * 7. Update deletion request status to 'completed'
 */
export const cleanupDeletedOrganizations = onSchedule(
  {
    schedule: "0 2 * * *", // Daily at 2am UTC
    timeZone: "UTC",
    maxInstances: 1,
  },
  async () => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000); // 28 days ago

    logger.info("Starting cleanup of soft-deleted organisations", {
      cutoffDate: cutoff.toISOString(),
    });

    // Find organisations that were soft-deleted >= 28 days ago
    const orgsQuery = await db
      .collection("organizations")
      .where("softDeletedAt", "<=", Timestamp.fromDate(cutoff))
      .get();

    if (orgsQuery.empty) {
      logger.info("No organisations to clean up");
      return;
    }

    logger.info(`Found ${orgsQuery.size} organisations to permanently delete`);

    for (const orgDoc of orgsQuery.docs) {
      const orgId = orgDoc.id;
      const orgData = orgDoc.data();

      try {
        logger.info(`Processing deletion of organisation: ${orgId} (${orgData.name})`);

        // Get counts for audit record
        const membersQuery = await db
          .collection("organizationMembers")
          .where("organizationId", "==", orgId)
          .get();

        const brandsQuery = await db
          .collection("brands")
          .where("organizationId", "==", orgId)
          .get();

        const memberCount = membersQuery.size;
        const brandCount = brandsQuery.size;

        // Collect member emails before deleting records (for completion emails)
        const memberEmails: string[] = [];
        for (const memberDoc of membersQuery.docs) {
          const memberData = memberDoc.data();
          const userId = memberData.userId;
          const userDoc = await db.collection("users").doc(userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data()!;
            if (userData.email) {
              memberEmails.push(userData.email);
            }
          }
        }

        // Process members: delete those with no other org memberships
        for (const memberDoc of membersQuery.docs) {
          const memberData = memberDoc.data();
          const userId = memberData.userId;

          // Check if user belongs to other organisations
          const otherMemberships = await db
            .collection("organizationMembers")
            .where("userId", "==", userId)
            .where("organizationId", "!=", orgId)
            .limit(1)
            .get();

          if (otherMemberships.empty) {
            // User only belongs to this org — delete user document
            try {
              await db.collection("users").doc(userId).delete();
              logger.info(`Deleted user ${userId} (no other org memberships)`);
            } catch (userErr) {
              logger.warn(`Failed to delete user ${userId}:`, userErr);
            }
          }

          // Delete member record
          await memberDoc.ref.delete();
        }

        // Delete brands
        for (const brandDoc of brandsQuery.docs) {
          await brandDoc.ref.delete();
        }

        // Delete pending invitations for this org
        const invitationsQuery = await db
          .collection("invitations")
          .where("organizationId", "==", orgId)
          .get();

        for (const invDoc of invitationsQuery.docs) {
          await invDoc.ref.delete();
        }

        // Create permanent audit record
        const deletionRequestId = orgData.deletionRequestId;
        let auditLog: unknown[] = [];
        let requestedBy = orgData.createdBy;
        let requestedAt = orgData.createdAt;
        let confirmedAt = orgData.softDeletedAt;

        if (deletionRequestId) {
          const reqDoc = await db
            .collection("organizationDeletionRequests")
            .doc(deletionRequestId)
            .get();

          if (reqDoc.exists) {
            const reqData = reqDoc.data()!;
            auditLog = reqData.auditLog || [];
            requestedBy = reqData.requestedBy;
            requestedAt = reqData.requestedAt;
            confirmedAt = reqData.confirmedAt;

            // Add completion entry to audit
            auditLog.push({
              timestamp: Timestamp.fromDate(now),
              action: "Permanent deletion executed by scheduled function",
              userId: null,
              metadata: {
                memberCount,
                brandCount,
                invitationsDeleted: invitationsQuery.size,
              },
            });

            // Update deletion request status
            await reqDoc.ref.update({
              status: "completed",
              auditLog,
            });
          }
        }

        // Create permanent audit record
        await db.collection("deletedOrganizationsAudit").add({
          organizationId: orgId,
          organizationName: orgData.name,
          deletionRequestId: deletionRequestId || "unknown",
          requestedBy,
          requestedAt,
          confirmedAt,
          completedAt: Timestamp.fromDate(now),
          memberCount,
          brandCount,
          auditLog,
        });

        // Delete the organisation document
        await orgDoc.ref.delete();

        logger.info(
          `Successfully deleted organisation ${orgId}: ` +
          `${memberCount} members, ${brandCount} brands, ` +
          `${invitationsQuery.size} invitations removed`
        );

        // Send completion emails to former members
        for (const email of memberEmails) {
          try {
            await sendDeletionCompleteEmail({
              recipientEmail: email,
              organizationName: orgData.name,
              deletionDate: now,
              organizationId: orgId as OrganizationId,
            });
          } catch (emailError) {
            logger.warn(`Failed to send completion email to ${email}:`, emailError);
          }
        }

      } catch (error) {
        logger.error(`Failed to delete organisation ${orgId}:`, error);
        // Continue with other organisations
      }
    }

    logger.info("Cleanup of soft-deleted organisations complete");
  }
);
