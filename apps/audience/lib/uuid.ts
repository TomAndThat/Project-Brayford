/**
 * UUID Management for Audience Member Identification
 * 
 * Uses localStorage to persist a unique identifier across sessions.
 * This UUID is used for:
 * - Tracking unique audience members for billing
 * - Preventing duplicate session counting
 * - Associating interactions with users
 * 
 * Privacy-friendly: No personal data, just a random UUID
 */

const STORAGE_KEY = 'brayford_audience_uuid';

/**
 * Get or generate a UUID for the current audience member
 * 
 * - Checks localStorage for existing UUID
 * - Generates new UUID if none exists
 * - Stores in localStorage for future sessions
 * 
 * @returns UUID string
 */
export function getOrCreateUUID(): string {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    throw new Error('getOrCreateUUID can only be called in the browser');
  }

  try {
    // Try to get existing UUID from localStorage
    const existingUUID = localStorage.getItem(STORAGE_KEY);
    
    if (existingUUID) {
      return existingUUID;
    }

    // Generate new UUID
    const newUUID = crypto.randomUUID();
    
    // Store in localStorage
    localStorage.setItem(STORAGE_KEY, newUUID);
    
    return newUUID;
  } catch (error) {
    console.error('Error managing UUID:', error);
    // If localStorage fails (privacy mode, etc.), generate temporary UUID
    // This won't persist across page reloads but better than crashing
    return crypto.randomUUID();
  }
}

/**
 * Get the current UUID without generating a new one
 * 
 * @returns UUID string or null if none exists
 */
export function getUUID(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error reading UUID:', error);
    return null;
  }
}

/**
 * Clear the stored UUID (for testing purposes)
 * NOT to be used in production code
 */
export function clearUUID(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing UUID:', error);
  }
}
