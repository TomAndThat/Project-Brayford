/**
 * Event Firestore Operations
 * Event Management Domain
 * 
 * CRUD operations for events collection
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
  Timestamp,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '../config';
import { createConverter } from './converters';
import {
  validateEventData,
  type Event,
  type EventDocument,
  type CreateEventData,
  type UpdateEventData,
  toBranded,
  fromBranded,
  type EventId,
  type BrandId,
  type OrganizationId,
} from '@brayford/core';

/**
 * Firestore converter for Event documents
 */
const eventConverter = createConverter(validateEventData, ['createdAt', 'scheduledDate', 'scheduledEndDate']);

/**
 * Helper function to convert all Firestore Timestamps in event data to Dates
 * Handles both top-level and nested fields (like sceneHistory)
 */
function convertEventTimestamps(rawData: any): any {
  const converted = {
    ...rawData,
    createdAt: rawData.createdAt instanceof Timestamp ? rawData.createdAt.toDate() : rawData.createdAt,
    scheduledDate: rawData.scheduledDate instanceof Timestamp ? rawData.scheduledDate.toDate() : rawData.scheduledDate,
    scheduledEndDate: rawData.scheduledEndDate instanceof Timestamp ? rawData.scheduledEndDate.toDate() : rawData.scheduledEndDate,
  };
  
  // Convert nested sceneHistory timestamps
  if (converted.sceneHistory && Array.isArray(converted.sceneHistory)) {
    converted.sceneHistory = converted.sceneHistory.map((entry: any) => ({
      ...entry,
      switchedAt: entry.switchedAt instanceof Timestamp ? entry.switchedAt.toDate() : entry.switchedAt,
    }));
  }
  
  return converted;
}

/**
 * Get reference to an event document
 */
export function getEventRef(eventId: EventId): DocumentReference<Event> {
  return doc(db, 'events', fromBranded(eventId)).withConverter(eventConverter);
}

/**
 * Get event by ID
 * 
 * @param eventId - Event ID (branded type)
 * @returns Event document or null if not found
 * 
 * @example
 * ```ts
 * const event = await getEvent(eventId);
 * if (event) {
 *   console.log(event.name, event.scheduledDate);
 * }
 * ```
 */
export async function getEvent(eventId: EventId): Promise<EventDocument | null> {
  // Fetch raw data without converter to handle nested timestamps
  const eventRef = doc(db, 'events', fromBranded(eventId));
  const eventSnap = await getDoc(eventRef);
  
  if (!eventSnap.exists()) {
    return null;
  }
  
  // Convert all timestamps (including nested ones) and validate
  const data = validateEventData(convertEventTimestamps(eventSnap.data()));
  
  return {
    id: eventId,
    ...data,
    brandId: toBranded<BrandId>(data.brandId),
    organizationId: toBranded<OrganizationId>(data.organizationId),
  };
}

/**
 * Create new event
 * 
 * @param data - Event creation data
 * @returns ID of newly created event
 * 
 * @example
 * ```ts
 * const eventId = await createEvent({
 *   brandId: brandId,
 *   organizationId: orgId,
 *   name: 'Episode 42',
 *   venue: 'London Studio',
 *   scheduledDate: new Date('2026-03-30'),
 *   scheduledStartTime: '13:00',
 *   timezone: 'Europe/London',
 * });
 * ```
 */
export async function createEvent(data: CreateEventData): Promise<EventId> {
  const eventRef = doc(collection(db, 'events'));
  const eventId = toBranded<EventId>(eventRef.id);
  
  // Strip undefined values — Firestore rejects them
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );

  await setDoc(eventRef, {
    ...cleanData,
    createdAt: serverTimestamp(),
    status: 'draft',
    isActive: true,
  });
  
  return eventId;
}

/**
 * Update event
 * 
 * @param eventId - Event ID to update
 * @param data - Partial event data to update
 * 
 * @example
 * ```ts
 * await updateEvent(eventId, {
 *   name: 'Episode 42 - Updated',
 *   venue: 'Manchester Studio',
 * });
 * ```
 */
