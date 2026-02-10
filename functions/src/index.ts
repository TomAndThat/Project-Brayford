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
import {onRequest} from "firebase-functions/v2/https";
import {onDocumentWritten, onDocumentCreated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {getFirestore, Timestamp, FieldValue} from "firebase-admin/firestore";
import {initializeApp} from "firebase-admin/app";
import type {OrganizationId, EmailQueueDocument, EmailQueueId} from "@brayford/core";
import {updateUserClaims} from "./claims.js";
import {
  sendEmail,
  checkAndIncrementRateLimit,
  isDevMode,
  logEmailConfig,
  logBatchSummary,
} from "./email/index.js";

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
            await db.collection("emailQueue").add({
              type: "organization-deletion",
              deliveryMode: "batch",
              status: "pending",
              to: email,
              templateAlias: "organization-deletion-complete",
              templateData: {
                organizationName: orgData.name,
                deletionDate: now.toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }),
              },
              metadata: {
                organizationId: orgId,
              },
              createdAt: FieldValue.serverTimestamp(),
              attempts: 0,
            });
          } catch (emailError) {
            logger.warn(`Failed to queue completion email to ${email}:`, emailError);
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

// ===== Email Queue Processing =====

/**
 * Process transactional (immediate) emails
 *
 * Triggered when a new document is created in the emailQueue collection.
 * Only processes emails with deliveryMode = 'immediate'.
 * Batch emails are handled by processBulkEmailBatch.
 *
 * Flow:
 * 1. Check deliveryMode - exit if 'batch'
 * 2. Check rate limit for the email's scope
 * 3. If allowed: send via Postmark, update status to 'sent'
 * 4. If rate-limited: update status to 'rate-limited'
 * 5. If error: update status to 'failed' with error details
 */
export const processTransactionalEmail = onDocumentCreated(
  {
    document: "emailQueue/{emailId}",
    region: "europe-west2",
    memory: "256MiB",
    timeoutSeconds: 60,
    retry: true, // Automatic retries on failure
  },
  async (event) => {
    const emailId = event.params.emailId as EmailQueueId;
    const emailData = event.data?.data() as EmailQueueDocument | undefined;

    if (!emailData) {
      logger.error("No email data in created document", { emailId });
      return;
    }

    // Skip batch emails - they're processed by the scheduled function
    if (emailData.deliveryMode === "batch") {
      logger.debug("Skipping batch email (processed by scheduled function)", {
        emailId,
        type: emailData.type,
      });
      return;
    }

    logger.info("Processing transactional email", {
      emailId,
      type: emailData.type,
      to: emailData.to,
      template: emailData.templateAlias,
      devMode: isDevMode(),
    });

    const emailRef = db.collection("emailQueue").doc(emailId);

    // Update status to processing
    await emailRef.update({
      status: "processing",
      processedAt: Timestamp.now(),
      attempts: FieldValue.increment(1),
      lastAttemptAt: Timestamp.now(),
    });

    // Check rate limit
    const rateLimitScope = emailData.rateLimitScope ||
      `${emailData.metadata.organizationId ? "organization:" + emailData.metadata.organizationId : "global"}`;

    const rateLimitResult = await checkAndIncrementRateLimit(
      rateLimitScope,
      emailData.type
    );

    if (!rateLimitResult.allowed) {
      logger.warn("Email rate-limited", {
        emailId,
        scope: rateLimitScope,
        type: emailData.type,
        currentCount: rateLimitResult.currentCount,
        maxAllowed: rateLimitResult.maxAllowed,
        resetAt: rateLimitResult.resetAt,
      });

      await emailRef.update({
        status: "rate-limited",
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: `Rate limit exceeded for ${rateLimitScope} (${rateLimitResult.currentCount}/${rateLimitResult.maxAllowed} per minute)`,
          timestamp: Timestamp.now(),
        },
      });

      return;
    }

    // Send email
    const sendResult = await sendEmail(emailId, emailData);

    if (sendResult.success) {
      await emailRef.update({
        status: "sent",
        sentAt: Timestamp.fromDate(sendResult.sentAt!),
        postmarkMessageId: sendResult.messageId,
      });

      logger.info("Email sent successfully", {
        emailId,
        messageId: sendResult.messageId,
        to: emailData.to,
      });
    } else {
      await emailRef.update({
        status: "failed",
        error: {
          code: sendResult.error?.code || "UNKNOWN",
          message: sendResult.error?.message || "Unknown error",
          timestamp: Timestamp.now(),
        },
      });

      logger.error("Email send failed", {
        emailId,
        error: sendResult.error,
        to: emailData.to,
      });

      // Throw to trigger Cloud Functions retry
      throw new Error(`Email send failed: ${sendResult.error?.message}`);
    }
  }
);

/**
 * Process bulk (batch) emails on a schedule
 *
 * Runs every minute and processes up to 50 pending batch emails.
 * Uses jitter to spread load and avoid Postmark rate limits.
 *
 * Flow:
 * 1. Query pending batch emails (oldest first, limit 50)
 * 2. For each email:
 *    - Check rate limit
 *    - Add jitter delay (500-2000ms)
 *    - Send via Postmark
 *    - Update status
 * 3. Log summary
 */
/**
 * Helper function containing batch email processing logic.
 * Used by both the scheduled function and the HTTP trigger.
 */
