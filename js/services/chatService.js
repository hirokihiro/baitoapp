// js/services/chatService.js
import { db } from "../firebase.js";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/**
 * 応募ごとに1つ会話を作る（applicationId = uid_jobId）
 */
export async function ensureConversation({ applicationId, jobId, applicantUid }) {
  const ref = doc(db, "conversations", applicationId);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  await setDoc(ref, {
    jobId,
    applicantUid,
    updatedAt: serverTimestamp(),
    lastMessage: "",
    unreadForAdmin: 0,
    unreadForUser: 0
  });
}

/**
 * メッセージをリアルタイム購読
 */
export function watchMessages(applicationId, onChange) {
  const q = query(
    collection(db, "conversations", applicationId, "messages"),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    onChange(msgs);
  });
}

/**
 * 送信
 */
export async function sendMessage({ applicationId, senderUid, senderRole, text }) {
  const convRef = doc(db, "conversations", applicationId);
  const msgCol = collection(db, "conversations", applicationId, "messages");

  await addDoc(msgCol, {
    senderUid,
    senderRole, // "user" | "admin"
    text,
    createdAt: serverTimestamp()
  });

  const unreadUpdate =
    senderRole === "admin"
      ? { unreadForUser: increment(1) }
      : { unreadForAdmin: increment(1) };

  await updateDoc(convRef, {
    updatedAt: serverTimestamp(),
    lastMessage: text.slice(0, 80),
    ...unreadUpdate
  });
}

/**
 * 既読化
 */
export async function markRead({ applicationId, viewerRole }) {
  const convRef = doc(db, "conversations", applicationId);
  if (viewerRole === "admin") {
    await updateDoc(convRef, { unreadForAdmin: 0 });
  } else {
    await updateDoc(convRef, { unreadForUser: 0 });
  }
}
