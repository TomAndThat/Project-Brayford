/**
 * Firestore Type Converters
 * 
 * Firebase Firestore uses Timestamp objects for dates, but our schemas use Date.
 * These converters handle the transformation automatically.
 * 
 * Also handles branded type conversions for type-safe IDs.
 */

import {
  type DocumentData,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  Timestamp,
} from 'firebase/firestore';

/**
 * Convert Firestore Timestamp to JavaScript Date
 * Handles both Timestamp objects and already-converted Dates
 */
function timestampToDate(value: unknown): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  throw new Error(`Expected Timestamp or Date, got ${typeof value}`);
}

/**
 * Convert JavaScript Date to Firestore Timestamp
 * Handles both Date objects and already-converted Timestamps
 */
function dateToTimestamp(value: unknown): Timestamp {
  if (value instanceof Date) {
    return Timestamp.fromDate(value);
  }
  if (value instanceof Timestamp) {
    return value;
  }
  throw new Error(`Expected Date or Timestamp, got ${typeof value}`);
}

/**
 * Generic converter that transforms Firestore data to TypeScript types
 * Automatically converts Timestamp fields to Date objects
 * 
 * @param validator - Schema validation function (from @brayford/core)
 * @param timestampFields - List of fields that are timestamps
 * @returns Firestore converter object
 * 
 * @example
 * ```ts
 * const userConverter = createConverter(
 *   validateUserData,
 *   ['createdAt', 'lastLoginAt']
 * );
 * 
 * const userRef = doc(db, 'users', userId).withConverter(userConverter);
 * const userSnap = await getDoc(userRef);
 * const user = userSnap.data(); // TypeScript knows this is User
 * ```
 */
export function createConverter<T>(
  validator: (data: unknown) => T,
  timestampFields: string[] = []
) {
  return {
    toFirestore(data: T): DocumentData {
      const firestoreData = { ...data } as Record<string, unknown>;
      
      // Convert Date fields to Timestamps
      for (const field of timestampFields) {
        if (field in firestoreData && firestoreData[field]) {
          firestoreData[field] = dateToTimestamp(firestoreData[field]);
        }
      }
      
      return firestoreData as DocumentData;
    },

    fromFirestore(
      snapshot: QueryDocumentSnapshot,
      options?: SnapshotOptions
    ): T {
      const data = snapshot.data(options);
      
      // Convert Timestamp fields to Dates
      const convertedData = { ...data };
      for (const field of timestampFields) {
        if (field in convertedData && convertedData[field]) {
          convertedData[field] = timestampToDate(convertedData[field]);
        }
      }
      
      // Validate with schema
      return validator(convertedData);
    },
  };
}

/**
 * Helper to convert raw Firestore data to typed object
 * Use when you can't use converters (e.g., with queries)
 * 
 * @param data - Raw data from Firestore
 * @param validator - Schema validation function
 * @param timestampFields - List of fields that are timestamps
 * @returns Validated typed object
 * 
 * @example
 * ```ts
 * const querySnap = await getDocs(collection(db, 'users'));
 * const users = querySnap.docs.map(doc =>
 *   convertFromFirestore(doc.data(), validateUserData, ['createdAt', 'lastLoginAt'])
 * );
 * ```
 */
export function convertFromFirestore<T>(
  data: DocumentData,
  validator: (data: unknown) => T,
  timestampFields: string[] = []
): T {
  const convertedData = { ...data };
  
  // Convert Timestamp fields to Dates
  for (const field of timestampFields) {
    if (field in convertedData && convertedData[field]) {
      convertedData[field] = timestampToDate(convertedData[field]);
    }
  }
  
  return validator(convertedData);
}

/**
 * Helper to prepare data for Firestore write
 * Converts Date objects to Timestamps
 * 
 * @param data - Data to write to Firestore
 * @param timestampFields - List of fields that should be Timestamps
 * @returns Data ready for Firestore
 */
export function convertToFirestore<T extends Record<string, unknown>>(
  data: T,
  timestampFields: string[] = []
): DocumentData {
  const firestoreData = { ...data };
  
  // Convert Date fields to Timestamps
  for (const field of timestampFields) {
    if (field in firestoreData && firestoreData[field]) {
      firestoreData[field] = dateToTimestamp(firestoreData[field]);
    }
  }
  
  return firestoreData as DocumentData;
}