async function runBatchEmailProcessing(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  rateLimited: number;
}> {
  logEmailConfig();

  // Query pending batch emails
  const pendingQuery = await db
    .collection("emailQueue")
    .where("deliveryMode", "==", "batch")
    .where("status", "==", "pending")
    .orderBy("createdAt", "asc")
    .limit(50)
    .get();

  if (pendingQuery.empty) {
    logger.debug("No pending batch emails to process");
    return { processed: 0, sent: 0, failed: 0, rateLimited: 0 };
  }

  logger.info(`Processing ${pendingQuery.size} batch emails`);

  let sent = 0;
  let failed = 0;
  let rateLimited = 0;

  for (const doc of pendingQuery.docs) {
    const emailId = doc.id as EmailQueueId;
    const emailData = doc.data() as EmailQueueDocument;
    const emailRef = doc.ref;

    try {
      // Add jitter to spread load (500-2000ms)
      const jitterMs = 500 + Math.random() * 1500;
      await new Promise((resolve) => setTimeout(resolve, jitterMs));

      // Update status to processing
      await emailRef.update({
        status: "processing",
        processedAt: Timestamp.now(),
        attempts: FieldValue.increment(1),
        lastAttemptAt: Timestamp.now(),
      });

      // Check rate limit
      const rateLimitScope = emailData.rateLimitScope || "global";
      const rateLimitResult = await checkAndIncrementRateLimit(
        rateLimitScope,
        emailData.type
      );

      if (!rateLimitResult.allowed) {
        await emailRef.update({
          status: "rate-limited",
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: `Rate limit exceeded (${rateLimitResult.currentCount}/${rateLimitResult.maxAllowed})`,
            timestamp: Timestamp.now(),
          },
        });

        rateLimited++;
        continue;
      }

      // Send email
      const sendResult = await sendEmail(emailId, emailData);

      if (sendResult.success) {
        await emailRef.update({
          status: "sent",
          sentAt: Timestamp.fromDate(sendResult.sentAt!),
          postmarkMessageId: sendResult.messageId,
        });

        sent++;
      } else {
        await emailRef.update({
          status: "failed",
          error: {
            code: sendResult.error?.code || "UNKNOWN",
            message: sendResult.error?.message || "Unknown error",
            timestamp: Timestamp.now(),
          },
        });

        failed++;
      }
    } catch (error) {
      logger.error("Error processing batch email", { emailId, error });

      await emailRef.update({
        status: "failed",
        error: {
          code: "PROCESSING_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: Timestamp.now(),
        },
      });

      failed++;
    }
  }

  // Log summary
  if (isDevMode()) {
    logBatchSummary(pendingQuery.size, sent, failed, rateLimited);
  }

  logger.info("Batch email processing complete", {
    processed: pendingQuery.size,
    sent,
    failed,
    rateLimited,
  });

  return { processed: pendingQuery.size, sent, failed, rateLimited };
}

/**
 * HTTP trigger for manually running batch email processing.
 * Useful for testing in emulator (scheduled functions don't auto-run).
 * 
 * Usage: curl http://localhost:5001/PROJECT_ID/europe-west2/triggerBatchEmailProcessing
 */
export const triggerBatchEmailProcessing = onRequest(
  {
    region: "europe-west2",
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async (req, res) => {
    logger.info("Manual batch email processing triggered");

    try {
      const result = await runBatchEmailProcessing();
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error("Batch processing failed", { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export const processBulkEmailBatch = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "Europe/London",
    region: "europe-west2",
    memory: "512MiB",
    timeoutSeconds: 540, // 9 minutes max
  },
  async () => {
    await runBatchEmailProcessing();
  }
);

// ===== Invitation Email Trigger =====

/**
 * Send invitation email when invitation is created
 *
 * Triggered when a new invitation document is created.
 * Queues an immediate email to the invitee.
 */
export const onInvitationCreated = onDocumentCreated(
  {
    document: "invitations/{invitationId}",
    memory: "256MiB",
  },
  async (event) => {
    const invitationId = event.params.invitationId;
    const invData = event.data?.data();

    if (!invData) {
      logger.error("No invitation data", { invitationId });
      return;
    }

    if (invData.status !== 'pending') {
      logger.debug("Skipping non-pending invitation", {
        invitationId,
        status: invData.status,
      });
      return;
    }

    logger.info("Processing invitation email", {
      invitationId,
      email: invData.email,
      organizationId: invData.organizationId,
    });

    try {
      // Get inviter details for email
      const inviterDoc = await db.collection("users").doc(invData.invitedBy).get();
      const inviterData = inviterDoc.data();
      const inviterName = inviterData?.displayName || inviterData?.email || "A team member";

      // Format expiry date
      const expiresAt = invData.expiresAt.toDate();
      const formattedExpiry = expiresAt.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      // Construct invitation URL
      const baseUrl = process.env.CREATOR_APP_URL || "http://localhost:3000";
      const inviteLink = `${baseUrl}/join?token=${invData.token}`;

      // Queue email
      await db.collection("emailQueue").add({
        type: "invitation",
        deliveryMode: "immediate",
        status: "pending",
        to: invData.email,
        templateAlias: "organization-invitation",
        templateData: {
          organizationName: invData.organizationName,
          inviterName,
          inviteLink,
          role: invData.role,
          expiresAt: formattedExpiry,
        },
        metadata: {
          userId: invData.invitedBy,
          organizationId: invData.organizationId,
          invitationId,
        },
        rateLimitScope: `organization:${invData.organizationId}`,
        createdAt: FieldValue.serverTimestamp(),
        attempts: 0,
      });

      logger.info("Invitation email queued", {
        invitationId,
        to: invData.email,
      });
    } catch (error) {
      logger.error("Failed to queue invitation email", {
        invitationId,
        error,
      });
      // Don't throw - we don't want the invitation creation to fail
    }
  }
);
