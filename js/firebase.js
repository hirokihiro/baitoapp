// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB9HCV6zsfc7UW4beYt-MuN1-C4aYib39g",
  authDomain: "baitoapp-52879.firebaseapp.com",
  projectId: "baitoapp-52879",
  storageBucket: "baitoapp-52879.firebasestorage.app",
  messagingSenderId: "245886740126",
  appId: "1:245886740126:web:9397b836cfcb46c623bd8f"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
