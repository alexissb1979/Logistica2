import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, onSnapshot } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyAfJr7iy2Ma1UJHc2I2tpYf8QSUgkuTWk8",
  authDomain: "eco-chalice-5w532.firebaseapp.com",
  projectId: "eco-chalice-5w532",
  storageBucket: "eco-chalice-5w532.firebasestorage.app",
  messagingSenderId: "49595724116",
  appId: "1:49595724116:web:4c33b31c4d7dce0a29d8c1"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, "ai-studio-9f64b09c-062a-4f05-ae48-1df1c9bded1a");
const auth = getAuth(app);

async function test() {
  try {
    await signInWithEmailAndPassword(auth, "sepulveda.alexis.a@gmail.com", "your-password-if-needed");
  } catch(e) {
    console.log("Could not sign in, will try unauthenticated: " + e.message);
  }
  
  onSnapshot(collection(db, "routes"), (snap) => {
    console.log("Routes snapshot size:", snap.size);
    process.exit(0);
  }, (err) => {
    console.error("Snapshot error:", err);
    process.exit(1);
  });
}
test();
