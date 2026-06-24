import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, addDoc } from "firebase/firestore";

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

async function test() {
  try {
    const querySnapshot = await getDocs(collection(db, "routes"));
    console.log("Routes count:", querySnapshot.size);
    querySnapshot.forEach((doc) => {
      console.log(doc.id, " => ", doc.data());
    });
    console.log("Success");
  } catch (e) {
    console.error("Error reading document: ", e);
  }
}
test();
