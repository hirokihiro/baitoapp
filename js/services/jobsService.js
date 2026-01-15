import { db } from "../firebase.js";
import {
  collection, addDoc, doc, updateDoc, deleteDoc, getDocs,
  query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export function normalizeTags(text) {
  return String(text || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

export async function createJob(job) {
  const col = collection(db, "jobs");
  const payload = {
    ...job,
    wage: Number(job.wage || 0),
    tags: Array.isArray(job.tags) ? job.tags : [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const ref = await addDoc(col, payload);
  return ref.id;
}

export async function updateJob(jobId, patch) {
  await updateDoc(doc(db, "jobs", jobId), {
    ...patch,
    wage: patch.wage != null ? Number(patch.wage) : undefined,
    updatedAt: serverTimestamp()
  });
}

export async function removeJob(jobId) {
  await deleteDoc(doc(db, "jobs", jobId));
}

export async function listJobs(sort = "new") {
  let q;
  if (sort === "wage_desc") q = query(collection(db, "jobs"), orderBy("wage", "desc"));
  else if (sort === "wage_asc") q = query(collection(db, "jobs"), orderBy("wage", "asc"));
  else q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
