// js/services/applicationsService.js
import { db } from "../firebase.js";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/**
 * 応募：uid_jobId で固定IDにして重複応募を防ぐ
 */
export async function applyToJob({ uid, jobId, jobTitle, shop }) {
  const id = `${uid}_${jobId}`;
  const ref = doc(db, "applications", id);

  await setDoc(
    ref,
    {
      uid,
      jobId,
      jobTitle,
      shop,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return { id };
}

export async function cancelApplication({ uid, jobId }) {
  const id = `${uid}_${jobId}`;
  await deleteDoc(doc(db, "applications", id));
}

export async function updateApplicationStatus(applicationId, status) {
  if (!applicationId) return;
  await updateDoc(doc(db, "applications", applicationId), {
    status: String(status || "選考中"),
    updatedAt: serverTimestamp()
  });
}

export async function updateApplicationAdminFields(applicationId, patch = {}) {
  if (!applicationId) return;
  await updateDoc(doc(db, "applications", applicationId), {
    ...patch,
    updatedAt: serverTimestamp()
  });
}

export async function proposeInterviewSlots(applicationId, slots = []) {
  if (!applicationId) return;
  const clean = slots
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .slice(0, 2);

  await updateDoc(doc(db, "applications", applicationId), {
    "interviewProposal.slots": clean,
    "interviewProposal.selected": "",
    "interviewProposal.updatedAt": Date.now(),
    updatedAt: serverTimestamp()
  });
}

export async function selectInterviewSlot(applicationId, slot) {
  if (!applicationId || !slot) return;
  await updateDoc(doc(db, "applications", applicationId), {
    "interviewProposal.selected": String(slot),
    "interviewProposal.updatedAt": Date.now(),
    status: "面接予定",
    updatedAt: serverTimestamp()
  });
}

/**
 * 自分の応募履歴（インデックス不要：orderByしない→JSでソート）
 */
export async function listMyApplications(uid) {
  const q = query(collection(db, "applications"), where("uid", "==", uid));
  const snap = await getDocs(q);

  const apps = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  apps.sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));
  return apps;
}

/**
 * 全応募（応募者数集計用）
 * ※データが大量になる運用には向きませんが、課題/小規模ならOK
 */
export async function listAllApplications() {
  const snap = await getDocs(collection(db, "applications"));
  const apps = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  apps.sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));
  return apps;
}

/**
 * 応募者数を jobId => count の Map で返す
 */
export async function getApplicationCountsByJob() {
  const apps = await listAllApplications();
  const map = new Map();
  for (const a of apps) {
    const jobId = a.jobId;
    if (!jobId) continue;
    map.set(jobId, (map.get(jobId) || 0) + 1);
  }
  return map;
}

/**
 * 管理者用：指定 jobId の応募者一覧
 * ※orderByなし（インデックス不要）
 */
export async function listApplicationsByJobId(jobId) {
  const q = query(collection(db, "applications"), where("jobId", "==", jobId));
  const snap = await getDocs(q);

  const apps = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  apps.sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));
  return apps;
}

function toMillisSafe(ts) {
  if (ts && typeof ts.toMillis === "function") return ts.toMillis();
  return 0;
}
