// js/main-admin.js
import { watchAuth, logout, fetchMyProfile } from "./services/authService.js";
import { listJobs } from "./services/jobsService.js";
import { getApplicationCountsByJob, listApplicationsByJobId } from "./services/applicationsService.js";
import { renderApplications } from "./ui/renderApplications.js";
import { toast } from "./ui/toast.js";

// chat
import { ensureConversation, watchMessages, sendMessage, markRead } from "./services/chatService.js";
import { renderChat } from "./ui/renderChat.js";

// profile (既に作ってあるやつを流用)
import { getUserProfile } from "./services/profileService.js";

const logoutBtn = document.getElementById("logoutBtn");
const adminMsg = document.getElementById("adminMsg");

const jobsWrap = document.getElementById("jobsWrap");
const jobsMsg = document.getElementById("jobsMsg");

const appsMsgAdmin = document.getElementById("appsMsgAdmin");
const appsWrapAdmin = document.getElementById("appsWrapAdmin");

// chat UI（admin.html にある前提）
const chatMetaAdmin = document.getElementById("chatMetaAdmin");
const chatWrapAdmin = document.getElementById("chatWrapAdmin");
const chatInputAdmin = document.getElementById("chatInputAdmin");
const chatSendAdmin = document.getElementById("chatSendAdmin");

// profile UI（今回追加）
const profileMsgAdmin = document.getElementById("profileMsgAdmin");
const profileWrapAdmin = document.getElementById("profileWrapAdmin");

let uid = null;
let profile = null;

let allJobs = [];
let countsMap = new Map();

// chat state
let currentChatAppId = null;
let unSubChatAdmin = null;

logoutBtn?.addEventListener("click", async () => {
  await logout();
  location.href = "./index.html";
});

// 管理者送信
chatSendAdmin?.addEventListener("click", async () => {
  const text = (chatInputAdmin?.value || "").trim();
  if (!text || !currentChatAppId || !uid) return;

  try {
    await sendMessage({
      applicationId: currentChatAppId,
      senderUid: uid,
      senderRole: "admin",
      text
    });
    chatInputAdmin.value = "";
  } catch (e) {
    console.error(e);
    toast("送信に失敗しました");
  }
});

watchAuth(async (user) => {
  if (!user) {
    location.href = "./index.html";
    return;
  }

  uid = user.uid;
  profile = await fetchMyProfile();

  if (profile?.role !== "admin") {
    adminMsg.textContent = "管理者権限がありません。";
    setTimeout(() => (location.href = "./app.html"), 800);
    return;
  }

  adminMsg.textContent = "";
  await refresh();
});

async function refresh() {
  jobsMsg.textContent = "読み込み中...";
  try {
    allJobs = await listJobs("new");
    countsMap = await getApplicationCountsByJob();
    jobsMsg.textContent = "";
    renderAdminJobs();
  } catch (e) {
    console.error(e);
    jobsMsg.textContent = "求人の取得に失敗しました。";
  }
}

function renderAdminJobs() {
  jobsWrap.innerHTML = "";

  if (!allJobs.length) {
    jobsWrap.innerHTML = `<p class="muted">求人がありません。</p>`;
    return;
  }

  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gap = "10px";

  for (const job of allJobs) {
    const card = document.createElement("div");
    card.className = "job-card";
    const count = countsMap.get(job.id) || 0;

    card.innerHTML = `
      <p class="job-title">${escapeHtml(job.title || "")}</p>
      <div class="job-meta">店舗：${escapeHtml(job.shop || "")}</div>
      <div class="job-meta">エリア：${escapeHtml(job.area || "")}</div>
      <div class="job-meta">応募者数：<b>${count}</b>人</div>
      <div class="row" style="gap:8px; margin-top:10px;">
        <button class="btn primary" data-show="${job.id}">応募者を見る</button>
      </div>
    `;

    card.querySelector(`[data-show="${job.id}"]`)?.addEventListener("click", async () => {
      await showApplicants(job.id, job.title, job.shop);
    });

    list.appendChild(card);
  }

  jobsWrap.appendChild(list);
}

