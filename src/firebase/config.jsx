import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDYhsumgy7AlPF_1EKfdavmaBxrdNdyjyg",
  authDomain: "online-auction-system-88723.firebaseapp.com",
  projectId: "online-auction-system-88723",
  storageBucket: "online-auction-system-88723.appspot.com",
  messagingSenderId: "986022333212",
  appId: "1:986022333212:web:d318394edc882ee97e08d9",
  measurementId: "G-9803SL27LZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore and Auth
export const db = getFirestore(app);
export const auth = getAuth(app);
