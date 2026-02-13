/**
 * Firebase Connection Monitoring Hook
 * 
 * Monitors Firebase/Firestore connection health by:
 * 1. Listening to browser online/offline events
 * 2. Monitoring Firestore snapshot listener errors
 * 3. Detecting successful reconnections
 * 
 * Returns connection state and last connected timestamp.
 */

import { useEffect, useState } from 'react';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

interface ConnectionStatus {
  state: ConnectionState;
  lastConnected: Date | null;
}

/**
 * Hook to monitor Firebase/Firestore connection health
 * 
 * Uses a combination of:
 * - Browser online/offline events
 * - Firestore snapshot listener health
 * - Special connection health document monitoring
 * 
 * @returns ConnectionStatus object with current state and last connected time
 */
export function useFirebaseConnection(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>({
    state: typeof navigator !== 'undefined' && navigator.onLine ? 'connected' : 'disconnected',
    lastConnected: new Date(),
  });

  useEffect(() => {
    // Track if we're currently connected
    let isConnected = navigator.onLine;
    let reconnectTimer: NodeJS.Timeout | null = null;

    // Update connection state
    const updateState = (newState: ConnectionState) => {
      setStatus(prev => ({
        state: newState,
        lastConnected: newState === 'connected' ? new Date() : prev.lastConnected,
      }));
    };

    // Handle online/offline events
    const handleOnline = () => {
      if (!isConnected) {
        isConnected = true;
        updateState('reconnecting');
        
        // Give Firestore a moment to reconnect before marking as connected
        reconnectTimer = setTimeout(() => {
          updateState('connected');
        }, 1000);
      }
    };

    const handleOffline = () => {
      isConnected = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      updateState('disconnected');
    };

    // Set up network event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Monitor Firestore connection via a lightweight snapshot listener
    // We use a special path that's optimized for connection monitoring
    const db = getFirestore();
    const connectionRef = doc(db, '_connection_health', 'monitor');
    
    const unsubscribe = onSnapshot(
      connectionRef,
      () => {
        // Snapshot received successfully - we're connected
        if (isConnected && status.state !== 'connected') {
          updateState('connected');
        }
      },
      (error) => {
        // Snapshot error - connection issues
        console.warn('Firestore connection monitor error:', error.code);
        if (error.code === 'unavailable' || error.code === 'failed-precondition') {
          if (isConnected) {
            // Network is up but Firestore is down
            updateState('reconnecting');
          } else {
            updateState('disconnected');
          }
        }
      }
    );

    // Initial state check
    if (!navigator.onLine) {
      updateState('disconnected');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      unsubscribe();
    };
  }, []);

  return status;
}