async function showApplicants(jobId, title, shop) {
  appsMsgAdmin.textContent = "読み込み中...";
  appsWrapAdmin.innerHTML = "";
  if (profileMsgAdmin) profileMsgAdmin.textContent = "";
  if (profileWrapAdmin) profileWrapAdmin.innerHTML = `<p class="muted">まだ選択されていません。</p>`;

  try {
    const apps = await listApplicationsByJobId(jobId);

    appsMsgAdmin.textContent = `${title || ""}（${shop || ""}）の応募者：${apps.length}人`;

    // 応募者一覧を描画（チャット＋プロフィールボタンを付ける）
    renderApplications(appsWrapAdmin, apps, {
      showUid: true,
      onOpenChat: async (app) => openChat(app),
      // ★プロフィールボタンを追加するため、renderApplications に少しだけ手を入れたくない場合は、
      // ここでは「チャット」をプロフィール用途にせず、下で追加のボタンを差し込む方式にします。
    });

    // renderApplications の中の各カードに「プロフィール」ボタンを後付け
    // （renderApplications をいじらなくていい作戦）
    addProfileButtons(appsWrapAdmin, apps);

  } catch (e) {
    console.error(e);
    appsMsgAdmin.textContent = "応募者一覧の取得に失敗しました。";
    toast("応募者一覧の取得に失敗しました");
  }
}

function addProfileButtons(container, apps) {
  // renderApplications が作った .job-card を順に取って、同じ順番でボタンを追加
  const cards = container.querySelectorAll(".job-card");
  cards.forEach((card, idx) => {
    const app = apps[idx];
    if (!app) return;

    // すでにボタンがあれば追加しない
    if (card.querySelector("[data-profile]")) return;

    const row = card.querySelector(".row");
    if (!row) return;

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "プロフィール";
    btn.setAttribute("type", "button");
    btn.setAttribute("data-profile", "1");

    btn.addEventListener("click", async () => {
      await showApplicantProfile(app.uid);
    });

    row.appendChild(btn);
  });
}

async function showApplicantProfile(applicantUid) {
  if (!profileWrapAdmin) return;
  if (!applicantUid) return;

  if (profileMsgAdmin) profileMsgAdmin.textContent = "読み込み中...";

  try {
    const p = await getUserProfile(applicantUid);

    if (!p) {
      if (profileMsgAdmin) profileMsgAdmin.textContent = "プロフィールが見つかりません。";
      profileWrapAdmin.innerHTML = `<p class="muted">プロフィールが見つかりません。</p>`;
      return;
    }

    if (profileMsgAdmin) profileMsgAdmin.textContent = "";

    profileWrapAdmin.innerHTML = `
      <p class="job-title">${escapeHtml(p.name || "（名前未設定）")}</p>
      <div class="job-meta">UID：${escapeHtml(applicantUid)}</div>
      <div class="job-meta">メール：${escapeHtml(p.email || "（未保存）")}</div>
      <div class="job-meta">電話：${escapeHtml(p.phone || "（未設定）")}</div>
      <div class="job-meta">ひとこと：${escapeHtml(p.bio || "（未設定）")}</div>
      <div class="job-meta">role：${escapeHtml(p.role || "user")}</div>
    `;
  } catch (e) {
    console.error(e);
    if (profileMsgAdmin) profileMsgAdmin.textContent = "プロフィールの取得に失敗しました。";
    profileWrapAdmin.innerHTML = `<p class="muted">プロフィールの取得に失敗しました。</p>`;
  }
}

async function openChat(app) {
  currentChatAppId = app.id;

  await ensureConversation({
    applicationId: app.id,
    jobId: app.jobId,
    applicantUid: app.uid
  });

  if (chatMetaAdmin) {
    chatMetaAdmin.textContent = `${app.jobTitle || ""}（${app.shop || ""}）/ 応募者:${app.uid || ""}`;
  }

  if (unSubChatAdmin) unSubChatAdmin();
  unSubChatAdmin = watchMessages(app.id, (msgs) => {
    if (!chatWrapAdmin) return;
    renderChat({ wrapEl: chatWrapAdmin, meUid: uid, messages: msgs });
  });

  await markRead({ applicationId: app.id, viewerRole: "admin" });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
