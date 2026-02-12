/**
 * Event Live State Firestore Operations
 * Interaction Domain
 * 
 * Manages the lightweight real-time state document that controls
 * what audience devices currently display.
 * 
 * Document path: /events/{eventId}/live/state
 * 
 * Includes both standard CRUD operations and a real-time hook
 * (useEventLiveState) for audience and creator apps.
 * 
 * @see docs/briefs/SCENE_SYSTEM.md
 */

import { useEffect, useState } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config';
import {
  validateEventLiveStateData,
  type EventLiveState,
  type EventLiveStateDocument,
  toBranded,
  fromBranded,
  type EventId,
  type SceneId,
  type UserId,
  MAX_SCENE_HISTORY_ENTRIES,
} from '@brayford/core';

// ===== Document Path Helpers =====

/**
 * Get the Firestore document path for an event's live state
 */
function getLiveStatePath(eventId: EventId): string {
  return `events/${fromBranded(eventId)}/live/state`;
}

/**
 * Get a document reference for an event's live state
 */
function getLiveStateRef(eventId: EventId) {
  return doc(db, getLiveStatePath(eventId));
}

// ===== Read Operations =====

/**
 * Get the current live state for an event
 * 
 * @param eventId - Event ID
 * @returns Live state document or null if not initialised
 * 
 * @example
 * ```ts
 * const liveState = await getEventLiveState(eventId);
 * if (liveState?.activeSceneId) {
 *   console.log('Currently showing scene:', liveState.activeSceneId);
 * }
 * ```
 */
export async function getEventLiveState(
  eventId: EventId
): Promise<EventLiveStateDocument | null> {
  const stateRef = getLiveStateRef(eventId);
  const stateSnap = await getDoc(stateRef);
  
  if (!stateSnap.exists()) {
    return null;
  }
  
  const rawData = stateSnap.data();
  const data = validateEventLiveStateData({
    ...rawData,
    sceneUpdatedAt: rawData.sceneUpdatedAt?.toDate(),
    updatedAt: rawData.updatedAt?.toDate(),
  });
  
  return {
    eventId,
    activeSceneId: data.activeSceneId ? toBranded<SceneId>(data.activeSceneId) : null,
    sceneUpdatedAt: data.sceneUpdatedAt,
    updatedAt: data.updatedAt,
  };
}

// ===== Write Operations =====

/**
 * Initialise the live state document for an event
 * 
 * Call this when an event is created or when preparing an event to go live.
 * Safe to call multiple times (uses setDoc with no active scene).
 * 
 * @param eventId - Event ID
 * 
 * @example
 * ```ts
 * await initializeEventLiveState(eventId);
 * ```
 */
export async function initializeEventLiveState(eventId: EventId): Promise<void> {
  const stateRef = getLiveStateRef(eventId);
  
  await setDoc(stateRef, {
    activeSceneId: null,
    sceneUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Switch the active scene for an event
 * 
 * Updates the live state document (which all audience listeners detect)
 * and appends to the event's sceneHistory for analytics.
 * 
 * @param eventId - Event ID
 * @param sceneId - Scene to activate (null to clear / show no content)
 * @param switchedBy - User performing the switch
 * 
 * @example
 * ```ts
 * // Activate a scene
 * await switchScene(eventId, welcomeSceneId, userId);
 * 
 * // Clear the screen (no active scene)
 * await switchScene(eventId, null, userId);
 * ```
 */
export async function switchScene(
  eventId: EventId,
  sceneId: SceneId | null,
  switchedBy: UserId
): Promise<void> {
  const stateRef = getLiveStateRef(eventId);
  
  // Update live state for audience listeners
  await updateDoc(stateRef, {
    activeSceneId: sceneId ? fromBranded(sceneId) : null,
    updatedAt: serverTimestamp(),
  });
  
  // Append to event's scene history for analytics
  if (sceneId) {
    const eventRef = doc(db, 'events', fromBranded(eventId));
    await updateDoc(eventRef, {
      sceneHistory: arrayUnion({
        sceneId: fromBranded(sceneId),
        switchedAt: Timestamp.now(),
        switchedBy: fromBranded(switchedBy),
      }),
    });
  }
}

/**
 * Mark that the active scene's content has been edited
 * 
 * Call this after updating a scene that is currently active.
 * Audience devices detect the timestamp change and re-fetch the scene.
 * 
 * @param eventId - Event ID
 * 
 * @example
 * ```ts
 * // After editing the active scene
 * await updateScene(sceneId, { modules: updatedModules });
 * await markSceneContentUpdated(eventId);
 * ```
 */
export async function markSceneContentUpdated(eventId: EventId): Promise<void> {
  const stateRef = getLiveStateRef(eventId);
  
  await updateDoc(stateRef, {
    sceneUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ===== Real-Time Hook =====

/**
 * React hook for real-time event live state updates
 * 
 * Uses Firestore onSnapshot to subscribe to changes in the live state
 * document. Automatically handles cleanup when the component unmounts.
 * 
 * Used by:
 * - Audience app: Detect scene changes and render appropriate content
 * - Creator app: Show current active scene in the live switcher panel
 * 
 * @param eventId - Event ID to subscribe to
 * @returns Object with liveState data, loading state, and error
 * 
 * @example
 * ```tsx
 * function AudienceEventPage({ eventId }: { eventId: EventId }) {
 *   const { liveState, loading, error } = useEventLiveState(eventId);
 * 
 *   if (loading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!liveState?.activeSceneId) return <WaitingScreen />;
 * 
 *   return <SceneRenderer sceneId={liveState.activeSceneId} />;
 * }
 * ```
 */
export function useEventLiveState(eventId: EventId): {
  liveState: EventLiveStateDocument | null;
  loading: boolean;
  error: Error | null;
} {
  const [liveState, setLiveState] = useState<EventLiveStateDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const stateRef = getLiveStateRef(eventId);
    
    const unsubscribe = onSnapshot(
      stateRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setLiveState(null);
          setLoading(false);
          return;
        }

        try {
          const rawData = snapshot.data();
          const data = validateEventLiveStateData({
            ...rawData,
            sceneUpdatedAt: rawData.sceneUpdatedAt?.toDate(),
            updatedAt: rawData.updatedAt?.toDate(),
          });

          setLiveState({
            eventId,
            activeSceneId: data.activeSceneId 
              ? toBranded<SceneId>(data.activeSceneId) 
              : null,
            sceneUpdatedAt: data.sceneUpdatedAt,
            updatedAt: data.updatedAt,
          });
        } catch (err) {
          setError(
            err instanceof Error 
              ? err 
              : new Error('Failed to parse live state data')
          );
        }
        
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    // Cleanup: unsubscribe from onSnapshot listener when component unmounts
    return unsubscribe;
  }, [eventId]);

  return { liveState, loading, error };
}
