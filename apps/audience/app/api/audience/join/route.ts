import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  validateCreateAudienceSessionData,
} from '@brayford/core';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/audience/join
 * 
 * Creates an audience session and sets an httpOnly cookie
 * 
 * Request body:
 * - eventId: string
 * - qrCodeId: string
 * - audienceUUID: string
 * 
 * Response:
 * - 200: { sessionId: string }
 * - 400: Invalid request
 * - 404: Event or QR code not found
 * - 410: QR code inactive
 * - 500: Server error
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId: eventIdRaw, qrCodeId: qrCodeIdRaw, audienceUUID } = body;

    // Validate required fields
    if (!eventIdRaw || !qrCodeIdRaw || !audienceUUID) {
      return NextResponse.json(
        { error: 'Missing required fields: eventId, qrCodeId, audienceUUID' },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(audienceUUID)) {
      return NextResponse.json(
        { error: 'Invalid UUID format' },
        { status: 400 }
      );
    }

    // Load and validate event (Admin SDK — bypasses security rules)
    const eventDoc = await adminDb.collection('events').doc(eventIdRaw).get();
    if (!eventDoc.exists) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }
    const event = eventDoc.data()!;

    // Load and validate QR code (Admin SDK — bypasses security rules)
    const qrCodeDoc = await adminDb.collection('qrCodes').doc(qrCodeIdRaw).get();
    if (!qrCodeDoc.exists) {
      return NextResponse.json(
        { error: 'QR code not found' },
        { status: 404 }
      );
    }
    const qrCode = qrCodeDoc.data()!;

    // Verify QR code is active
    if (!qrCode.isActive) {
      return NextResponse.json(
        { error: 'This QR code is no longer active' },
        { status: 410 }
      );
    }

    // Verify QR code belongs to this event
    if (qrCode.eventId !== eventIdRaw) {
      return NextResponse.json(
        { error: 'QR code does not match this event' },
        { status: 400 }
      );
    }

    // Check if user already has an active session for this event (Admin SDK)
    const existingSessionQuery = await adminDb
      .collection('audienceSessions')
      .where('eventId', '==', eventIdRaw)
      .where('audienceUUID', '==', audienceUUID)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    let sessionId: string;
    
    if (!existingSessionQuery.empty) {
      // Reuse existing session
      sessionId = existingSessionQuery.docs[0]!.id;
    } else {
      // Validate session data with Zod schema
      const sessionData = validateCreateAudienceSessionData({
        eventId: eventIdRaw,
        organizationId: event.organizationId,
        qrCodeId: qrCodeIdRaw,
        audienceUUID,
      });

      // Create new session (Admin SDK — bypasses security rules)
      const newSessionRef = adminDb.collection('audienceSessions').doc();
      await newSessionRef.set({
        ...sessionData,
        joinedAt: FieldValue.serverTimestamp(),
        lastSeenAt: FieldValue.serverTimestamp(),
        isActive: true,
      });
      sessionId = newSessionRef.id;
    }

    // Set httpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set('brayford_audience_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return NextResponse.json({ sessionId }, { status: 200 });
  } catch (error) {
    console.error('Error creating audience session:', error);
    return NextResponse.json(
      { error: 'Failed to join event' },
      { status: 500 }
    );
  }
}
