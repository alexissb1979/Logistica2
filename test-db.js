import { firebaseConfig } from './src/firebase.js';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc } from "firebase/firestore";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-9f64b09c-062a-4f05-ae48-1df1c9bded1a");

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
