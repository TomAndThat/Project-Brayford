/**
 * QR Code Firestore Operations
 * Event Management Domain
 * 
 * CRUD operations for qrCodes collection
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  serverTimestamp,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '../config';
import { createConverter } from './converters';
import {
  validateQRCodeData,
  generateQRCode,
  type QRCode,
  type QRCodeDocument,
  type CreateQRCodeData,
  type UpdateQRCodeData,
  toBranded,
  fromBranded,
  type QRCodeId,
  type EventId,
  type OrganizationId,
} from '@brayford/core';

/**
 * Firestore converter for QR Code documents
 */
const qrCodeConverter = createConverter(validateQRCodeData, ['createdAt']);

/**
 * Get reference to a QR code document
 */
export function getQRCodeRef(qrCodeId: QRCodeId): DocumentReference<QRCode> {
  return doc(db, 'qrCodes', fromBranded(qrCodeId)).withConverter(qrCodeConverter);
}

/**
 * Get QR code by ID
 * 
 * @param qrCodeId - QR code ID (branded type)
 * @returns QR code document or null if not found
 * 
 * @example
 * ```ts
 * const qrCode = await getQRCode(qrCodeId);
 * if (qrCode) {
 *   console.log(qrCode.name, qrCode.code);
 * }
 * ```
 */
export async function getQRCode(qrCodeId: QRCodeId): Promise<QRCodeDocument | null> {
  const qrCodeRef = getQRCodeRef(qrCodeId);
  const qrCodeSnap = await getDoc(qrCodeRef);
  
  if (!qrCodeSnap.exists()) {
    return null;
  }
  
  const data = qrCodeSnap.data();
  return {
    id: qrCodeId,
    ...data,
    eventId: toBranded<EventId>(data.eventId),
    organizationId: toBranded<OrganizationId>(data.organizationId),
  };
}

/**
 * Get all QR codes for an event
 * 
 * @param eventId - Event ID
 * @param organizationId - Organization ID (required for Firestore security rules)
 * @param activeOnly - Whether to only return active QR codes
 * @returns Array of QR code documents
 * 
 * @example
 * ```ts
 * const activeQRCodes = await getEventQRCodes(eventId, orgId, true);
 * const allQRCodes = await getEventQRCodes(eventId, orgId, false);
 * ```
 */
export async function getEventQRCodes(
  eventId: EventId,
  organizationId: OrganizationId,
  activeOnly = true
): Promise<QRCodeDocument[]> {
  const qrCodesRef = collection(db, 'qrCodes');
  
  let q = query(
    qrCodesRef,
    where('organizationId', '==', fromBranded(organizationId)),
    where('eventId', '==', fromBranded(eventId)),
    orderBy('createdAt', 'desc')
  );
  
  if (activeOnly) {
    q = query(q, where('isActive', '==', true));
  }
  
  const snapshot = await getDocs(q.withConverter(qrCodeConverter));
  
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: toBranded<QRCodeId>(doc.id),
      ...data,
      eventId: toBranded<EventId>(data.eventId),
      organizationId: toBranded<OrganizationId>(data.organizationId),
    };
  });
}

/**
 * Create new QR code
 * 
 * @param data - QR code creation data
 * @returns ID of newly created QR code
 * 
 * @example
 * ```ts
 * const qrCodeId = await createQRCode({
 *   eventId: eventId,
 *   organizationId: orgId,
 *   name: 'Main QR Code',
 * });
 * ```
 */
export async function createQRCode(data: CreateQRCodeData): Promise<QRCodeId> {
  const qrCodeRef = doc(collection(db, 'qrCodes'));
  const qrCodeId = toBranded<QRCodeId>(qrCodeRef.id);
  
  // Generate unique code
  const code = generateQRCode();
  
  // Strip undefined values — Firestore rejects them
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );

  await setDoc(qrCodeRef, {
    ...cleanData,
    code,
    createdAt: serverTimestamp(),
    isActive: true,
  });
  
  return qrCodeId;
}

/**
 * Update QR code
 * 
 * @param qrCodeId - QR code ID to update
 * @param data - Partial QR code data to update
 * 
 * @example
 * ```ts
 * await updateQRCode(qrCodeId, {
 *   name: 'Social Media QR Code',
 *   isActive: false,
 * });
 * ```
 */
export async function updateQRCode(
  qrCodeId: QRCodeId,
  data: UpdateQRCodeData
): Promise<void> {
  const qrCodeRef = getQRCodeRef(qrCodeId);
  
  // Strip undefined values
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );
  
  await updateDoc(qrCodeRef, cleanData);
}

/**
 * Get a QR code by its unique code
 * Useful for audience app when scanning QR code
 * 
 * @param code - The unique code from the QR code URL
 * @returns QR code document or null if not found
 * 
 * @example
 * ```ts
 * const qrCode = await getQRCodeByCode('550e8400-e29b-41d4-a716-446655440000');
 * if (qrCode && qrCode.isActive) {
 *   // Allow join
 * }
 * ```
 */
export async function getQRCodeByCode(code: string): Promise<QRCodeDocument | null> {
  const qrCodesRef = collection(db, 'qrCodes');
  
  const q = query(
    qrCodesRef,
    where('code', '==', code),
    where('isActive', '==', true)
  );
  
  const snapshot = await getDocs(q.withConverter(qrCodeConverter));
  
  if (snapshot.empty) {
    return null;
  }
  
  const doc = snapshot.docs[0]!;
  const data = doc.data();
  
  return {
    id: toBranded<QRCodeId>(doc.id),
    ...data,
    eventId: toBranded<EventId>(data.eventId),
    organizationId: toBranded<OrganizationId>(data.organizationId),
  };
}
