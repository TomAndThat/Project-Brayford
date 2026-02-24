import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  MIN_MESSAGE_CONTENT_LENGTH,
  MAX_MESSAGE_CONTENT_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MESSAGE_RATE_LIMIT_SECONDS,
} from '@brayford/core';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/audience/messages
 *
 * Submits an audience message for an event.
 * Rate-limited to one submission per MESSAGE_RATE_LIMIT_SECONDS per device.
 * Writes to /messages/ and adds a subcollection entry to the event's default
 * inbox column so the creator moderation board receives it immediately.
 *
 * Request body:
 * - eventId: string
 * - audienceUUID: string  (device identifier from localStorage)
 * - content: string       (MIN_MESSAGE_CONTENT_LENGTH–MAX_MESSAGE_CONTENT_LENGTH chars)
 * - displayName?: string  (optional, max MAX_DISPLAY_NAME_LENGTH chars)
 *
 * Responses:
 * - 201: { messageId: string }
 * - 400: Invalid or missing fields
 * - 404: Event not found
 * - 409: Event not live
 * - 429: Rate limit exceeded
 * - 500: Server error
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, audienceUUID, content, displayName } = body;

    // --- Input validation ---

    if (!eventId || !audienceUUID || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: eventId, audienceUUID, content' },
        { status: 400 },
      );
    }

    if (!uuidRegex.test(String(audienceUUID))) {
      return NextResponse.json(
        { error: 'Invalid UUID format' },
        { status: 400 },
      );
    }

    const trimmedContent = String(content).trim();
    if (trimmedContent.length < MIN_MESSAGE_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Message must be at least ${MIN_MESSAGE_CONTENT_LENGTH} characters` },
        { status: 400 },
      );
    }
    if (trimmedContent.length > MAX_MESSAGE_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Message must not exceed ${MAX_MESSAGE_CONTENT_LENGTH} characters` },
        { status: 400 },
      );
    }

    let sanitisedDisplayName: string | null = null;
    if (displayName) {
      const trimmedName = String(displayName).trim();
      if (trimmedName.length > MAX_DISPLAY_NAME_LENGTH) {
        return NextResponse.json(
          { error: `Display name must not exceed ${MAX_DISPLAY_NAME_LENGTH} characters` },
          { status: 400 },
        );
      }
      sanitisedDisplayName = trimmedName || null;
    }

    // --- Event validation ---

    const eventDoc = await adminDb.collection('events').doc(String(eventId)).get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const event = eventDoc.data()!;

    if (event.status !== 'live') {
      return NextResponse.json(
        { error: 'This event is not currently accepting messages' },
        { status: 409 },
      );
    }

    // --- Rate limiting ---
    // One message per device per MESSAGE_RATE_LIMIT_SECONDS (server-enforced)

    const rateLimitCutoff = Timestamp.fromMillis(
      Date.now() - MESSAGE_RATE_LIMIT_SECONDS * 1000,
    );
    const recentMessages = await adminDb
      .collection('messages')
      .where('eventId', '==', String(eventId))
      .where('audienceUUID', '==', String(audienceUUID))
      .where('isDeleted', '==', false)
      .where('submittedAt', '>', rateLimitCutoff)
      .limit(1)
      .get();

    if (!recentMessages.empty) {
      return NextResponse.json(
        { error: 'Please wait a moment before sending another message.' },
        { status: 429 },
      );
    }

    // --- Find the default inbox column ---

    const columnsQuery = await adminDb
      .collection('messageColumns')
      .where('eventId', '==', String(eventId))
      .where('isDefault', '==', true)
      .limit(1)
      .get();

    // --- Atomic batch write ---

    const batch = adminDb.batch();
    const messageRef = adminDb.collection('messages').doc();
    const messageId = messageRef.id;

    batch.set(messageRef, {
      eventId: String(eventId),
      organizationId: event.organizationId,
      brandId: event.brandId,
      content: trimmedContent,
      editedContent: null,
      displayName: sanitisedDisplayName,
      audienceUUID: String(audienceUUID),
      isDeleted: false,
      submittedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (!columnsQuery.empty) {
      const columnDoc = columnsQuery.docs[0]!;
      const columnId = columnDoc.id;
      // Use current epoch ms as order so entries sort newest-last within the column
      const orderValue = Date.now();

      const entryRef = adminDb
        .collection('messageColumns')
        .doc(columnId)
        .collection('messages')
        .doc(messageId);

      batch.set(entryRef, {
        messageId,
        addedAt: FieldValue.serverTimestamp(),
        order: orderValue,
      });

      batch.update(adminDb.collection('messageColumns').doc(columnId), {
        messageCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    return NextResponse.json({ messageId }, { status: 201 });
  } catch (error) {
    console.error('Error submitting audience message:', error);
    return NextResponse.json({ error: 'Failed to submit message' }, { status: 500 });
  }
}
