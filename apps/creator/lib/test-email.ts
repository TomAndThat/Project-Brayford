/**
 * Test Email Utility
 * 
 * Simple helper to queue a test email for verifying the email queue system.
 * Use this to test the Cloud Functions email processing.
 */

import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@brayford/firebase-utils';
import type { CreateEmailQueueData } from '@brayford/core';

/**
 * Queue a test email
 * 
 * This writes a document to the emailQueue collection, which triggers
 * the processTransactionalEmail Cloud Function.
 * 
 * In dev mode (EMAIL_DEV_MODE=true in functions/.env), the email will be
 * logged to the Functions console instead of being sent via Postmark.
 * 
 * @param to - Recipient email address
 * @param userId - Optional user ID for metadata
 * @returns Document ID of the queued email
 */
export async function queueTestEmail(
  to: string,
  userId?: string
): Promise<string> {
  const emailData: CreateEmailQueueData = {
    type: 'invitation',
    deliveryMode: 'immediate',
    to,
    templateAlias: 'brayford-invitation-member',
    templateData: {
      organizationName: 'Test Organization',
      inviterName: 'Test User',
      inviteLink: 'https://creator.projectbrayford.com/join/test123',
      recipientEmail: to,
    },
    metadata: {
      userId: userId || 'test-user-123',
      organizationId: 'test-org-456',
    },
  };

  const docRef = await addDoc(collection(db, 'emailQueue'), {
    ...emailData,
    status: 'pending',
    attempts: 0,
    createdAt: serverTimestamp(),
  });

  console.log('✅ Test email queued:', docRef.id);
  console.log('📧 Check Firebase Functions logs to see the email being processed');
  console.log('   In dev mode, the email details will be logged to console');

  return docRef.id;
}

/**
 * Queue a test batch email
 * 
 * This creates a batch-mode email that will be processed by the
 * processBulkEmailBatch scheduled function (runs every minute).
 */
export async function queueTestBatchEmail(to: string): Promise<string> {
  const emailData: CreateEmailQueueData = {
    type: 'marketing',
    deliveryMode: 'batch',
    to,
    templateAlias: 'brayford-marketing-product-update',
    templateData: {
      userName: 'Test User',
      updateTitle: 'Test Product Update',
      updateContent: 'This is a test marketing email',
    },
    metadata: {
      campaignId: 'test-campaign-123',
    },
  };

  const docRef = await addDoc(collection(db, 'emailQueue'), {
    ...emailData,
    status: 'pending',
    attempts: 0,
    createdAt: serverTimestamp(),
  });

  console.log('✅ Test batch email queued:', docRef.id);
  console.log('📧 Will be processed within 1 minute by scheduled function');

  return docRef.id;
}

/**
 * Manually queue an invitation email for an existing invitation
 * 
 * Since onInvitationCreated only fires for NEW documents, use this to
 * manually process an invitation that was created before the trigger was deployed.
 * 
 * @param invitationId - ID of the invitation document
 * @returns Document ID of the queued email
 */
export async function queueInvitationEmail(invitationId: string): Promise<string> {
  // Fetch the invitation document
  const invRef = doc(db, 'invitations', invitationId);
  const invSnap = await getDoc(invRef);

  if (!invSnap.exists()) {
    throw new Error(`Invitation ${invitationId} not found`);
  }

  const invData = invSnap.data();

  if (invData.status !== 'pending') {
    throw new Error(`Invitation status is ${invData.status}, expected 'pending'`);
  }

  // Get inviter details
  const inviterRef = doc(db, 'users', invData.invitedBy);
  const inviterSnap = await getDoc(inviterRef);
  const inviterData = inviterSnap.exists() ? inviterSnap.data() : null;
  const inviterName = inviterData?.displayName || inviterData?.email || 'A team member';

  // Format expiry date
  const expiresAt = invData.expiresAt.toDate();
  const formattedExpiry = expiresAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Construct invitation URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const inviteLink = `${baseUrl}/join?token=${invData.token}`;

  // Queue the email
  const emailData: CreateEmailQueueData = {
    type: 'invitation',
    deliveryMode: 'immediate',
    to: invData.email,
    templateAlias: 'organization-invitation',
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
  };

  const docRef = await addDoc(collection(db, 'emailQueue'), {
    ...emailData,
    status: 'pending',
    attempts: 0,
    rateLimitScope: `organization:${invData.organizationId}`,
    createdAt: serverTimestamp(),
  });

  console.log('✅ Invitation email queued:', docRef.id);
  console.log('📧 For invitation:', invitationId);
  console.log('   To:', invData.email);

  return docRef.id;
}

/**
 * Global utility for browser console testing
 * 
 * Usage in browser console:
 * ```
 * testEmail('your@email.com')
 * testEmailBatch('your@email.com')
 * ```
 */
if (typeof window !== 'undefined') {
  (window as any).testEmail = queueTestEmail;
  (window as any).testEmailBatch = queueTestBatchEmail;
}
