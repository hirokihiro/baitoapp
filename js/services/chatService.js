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
  increment,
  getDocs,
  limit,
  writeBatch,
  arrayUnion
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
    unreadForUser: 0,
    typingUserAt: null,
    typingAdminAt: null
  });
}

export function watchConversationMeta(applicationId, onChange) {
  const ref = doc(db, "conversations", applicationId);
  return onSnapshot(ref, (snap) => {
    onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export async function setTypingState({ applicationId, role, isTyping }) {
  if (!applicationId || !role) return;
  const key = role === "admin" ? "typingAdminAt" : "typingUserAt";
  await updateDoc(doc(db, "conversations", applicationId), {
    [key]: isTyping ? Date.now() : null
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
 * ✅ 送信者は最初から既読なので readBy に自分の role を入れる
 */
export async function sendMessage({ applicationId, senderUid, senderRole, text }) {
  const convRef = doc(db, "conversations", applicationId);
  const msgCol = collection(db, "conversations", applicationId, "messages");

  const clean = (text || "").trim();
  if (!clean) return;

  await addDoc(msgCol, {
    senderUid,
    senderRole, // "user" | "admin"
    text: clean,
    createdAt: serverTimestamp(),

    // ✅ 既読用：まず送信者は既読
    readBy: [senderRole]
  });

  const unreadUpdate =
    senderRole === "admin"
      ? { unreadForUser: increment(1) }
      : { unreadForAdmin: increment(1) };

  await updateDoc(convRef, {
    updatedAt: serverTimestamp(),
    lastMessage: clean.slice(0, 80),
    ...unreadUpdate
  });
}

/**
 * 既読化
 * ✅ 会話の未読カウンタを0にする + メッセージにも readBy を付与する
 * - 直近50件を見て「相手のメッセージで、まだ viewerRole が readBy に無いもの」に viewerRole を追加
 */
export async function markRead({ applicationId, viewerRole }) {
  const convRef = doc(db, "conversations", applicationId);

  // ① 会話の未読カウンタを0（あなたの設計を維持）
  if (viewerRole === "admin") {
    await updateDoc(convRef, { unreadForAdmin: 0 });
  } else {
    await updateDoc(convRef, { unreadForUser: 0 });
  }

  // ② メッセージに既読情報を付ける（UIの「既読」に必要）
  const msgCol = collection(db, "conversations", applicationId, "messages");
  const q = query(msgCol, orderBy("createdAt", "desc"), limit(50));
  const snap = await getDocs(q);

  const batch = writeBatch(db);

  snap.docs.forEach((d) => {
    const m = d.data();
    if (!m) return;

    // 自分が送ったメッセージは対象外
    if (m.senderRole === viewerRole) return;

    const readBy = Array.isArray(m.readBy) ? m.readBy : [];
    if (readBy.includes(viewerRole)) return;

    batch.update(d.ref, { readBy: arrayUnion(viewerRole) });
  });

  await batch.commit();
}
