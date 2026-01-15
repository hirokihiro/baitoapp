import { db } from "../firebase.js";
import { doc, setDoc, deleteDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export async function setFavorite(uid, jobId, isFav) {
  const ref = doc(db, "favorites", `${uid}_${jobId}`);
  if (isFav) {
    await setDoc(ref, { uid, jobId });
  } else {
    await deleteDoc(ref);
  }
}

export async function listFavorites(uid) {
  const q = query(collection(db, "favorites"), where("uid", "==", uid));
  const snap = await getDocs(q);
  return new Set(snap.docs.map(d => d.data().jobId));
}
