import { db } from "../firebase.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function upsertUserProfile(uid, data) {
  await setDoc(doc(db, "users", uid), {
    ...data,
    updatedAt: serverTimestamp()
  }, { merge: true });
}
