import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().find((a) => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);

// Instance Auth secondaire dédiée à la vérification OTP par téléphone (Firebase Phone Auth)
// afin de ne jamais écraser la session Google Auth d'un administrateur/agent connecté.
const phoneAuthApp =
  getApps().find((a) => a.name === 'member-phone-auth') ||
  initializeApp(firebaseConfig, 'member-phone-auth');

export const auth = getAuth(app);
export const phoneAuth = getAuth(phoneAuthApp);
export const storage = getStorage(app);

let db: any;
try {
  const dbId = (firebaseConfig as any).firestoreDatabaseId || undefined;
  db = getFirestore(app, dbId);
} catch (e) {
  console.error("Firestore initialization failed:", e);
  // Fallback to default DB if possible
  db = getFirestore(app);
}
export { db };
export const googleAuthProvider = new GoogleAuthProvider();

async function testConnection() {
  try {
    // Only test if we have a real config (not a placeholder)
    if (firebaseConfig.projectId !== 'remixed-project-id') {
      await getDocFromServer(doc(db, 'test', 'connection'));
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
