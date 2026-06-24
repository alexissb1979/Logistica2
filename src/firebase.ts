import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, 
  collection, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with modern persistent cache configuration (eliminates deprecation warnings)
export const db = initializeFirestore(app, { 
  experimentalForceLongPolling: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, (firebaseConfig as any).firestoreDatabaseId || "ai-studio-9f64b09c-062a-4f05-ae48-1df1c9bded1a");

export const auth = getAuth(app);

// Helper for Firestore errors as per skill instructions
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Secondary Auth mechanism to create users without logging out the current active session
export const createSecondaryAuthUser = async (email: string, pass: string): Promise<string> => {
  const secondaryAppName = `secondary-auth-${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
    const uid = userCredential.user.uid;
    await signOut(secondaryAuth);
    return uid;
  } finally {
    // Cleanup of the temporary app is not strictly possible in the web SDK via a single call, 
    // but the app object will eventually be GC'd or we can just leave it since it's a one-off.
  }
};

// Core collections
export const assignmentsCol = collection(db, "assignments");
export const documentsCol = collection(db, "pending_documents");
export const userProfilesCol = collection(db, "user_profiles");
export const stagingCol = collection(db, "staging_data");
export const routesCol = collection(db, "routes");
export const driversCol = collection(db, "drivers");
export const vehiclesCol = collection(db, "vehicles");
export const manifestsCol = collection(db, "manifests");
export const requestsCol = collection(db, "logistics_requests");
