// js/main-admin.js
import { watchAuth, logout, fetchMyProfile } from "./services/authService.js";
import {
  listJobs,
  createJob,
  normalizeTags
} from "./services/jobsService.js";
import {
  getApplicationCountsByJob,
  listApplicationsByJobId
} from "./services/applicationsService.js";
import { renderApplications } from "./ui/renderApplications.js";
import { toast } from "./ui/toast.js";

// ===== chat =====
import {
  ensureConversation,
  watchMessages,
  sendMessage,
  markRead
} from "./services/chatService.js";
import { renderChat } from "./ui/renderChat.js";

// ===== profile =====
import { getUserProfile } from "./services/profileService.js";

// ===== DOM =====
const logoutBtn = document.getElementById("logoutBtn");
const adminMsg = document.getElementById("adminMsg");

const jobForm = document.getElementById("jobForm");
const resetBtn = document.getElementById("resetBtn");

const jobsWrap = document.getElementById("jobsWrap");
const jobsMsg = document.getElementById("jobsMsg");

const appsMsgAdmin = document.getElementById("appsMsgAdmin");
const appsWrapAdmin = document.getElementById("appsWrapAdmin");

const profileMsgAdmin = document.getElementById("profileMsgAdmin");
const profileWrapAdmin = document.getElementById("profileWrapAdmin");

// chat UI
const chatMetaAdmin = document.getElementById("chatMetaAdmin");
const chatWrapAdmin = document.getElementById("chatWrapAdmin");
const chatInputAdmin = document.getElementById("chatInputAdmin");
const chatSendAdmin = document.getElementById("chatSendAdmin");

// ===== state =====
let uid = null;
let profile = null;
let allJobs = [];
let countsMap = new Map();

// chat state
let currentChatAppId = null;
let unSubChatAdmin = null;

// ===== logout =====
logoutBtn?.addEventListener("click", async () => {
  await logout();
  location.href = "./index.html";
});

// ===== auth =====
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

// ===== 求人投稿 =====
jobForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    const title = document.getElementById("title").value.trim();
    const shop = document.getElementById("shop").value.trim();
    const area = document.getElementById("area").value;
    const wage = document.getElementById("wage").value;
    const shift = document.getElementById("shift").value.trim();
    const description = document.getElementById("description").value.trim();
    const tagsText = document.getElementById("tagsText").value;

    if (!title || !shop || !area || !wage || !shift || !description) {
      toast("未入力の項目があります");
      return;
    }

    const tags = normalizeTags(tagsText);

    await createJob({
      title,
      shop,
      area,
      wage,
      shift,
      description,
      tags
    });

    toast("求人を投稿しました");
    jobForm.reset();

    await refresh();
  } catch (err) {
    console.error(err);
    toast("求人の投稿に失敗しました");
  }
});

resetBtn?.addEventListener("click", () => jobForm.reset());

// ===== 一覧取得 =====
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

// ===== 求人一覧 =====
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
      <p class="job-title">${escapeHtml(job.title)}</p>
      <div class="job-meta">店舗：${escapeHtml(job.shop)}</div>
      <div class="job-meta">エリア：${escapeHtml(job.area)}</div>
      <div class="job-meta">時給：${job.wage}円</div>
      <div class="job-meta">応募者数：<b>${count}</b>人</div>
      <div class="row" style="gap:8px; margin-top:8px;">
        <button class="btn primary" data-show="${job.id}">応募者を見る</button>
      </div>
    `;

    card.querySelector(`[data-show="${job.id}"]`)?.addEventListener(
      "click",
      async () => {
        await showApplicants(job);
      }
    );

    list.appendChild(card);
  }

  jobsWrap.appendChild(list);
}

// ===== 応募者一覧 =====
async function showApplicants(job) {
  appsMsgAdmin.textContent = "読み込み中...";
  appsWrapAdmin.innerHTML = "";
  profileWrapAdmin.innerHTML = `<p class="muted">まだ選択されていません。</p>`;
  chatWrapAdmin.innerHTML = "";

  try {
    const apps = await listApplicationsByJobId(job.id);
    appsMsgAdmin.textContent = `${job.title} の応募者：${apps.length}人`;

    renderApplications(appsWrapAdmin, apps, {
      showUid: true,
      onOpenChat: (app) => openChat(app),
      onShowProfile: (app) => showApplicantProfile(app.uid)
    });
  } catch (e) {
    console.error(e);
    appsMsgAdmin.textContent = "応募者の取得に失敗しました。";
  }
}

// ===== プロフィール表示 =====
async function showApplicantProfile(applicantUid) {
  profileMsgAdmin.textContent = "読み込み中...";

  try {
    const p = await getUserProfile(applicantUid);

    profileMsgAdmin.textContent = "";
    profileWrapAdmin.innerHTML = `
      <p class="job-title">${escapeHtml(p?.name || "未設定")}</p>
      <div class="job-meta">メール：${escapeHtml(p?.email || "")}</div>
      <div class="job-meta">電話：${escapeHtml(p?.phone || "")}</div>
      <div class="job-meta">ひとこと：${escapeHtml(p?.bio || "")}</div>
      <div class="job-meta">role：${escapeHtml(p?.role || "user")}</div>
    `;
  } catch (e) {
    console.error(e);
    profileMsgAdmin.textContent = "プロフィール取得失敗";
  }
}

// ===== チャット =====
async function openChat(app) {
  currentChatAppId = app.id;

  await ensureConversation({
    applicationId: app.id,
    jobId: app.jobId,
    applicantUid: app.uid
  });

  chatMetaAdmin.textContent = `${app.jobTitle} / 応募者：${app.uid}`;

  if (unSubChatAdmin) unSubChatAdmin();
  unSubChatAdmin = watchMessages(app.id, (msgs) => {
    renderChat({ wrapEl: chatWrapAdmin, meUid: uid, messages: msgs });
  });

  await markRead({ applicationId: app.id, viewerRole: "admin" });
}

chatSendAdmin?.addEventListener("click", async () => {
  const text = chatInputAdmin.value.trim();
  if (!text || !currentChatAppId) return;

  await sendMessage({
    applicationId: currentChatAppId,
    senderUid: uid,
    senderRole: "admin",
    text
  });

  chatInputAdmin.value = "";
});

// ===== util =====
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