export async function updateEvent(
  eventId: EventId,
  data: UpdateEventData
): Promise<void> {
  const eventRef = getEventRef(eventId);
  
  // Strip undefined values
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );
  
  await updateDoc(eventRef, cleanData);
}

/**
 * Get all events for a brand
 * 
 * @param brandId - Brand ID
 * @param activeOnly - Whether to only return active (non-archived) events
 * @returns Array of event documents
 * 
 * @example
 * ```ts
 * const events = await getBrandEvents(brandId);
 * const activeEvents = await getBrandEvents(brandId, true);
 * ```
 */
export async function getBrandEvents(
  brandId: BrandId,
  activeOnly = true
): Promise<EventDocument[]> {
  const eventsRef = collection(db, 'events');
  let q = query(
    eventsRef,
    where('brandId', '==', fromBranded(brandId)),
    orderBy('scheduledDate', 'desc')
  );
  
  const querySnap = await getDocs(q);
  
  const events: EventDocument[] = [];
  for (const docSnap of querySnap.docs) {
    const data = validateEventData(convertEventTimestamps(docSnap.data()));
    
    // Filter by isActive if needed
    if (activeOnly && !data.isActive) continue;
    
    events.push({
      id: toBranded<EventId>(docSnap.id),
      ...data,
      brandId: toBranded<BrandId>(data.brandId),
      organizationId: toBranded<OrganizationId>(data.organizationId),
    });
  }
  
  return events;
}

/**
 * Get all events for an organization (across all brands)
 * 
 * @param organizationId - Organization ID
 * @param activeOnly - Whether to only return active (non-archived) events
 * @returns Array of event documents
 * 
 * @example
 * ```ts
 * const allOrgEvents = await getOrganizationEvents(orgId);
 * const activeOrgEvents = await getOrganizationEvents(orgId, true);
 * ```
 */
export async function getOrganizationEvents(
  organizationId: OrganizationId,
  activeOnly = true
): Promise<EventDocument[]> {
  const eventsRef = collection(db, 'events');
  let q = query(
    eventsRef,
    where('organizationId', '==', fromBranded(organizationId)),
    orderBy('scheduledDate', 'desc')
  );
  
  const querySnap = await getDocs(q);
  
  const events: EventDocument[] = [];
  for (const docSnap of querySnap.docs) {
    const data = validateEventData(convertEventTimestamps(docSnap.data()));
    
    // Filter by isActive if needed
    if (activeOnly && !data.isActive) continue;
    
    events.push({
      id: toBranded<EventId>(docSnap.id),
      ...data,
      brandId: toBranded<BrandId>(data.brandId),
      organizationId: toBranded<OrganizationId>(data.organizationId),
    });
  }
  
  return events;
}

/**
 * Get child events for an event group
 * 
 * @param parentEventId - Parent event group ID
 * @param activeOnly - Whether to only include active events (default: true)
 * @returns Array of child event documents
 * 
 * @example
 * ```ts
 * const childEvents = await getChildEvents(eventGroupId);
 * ```
 */
export async function getChildEvents(
  parentEventId: EventId,
  activeOnly = true
): Promise<EventDocument[]> {
  const eventsRef = collection(db, 'events');
  let q = query(
    eventsRef,
    where('parentEventId', '==', fromBranded(parentEventId)),
    where('eventType', '==', 'event'),
    orderBy('scheduledDate', 'asc')
  );
  
  const querySnap = await getDocs(q);
  
  const events: EventDocument[] = [];
  for (const docSnap of querySnap.docs) {
    const data = validateEventData(convertEventTimestamps(docSnap.data()));
    
    // Filter by isActive if needed
    if (activeOnly && !data.isActive) continue;
    
    events.push({
      id: toBranded<EventId>(docSnap.id),
      ...data,
      brandId: toBranded<BrandId>(data.brandId),
      organizationId: toBranded<OrganizationId>(data.organizationId),
    });
  }
  
  return events;
}
