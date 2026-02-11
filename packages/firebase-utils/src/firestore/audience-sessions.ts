/**
 * Audience Session Firestore Operations
 * 
 * CRUD operations for audience sessions
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  type DocumentReference,
  type CollectionReference,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config';
import {
  toBranded,
  type EventId,
  type OrganizationId,
  type QRCodeId,
  type AudienceSession,
  type AudienceSessionDocument,
  type CreateAudienceSessionData,
  type UpdateAudienceSessionData,
} from '@brayford/core';

/**
 * Get reference to audience sessions collection
 */
export function getAudienceSessionsCollection(): CollectionReference<AudienceSession> {
  return collection(db, 'audienceSessions') as CollectionReference<AudienceSession>;
}

/**
 * Get reference to a specific audience session document
 */
export function getAudienceSessionRef(sessionId: string): DocumentReference<AudienceSession> {
  return doc(getAudienceSessionsCollection(), sessionId);
}

/**
 * Get an audience session by ID
 */
export async function getAudienceSession(sessionId: string): Promise<AudienceSessionDocument | null> {
  const sessionRef = getAudienceSessionRef(sessionId);
  const sessionSnap = await getDoc(sessionRef);
  
  if (!sessionSnap.exists()) {
    return null;
  }
  
  const data = sessionSnap.data();
  return {
    id: sessionId,
    ...data,
    eventId: toBranded<EventId>(data.eventId),
    organizationId: toBranded<OrganizationId>(data.organizationId),
    qrCodeId: toBranded<QRCodeId>(data.qrCodeId),
  };
}

/**
 * Check if an audience member already has an active session for an event
 * 
 * @param eventId - Event ID
 * @param audienceUUID - Audience member UUID
 * @returns Existing session document or null
 */
export async function getActiveAudienceSession(
  eventId: EventId,
  audienceUUID: string
): Promise<AudienceSessionDocument | null> {
  const sessionsRef = getAudienceSessionsCollection();
  const q = query(
    sessionsRef,
    where('eventId', '==', eventId),
    where('audienceUUID', '==', audienceUUID),
    where('isActive', '==', true)
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return null;
  }
  
  const sessionDoc = snapshot.docs[0]!;
  const data = sessionDoc.data();
  
  return {
    id: sessionDoc.id,
    ...data,
    eventId: toBranded<EventId>(data.eventId),
    organizationId: toBranded<OrganizationId>(data.organizationId),
    qrCodeId: toBranded<QRCodeId>(data.qrCodeId),
  };
}

/**
 * Create a new audience session
 * 
 * @param data - Session data (without timestamps)
 * @returns Created session ID
 */
export async function createAudienceSession(
  data: CreateAudienceSessionData
): Promise<string> {
  const sessionsRef = getAudienceSessionsCollection();
  const newSessionRef = doc(sessionsRef);
  
  await setDoc(newSessionRef, {
    ...data,
    joinedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
    isActive: true,
  });
  
  return newSessionRef.id;
}

/**
 * Update an audience session
 * 
 * @param sessionId - Session ID
 * @param updates - Fields to update
 */
export async function updateAudienceSession(
  sessionId: string,
  updates: UpdateAudienceSessionData
): Promise<void> {
  const sessionRef = getAudienceSessionRef(sessionId);
  await updateDoc(sessionRef, {
    ...updates,
    lastSeenAt: serverTimestamp(),
  });
}

/**
 * Update last seen timestamp for a session (heartbeat)
 * 
 * @param sessionId - Session ID
 */
export async function updateSessionHeartbeat(sessionId: string): Promise<void> {
  const sessionRef = getAudienceSessionRef(sessionId);
  await updateDoc(sessionRef, {
    lastSeenAt: serverTimestamp(),
  });
}

/**
 * End an audience session (mark as inactive)
 * 
 * @param sessionId - Session ID
 */
export async function endAudienceSession(sessionId: string): Promise<void> {
  await updateAudienceSession(sessionId, { isActive: false });
}

/**
 * Get all active sessions for an event
 * 
 * @param eventId - Event ID
 * @returns Array of active session documents
 */
export async function getEventActiveSessions(
  eventId: EventId
): Promise<AudienceSessionDocument[]> {
  const sessionsRef = getAudienceSessionsCollection();
  const q = query(
    sessionsRef,
    where('eventId', '==', eventId),
    where('isActive', '==', true)
  );
  
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      eventId: toBranded<EventId>(data.eventId),
      organizationId: toBranded<OrganizationId>(data.organizationId),
      qrCodeId: toBranded<QRCodeId>(data.qrCodeId),
    };
  });
}
