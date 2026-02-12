import { onDocumentCreated, onDocumentWritten, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();
setGlobalOptions({ region: "asia-northeast1", maxInstances: 10 });

const db = getFirestore();

export const onMessageCreated = onDocumentCreated(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const msg = snap.data() || {};
    const conversationId = event.params.conversationId;
    const text = String(msg.text || "").trim();
    if (!text) return;

    const senderRole = msg.senderRole === "admin" ? "admin" : "user";
    const unreadUpdate = senderRole === "admin"
      ? { unreadForUser: FieldValue.increment(1) }
      : { unreadForAdmin: FieldValue.increment(1) };

    await db.collection("conversations").doc(conversationId).set(
      {
        updatedAt: FieldValue.serverTimestamp(),
        lastMessage: text.slice(0, 80),
        ...unreadUpdate,
      },
      { merge: true }
    );
  }
);

export const onApplicationStatusChanged = onDocumentUpdated(
  "applications/{applicationId}",
  async (event) => {
    const before = event.data?.before?.data() || {};
    const after = event.data?.after?.data() || {};
    const beforeStatus = String(before.status || "選考中");
    const afterStatus = String(after.status || "選考中");

    if (beforeStatus === afterStatus) return;

    const applicationId = event.params.applicationId;
    const systemText = buildStatusText(afterStatus, String(after.jobTitle || "求人"));
    if (!systemText) return;

    const convRef = db.collection("conversations").doc(applicationId);
    await convRef.set(
      {
        applicantUid: after.uid || before.uid || "",
        jobId: after.jobId || before.jobId || "",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await convRef.collection("messages").add({
      senderUid: "system",
      senderRole: "admin",
      text: systemText,
      createdAt: FieldValue.serverTimestamp(),
      readBy: ["admin"],
      system: true,
    });
  }
);

export const onConversationWrite = onDocumentWritten(
  "conversations/{conversationId}",
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;

    const data = after.data() || {};
    const applicantUid = String(data.applicantUid || "");
    if (!applicantUid) return;

    // Lightweight notification queue (worker/extension can consume this collection).
    const unreadForUser = Number(data.unreadForUser || 0);
    if (unreadForUser > 0) {
      await db.collection("notificationQueue").add({
        type: "chat_unread_user",
        applicantUid,
        conversationId: after.id,
        unread: unreadForUser,
        lastMessage: String(data.lastMessage || ""),
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
);

export const getAdminDashboard = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "ログインが必要です。");

  const me = await db.collection("users").doc(uid).get();
  if (!me.exists || me.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "管理者権限が必要です。");
  }

  const [jobsSnap, appsSnap] = await Promise.all([
    db.collection("jobs").get(),
    db.collection("applications").get(),
  ]);

  const jobs = jobsSnap.docs.map((d) => d.data());
  const apps = appsSnap.docs.map((d) => d.data());

  const validWages = jobs
    .map((j) => Number(j.wage || 0))
    .filter((v) => Number.isFinite(v) && v >= 500 && v <= 10000);

  const wageAvg = validWages.length
    ? Math.round(validWages.reduce((s, n) => s + n, 0) / validWages.length)
    : 0;

  const now = new Date();
  const todayApps = apps.filter((a) => {
    const d = toDateSafe(a.createdAt);
    return d
      && d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
  }).length;

  return {
    jobsCount: jobs.length,
    applicationsCount: apps.length,
    applicationsToday: todayApps,
    averageWage: wageAvg,
  };
});

function buildStatusText(status, title) {
  if (status === "面接予定") return `${title} の選考は面接予定に進みました。詳細は追ってご連絡します。`;
  if (status === "採用") return `${title} へのご応募ありがとうございます。採用となりました。初回勤務についてご連絡します。`;
  if (status === "不採用") return `${title} へのご応募ありがとうございました。今回は見送りとなりました。`;
  return "";
}

function toDateSafe(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate();
  if (typeof v.seconds === "number") return new Date(v.seconds * 1000);
  const n = Number(v);
  if (Number.isFinite(n)) return new Date(n);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
