// js/main-admin.js
import { watchAuth, logout, fetchMyProfile } from "./services/authService.js";
import { listJobs, createJob, updateJob, removeJob, normalizeTags } from "./services/jobsService.js";
import {
  getApplicationCountsByJob,
  listApplicationsByJobId,
  updateApplicationStatus,
  updateApplicationAdminFields,
  proposeInterviewSlots,
  listAllApplications
} from "./services/applicationsService.js";
import { renderApplications } from "./ui/renderApplications.js";
import { toast } from "./ui/toast.js";

// ===== chat =====
import {
  ensureConversation,
  watchMessages,
  sendMessage,
  markRead,
  watchConversationMeta,
  setTypingState,
  watchAllConversations
} from "./services/chatService.js";
import { renderChat } from "./ui/renderChat.js";

// ===== profile =====
import { getUserProfile } from "./services/profileService.js";

// ===== DOM =====
const logoutBtn = document.getElementById("logoutBtn");
const adminMsg = document.getElementById("adminMsg");

const jobForm = document.getElementById("jobForm");
const resetBtn = document.getElementById("resetBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const jobTemplateSelect = document.getElementById("jobTemplateSelect");
const saveJobTemplateBtn = document.getElementById("saveJobTemplateBtn");

const titleEl = document.getElementById("title");
const shopEl = document.getElementById("shop");
const areaEl = document.getElementById("area");
const wageEl = document.getElementById("wage");
const shiftEl = document.getElementById("shift");
const tagsTextEl = document.getElementById("tagsText");
const descriptionEl = document.getElementById("description");

const jobsWrap = document.getElementById("jobsWrap");
const jobsMsg = document.getElementById("jobsMsg");
const jobsStatsAdmin = document.getElementById("jobsStatsAdmin");
const adminQ = document.getElementById("adminQ");
const adminSort = document.getElementById("adminSort");
const adminAreaFilter = document.getElementById("adminAreaFilter");
const refreshJobsBtn = document.getElementById("refreshJobsBtn");

const kpiJobs = document.getElementById("kpiJobs");
const kpiApps = document.getElementById("kpiApps");
const kpiWage = document.getElementById("kpiWage");
const adminHero = document.getElementById("adminHero");
const adminKpiRow = document.getElementById("adminKpiRow");

const appsMsgAdmin = document.getElementById("appsMsgAdmin");
const appsWrapAdmin = document.getElementById("appsWrapAdmin");
const appsStatusFilterAdmin = document.getElementById("appsStatusFilterAdmin");
const exportAppsCsvBtn = document.getElementById("exportAppsCsvBtn");
const importAppsCsvBtn = document.getElementById("importAppsCsvBtn");
const importAppsCsvFile = document.getElementById("importAppsCsvFile");

const profileMsgAdmin = document.getElementById("profileMsgAdmin");
const profileWrapAdmin = document.getElementById("profileWrapAdmin");

// chat UI
const chatMetaAdmin = document.getElementById("chatMetaAdmin");
const chatWrapAdmin = document.getElementById("chatWrapAdmin");
const chatInputAdmin = document.getElementById("chatInputAdmin");
const chatTemplateAdmin = document.getElementById("chatTemplateAdmin");
const chatRoomsAdmin = document.getElementById("chatRoomsAdmin");
const chatExportBtnAdmin = document.getElementById("chatExportBtnAdmin");
const chatClearDraftBtnAdmin = document.getElementById("chatClearDraftBtnAdmin");
const chatSendAdmin = document.getElementById("chatSendAdmin");
const adminPanelSections = Array.from(document.querySelectorAll("[data-admin-view]"));
const adminTabButtons = Array.from(document.querySelectorAll("button[data-admin-target]"));

// ===== state =====
let uid = null;
let profile = null;
let allJobs = [];
let countsMap = new Map();
let userNameCache = new Map();
let editingJobId = null;
let selectedJob = null;
let selectedApplications = [];
let jobsQueryDebounce = null;
let adminCurrentView = "jobs";
let allApplications = [];
let allConversations = [];
let unSubConversations = null;
let lastUnreadAdmin = new Map();
const ADMIN_TEMPLATE_KEY = "baitoapp.admin.jobtemplates.v1";

// chat state
let currentChatAppId = null;
let unSubChatAdmin = null;
let unSubConvMetaAdmin = null;
let typingTimerAdmin = null;
let typingRemoteAdmin = { on: false, role: null };

// 送信中/失敗のローカルメッセージ
let remoteMessages = [];
let localPending = [];

function mergeMessages(remote, pending) {
  return [...remote, ...pending];
}

function repaintChat() {
  if (!chatWrapAdmin || !uid) return;
  renderChat({
    wrapEl: chatWrapAdmin,
    meUid: uid,
    meRole: "admin",
    messages: mergeMessages(remoteMessages, localPending),
    typing: typingRemoteAdmin,
    onRetryFailed: retryFailedAdminMessage
  });
}

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
  setAdminView("jobs");
  initJobTemplates();
  ensureNotificationPermission();
  await refresh();

  if (unSubConversations) unSubConversations();
  unSubConversations = watchAllConversations((rows) => {
    allConversations = rows || [];
    renderAdminConversationList();
    notifyAdminUnreadChanges(rows || []);
  });
});

adminTabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.adminTarget;
    if (!target) return;
    setAdminView(target);
  });
});

// ===== filters =====
adminQ?.addEventListener("input", () => {
  clearTimeout(jobsQueryDebounce);
  jobsQueryDebounce = setTimeout(() => {
    renderAdminJobs();
  }, 120);
});

adminAreaFilter?.addEventListener("change", renderAdminJobs);

adminSort?.addEventListener("change", async () => {
  await refresh();
});

refreshJobsBtn?.addEventListener("click", async () => {
  await refresh();
  toast("求人一覧を更新しました");
});

jobTemplateSelect?.addEventListener("change", () => {
  const id = jobTemplateSelect.value;
  if (!id) return;
  const templates = readJobTemplates();
  const found = templates.find((t) => t.id === id);
  if (!found) return;
  if (titleEl) titleEl.value = found.title || "";
  if (shopEl) shopEl.value = found.shop || "";
  if (areaEl) areaEl.value = found.area || "";
  if (wageEl) wageEl.value = found.wage || "";
  if (shiftEl) shiftEl.value = found.shift || "";
  if (descriptionEl) descriptionEl.value = found.description || "";
  if (tagsTextEl) tagsTextEl.value = found.tagsText || "";
  toast("テンプレートを適用しました");
});

saveJobTemplateBtn?.addEventListener("click", () => {
  const payload = readJobForm();
  if (!payload.title) {
    toast("タイトルを入力してから保存してください");
    return;
  }
  const templates = readJobTemplates();
  const item = {
    id: `tpl_${Date.now()}`,
    title: payload.title,
    shop: payload.shop,
    area: payload.area,
    wage: payload.wage,
    shift: payload.shift,
    description: payload.description,
    tagsText: (tagsTextEl?.value || "").trim()
  };
  templates.unshift(item);
  writeJobTemplates(templates.slice(0, 20));
  initJobTemplates();
  jobTemplateSelect.value = item.id;
  toast("テンプレートを保存しました");
});

appsStatusFilterAdmin?.addEventListener("change", renderApplicantsPanel);

exportAppsCsvBtn?.addEventListener("click", () => {
  if (!selectedJob) {
    toast("先に求人を選択してください");
    return;
  }
  const list = filteredApplications(selectedApplications);
  if (!list.length) {
    toast("出力対象の応募者がいません");
    return;
  }

  const lines = [
    ["applicationId", "jobTitle", "shop", "uid", "status", "createdAt"],
    ...list.map((a) => [
      a.id || "",
      a.jobTitle || "",
      a.shop || "",
      a.uid || "",
      resolveStatus(a),
      formatWhen(a.createdAt)
    ])
  ];

  const csv = lines
    .map((row) => row.map((v) => `"${String(v).replaceAll("\"", "\"\"")}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date();
  const stamp = `${ts.getFullYear()}${pad2(ts.getMonth() + 1)}${pad2(ts.getDate())}_${pad2(ts.getHours())}${pad2(ts.getMinutes())}`;
  a.href = url;
  a.download = `applications_${selectedJob.id}_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

importAppsCsvBtn?.addEventListener("click", () => {
  importAppsCsvFile?.click();
});

importAppsCsvFile?.addEventListener("change", async () => {
  const file = importAppsCsvFile.files?.[0];
  if (!file) return;

  const text = await file.text();
  const rows = parseSimpleCsv(text);
  let updated = 0;

  for (const row of rows) {
    const applicationId = row.applicationId || row.id || "";
    const status = row.status || "";
    if (!applicationId || !status) continue;
    try {
      await updateApplicationStatus(applicationId, status);
      updated += 1;
    } catch (e) {
      console.error("CSV status update failed", applicationId, e);
    }
  }

  importAppsCsvFile.value = "";
  await refresh();
  if (selectedJob) {
    const nextJob = allJobs.find((j) => j.id === selectedJob.id);
    if (nextJob) await showApplicants(nextJob, { silentLoading: true });
  }
  toast(`CSVで${updated}件更新しました`);
});

chatTemplateAdmin?.addEventListener("change", () => {
  const text = chatTemplateAdmin.value;
  if (!text || !chatInputAdmin) return;
  const prev = (chatInputAdmin.value || "").trim();
  chatInputAdmin.value = prev ? `${prev}\n${text}` : text;
  persistAdminDraft(chatInputAdmin.value);
  handleAdminTypingInput(chatInputAdmin.value);
  chatInputAdmin.focus();
  chatTemplateAdmin.value = "";
});

chatInputAdmin?.addEventListener("input", () => {
  const text = chatInputAdmin.value || "";
  persistAdminDraft(text);
  handleAdminTypingInput(text);
});

chatClearDraftBtnAdmin?.addEventListener("click", async () => {
  if (!chatInputAdmin) return;
  chatInputAdmin.value = "";
  persistAdminDraft("");
  await updateAdminTyping(false);
  toast("下書きをクリアしました");
});

chatExportBtnAdmin?.addEventListener("click", () => {
  if (!currentChatAppId) {
    toast("先にチャットを開いてください");
    return;
  }
  exportAdminChatLog({
    applicationId: currentChatAppId,
    messages: mergeMessages(remoteMessages, localPending)
  });
});

// ===== 求人投稿/編集 =====
jobForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    const payload = readJobForm();

    if (!payload.title || !payload.shop || !payload.area || !payload.wage || !payload.shift || !payload.description) {
      toast("未入力の項目があります");
      return;
    }
    if (!isReasonableWage(payload.wage)) {
      toast("時給は 500〜10000 の範囲で入力してください");
      return;
    }

    if (editingJobId) {
      await updateJob(editingJobId, payload);
      toast("求人を更新しました");
      exitEditMode();
    } else {
      await createJob(payload);
      toast("求人を投稿しました");
      jobForm.reset();
    }

    await refresh();
  } catch (err) {
    console.error(err);
    toast(editingJobId ? "求人の更新に失敗しました" : "求人の投稿に失敗しました");
  }
});

resetBtn?.addEventListener("click", () => {
  jobForm?.reset();
});

cancelEditBtn?.addEventListener("click", () => {
  exitEditMode();
  jobForm?.reset();
});

// ===== 一覧取得 =====
async function refresh() {
  jobsMsg.textContent = "読み込み中...";
  try {
    allJobs = await listJobs(adminSort?.value || "new");
    countsMap = await getApplicationCountsByJob();
    allApplications = await listAllApplications();
    jobsMsg.textContent = "";

    updateDashboard();
    renderAdminJobs();

    if (selectedJob) {
      const latestSelected = allJobs.find((j) => j.id === selectedJob.id) || null;
      if (!latestSelected) {
        selectedJob = null;
        selectedApplications = [];
        appsMsgAdmin.textContent = "選択中の求人が削除されました。";
        appsWrapAdmin.innerHTML = "";
      } else {
        await showApplicants(latestSelected, { silentLoading: true });
      }
    }
  } catch (e) {
    console.error(e);
    jobsMsg.textContent = "求人の取得に失敗しました。";
  }
}

function updateDashboard() {
  const appsTotal = Array.from(countsMap.values()).reduce((sum, n) => sum + Number(n || 0), 0);
  const wages = allJobs
    .map((j) => toSafeWage(j.wage))
    .filter((v) => v !== null);
  const wageAvg = wages.length
    ? Math.round(wages.reduce((sum, w) => sum + w, 0) / wages.length)
    : 0;

  const todayCount = allApplications.filter((a) => isToday(a.createdAt)).length;
  if (kpiJobs) kpiJobs.textContent = `${allJobs.length}件`;
  if (kpiApps) kpiApps.textContent = `${appsTotal}件 / 今日${todayCount}件`;
  if (kpiWage) kpiWage.textContent = `¥${wageAvg.toLocaleString()}`;
}

// ===== 求人一覧 =====
function filteredJobs() {
  const q = (adminQ?.value || "").trim().toLowerCase();
  const area = (adminAreaFilter?.value || "").trim();

  let list = allJobs.slice();

  if (area) {
    list = list.filter((j) => String(j.area || "").trim() === area);
  }

  if (q) {
    list = list.filter((j) => {
      const hay = [j.title, j.shop, j.area, j.shift, ...(Array.isArray(j.tags) ? j.tags : []), j.description]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return list;
}

function renderAdminJobs() {
  jobsWrap.innerHTML = "";

  const listData = filteredJobs();

  if (jobsStatsAdmin) {
    jobsStatsAdmin.textContent = `${listData.length} / ${allJobs.length} 件を表示`;
  }

  if (!listData.length) {
    jobsWrap.innerHTML = `<p class="muted">条件に一致する求人がありません。</p>`;
    return;
  }

  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gap = "10px";

  for (const job of listData) {
    const card = document.createElement("div");
    card.className = "job-card";
    const count = countsMap.get(job.id) || 0;

    card.innerHTML = `
      <p class="job-title">${escapeHtml(job.title)}</p>
      <div class="job-meta">店舗：${escapeHtml(job.shop)}</div>
      <div class="job-meta">エリア：${escapeHtml(job.area)}</div>
      <div class="job-meta">時給：${formatWage(job.wage)}</div>
      <div class="job-meta">応募者数：<b>${count}</b>人</div>
      <div class="row" style="gap:8px; margin-top:8px;">
        <button class="btn primary" data-show="${job.id}">応募者を見る</button>
        <button class="btn" data-edit="${job.id}">編集</button>
        <button class="btn danger" data-delete="${job.id}">削除</button>
      </div>
    `;

    list.appendChild(card);
  }

  list.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("button[data-show], button[data-edit], button[data-delete]");
    if (!btn) return;

    if (btn.dataset.show) {
      const job = allJobs.find((j) => j.id === btn.dataset.show);
      if (job) await showApplicants(job);
      return;
    }

    if (btn.dataset.edit) {
      const job = allJobs.find((j) => j.id === btn.dataset.edit);
      if (job) enterEditMode(job);
      return;
    }

    if (btn.dataset.delete) {
      const job = allJobs.find((j) => j.id === btn.dataset.delete);
      if (!job) return;
      const ok = window.confirm(`「${job.title}」を削除しますか？`);
      if (!ok) return;

      try {
        await removeJob(job.id);
        toast("求人を削除しました");
        if (selectedJob?.id === job.id) {
          selectedJob = null;
          selectedApplications = [];
          appsWrapAdmin.innerHTML = "";
          appsMsgAdmin.textContent = "";
        }
        await refresh();
      } catch (err) {
        console.error(err);
        toast("求人の削除に失敗しました");
      }
    }
  });

  jobsWrap.appendChild(list);
}

function readJobForm() {
  return {
    title: titleEl?.value?.trim() || "",
    shop: shopEl?.value?.trim() || "",
    area: areaEl?.value || "",
    wage: wageEl?.value || "",
    shift: shiftEl?.value?.trim() || "",
    description: descriptionEl?.value?.trim() || "",
    tags: normalizeTags(tagsTextEl?.value || "")
  };
}

function enterEditMode(job) {
  editingJobId = job.id;

  if (titleEl) titleEl.value = job.title || "";
  if (shopEl) shopEl.value = job.shop || "";
  if (areaEl) areaEl.value = job.area || "";
  if (wageEl) wageEl.value = String(job.wage ?? "");
  if (shiftEl) shiftEl.value = job.shift || "";
  if (descriptionEl) descriptionEl.value = job.description || "";
  if (tagsTextEl) tagsTextEl.value = Array.isArray(job.tags) ? job.tags.join(", ") : "";

  const submitBtn = jobForm?.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = "更新する";
  if (cancelEditBtn) cancelEditBtn.style.display = "inline-flex";

  toast(`編集中: ${job.title}`);
  titleEl?.focus();
}

function exitEditMode() {
  editingJobId = null;
  const submitBtn = jobForm?.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = "投稿する";
  if (cancelEditBtn) cancelEditBtn.style.display = "none";
}

// ===== 応募者一覧 =====
async function showApplicants(job, options = {}) {
  const { silentLoading = false } = options;
  selectedJob = job;
  if (!silentLoading) {
    appsMsgAdmin.textContent = "読み込み中...";
  }

  appsWrapAdmin.innerHTML = "";
  profileWrapAdmin.innerHTML = `<p class="muted">まだ選択されていません。</p>`;
  chatWrapAdmin.innerHTML = "";

  try {
    const apps = await listApplicationsByJobId(job.id);
    selectedApplications = apps;
    setAdminView("apps");
    renderApplicantsPanel();
  } catch (e) {
    console.error(e);
    appsMsgAdmin.textContent = "応募者の取得に失敗しました。";
  }
}

function filteredApplications(apps) {
  const statusFilter = appsStatusFilterAdmin?.value || "";
  if (!statusFilter) return apps;
  return apps.filter((a) => resolveStatus(a) === statusFilter);
}

function renderApplicantsPanel() {
  if (!selectedJob) {
    appsMsgAdmin.textContent = "求人を選択してください。";
    appsWrapAdmin.innerHTML = "";
    return;
  }

  const list = filteredApplications(selectedApplications);
  appsMsgAdmin.textContent = `${selectedJob.title} の応募者：${list.length}人（全${selectedApplications.length}人）`;

  renderApplications(appsWrapAdmin, list, {
    showUid: true,
    emptyText: "この求人の応募者はいません。",
    onOpenChat: (app) => openChat(app),
    onShowProfile: (applicantUid) => showApplicantProfile(applicantUid),
    onUpdateStatus: async (applicationId, status) => {
      await updateStatus(applicationId, status);
    },
    onProposeInterview: async (applicationId, slots) => {
      await handleProposeInterview(applicationId, slots);
    },
    onSaveAdminMeta: async (applicationId, meta) => {
      await handleSaveAdminMeta(applicationId, meta);
    }
  });
}

async function updateStatus(applicationId, status) {
  const nextStatus = String(status || "選考中").trim() || "選考中";
  try {
    await updateApplicationStatus(applicationId, nextStatus);
  } catch (err) {
    console.error(err);
    toast("ステータス更新に失敗しました");
    return;
  }

  selectedApplications = selectedApplications.map((a) =>
    a.id === applicationId ? { ...a, status: nextStatus } : a
  );
  renderApplicantsPanel();
  toast(`ステータスを「${nextStatus}」に更新しました`);

  const app = selectedApplications.find((a) => a.id === applicationId);
  if (!app) return;

  const text = buildStatusMessage(nextStatus, app.jobTitle || "");
  if (!text) return;

  try {
    await ensureConversation({
      applicationId: app.id,
      jobId: app.jobId,
      applicantUid: app.uid
    });
    await sendMessage({
      applicationId: app.id,
      senderUid: uid,
      senderRole: "admin",
      text
    });
  } catch (err) {
    console.error("status message send failed", err);
    toast("ステータスは更新しましたが、通知メッセージ送信に失敗しました");
  }
}

async function handleProposeInterview(applicationId, slots) {
  const clean = (slots || []).map((s) => String(s || "").trim()).filter(Boolean).slice(0, 2);
  if (!clean.length) {
    toast("面接候補日時を入力してください");
    return;
  }
  try {
    await proposeInterviewSlots(applicationId, clean);
    selectedApplications = selectedApplications.map((a) =>
      a.id === applicationId
        ? {
            ...a,
            interviewProposal: { ...(a.interviewProposal || {}), slots: clean, selected: "" }
          }
        : a
    );
    const app = selectedApplications.find((a) => a.id === applicationId);
    if (app) {
      await ensureConversation({
        applicationId: app.id,
        jobId: app.jobId,
        applicantUid: app.uid
      });
      await sendMessage({
        applicationId: app.id,
        senderUid: uid,
        senderRole: "admin",
        text: `面接候補です: ${clean.join(" / ")}`
      });
    }
    renderApplicantsPanel();
    toast("面接候補を送信しました");
  } catch (e) {
    console.error(e);
    toast("面接候補の送信に失敗しました");
  }
}

async function handleSaveAdminMeta(applicationId, meta) {
  try {
    await updateApplicationAdminFields(applicationId, {
      adminMemo: String(meta?.memo || "").trim(),
      adminTags: Array.isArray(meta?.tags) ? meta.tags.slice(0, 10) : []
    });
    selectedApplications = selectedApplications.map((a) =>
      a.id === applicationId
        ? {
            ...a,
            adminMemo: String(meta?.memo || "").trim(),
            adminTags: Array.isArray(meta?.tags) ? meta.tags.slice(0, 10) : []
          }
        : a
    );
    toast("メモ/タグを保存しました");
  } catch (e) {
    console.error(e);
    toast("メモ/タグ保存に失敗しました");
  }
}

// ===== プロフィール表示 =====
async function showApplicantProfile(applicantUid) {
  profileMsgAdmin.textContent = "読み込み中...";

  try {
    const p = await getUserProfile(applicantUid);
    setAdminView("profile");

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
  if (!app?.id) return;
  setAdminView("chat");

  if (currentChatAppId && currentChatAppId !== app.id) {
    await updateAdminTyping(false);
  }
  currentChatAppId = app.id;

  await ensureConversation({
    applicationId: app.id,
    jobId: app.jobId,
    applicantUid: app.uid
  });

  let displayName = app.uid;
  if (userNameCache.has(app.uid)) {
    displayName = userNameCache.get(app.uid);
  } else {
    try {
      const p = await getUserProfile(app.uid);
      if (p?.name) {
        displayName = p.name;
        userNameCache.set(app.uid, p.name);
      }
    } catch (e) {
      console.error(e);
    }
  }

  chatMetaAdmin.textContent = `${app.jobTitle || ""} / 応募者：${displayName}`;
  renderAdminConversationList();

  localPending = [];
  remoteMessages = [];
  typingRemoteAdmin = { on: false, role: null };
  loadAdminDraft(app.id);
  repaintChat();

  if (unSubChatAdmin) unSubChatAdmin();
  unSubChatAdmin = watchMessages(app.id, (msgs) => {
    remoteMessages = Array.isArray(msgs) ? msgs : [];
    repaintChat();
  });

  if (unSubConvMetaAdmin) unSubConvMetaAdmin();
  unSubConvMetaAdmin = watchConversationMeta(app.id, (meta) => {
    const typingAt = Number(meta?.typingUserAt || 0);
    const isTyping = typingAt > 0 && (Date.now() - typingAt) < 3500;
    typingRemoteAdmin = { on: isTyping, role: "user" };
    repaintChat();
  });

  await markRead({ applicationId: app.id, viewerRole: "admin" });
}

// ===== 管理者送信 =====
async function doSendAdminChat(textOverride = null) {
  const text = (typeof textOverride === "string" ? textOverride : (chatInputAdmin?.value || "")).trim();
  if (!text || !currentChatAppId || !uid) return;

  const tempId = `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const tempMsg = {
    id: tempId,
    senderUid: uid,
    senderRole: "admin",
    text,
    createdAt: new Date(),
    pending: true,
    failed: false
  };

  localPending.push(tempMsg);
  if (chatInputAdmin && textOverride == null) chatInputAdmin.value = "";
  persistAdminDraft("");
  await updateAdminTyping(false);
  repaintChat();

  try {
    await sendMessage({
      applicationId: currentChatAppId,
      senderUid: uid,
      senderRole: "admin",
      text
    });

    localPending = localPending.filter((m) => m.id !== tempId);
    repaintChat();
  } catch (e) {
    console.error(e);
    localPending = localPending.map((m) =>
      m.id === tempId ? { ...m, pending: false, failed: true } : m
    );
    repaintChat();
    toast("送信に失敗しました");
  }
}

chatSendAdmin?.addEventListener("click", doSendAdminChat);

chatInputAdmin?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  if (e.isComposing) return;
  e.preventDefault();
  doSendAdminChat();
});

function retryFailedAdminMessage(msg) {
  if (!msg?.failed || !msg?.text) return;
  localPending = localPending.filter((m) => m.id !== msg.id);
  repaintChat();
  doSendAdminChat(msg.text);
}

function adminDraftKey(applicationId) {
  if (!uid || !applicationId) return "";
  return `baitoapp.chatdraft.admin.${uid}.${applicationId}`;
}

function persistAdminDraft(text) {
  if (!currentChatAppId) return;
  const key = adminDraftKey(currentChatAppId);
  if (!key) return;
  try {
    localStorage.setItem(key, String(text || ""));
  } catch (e) {
    console.error("Failed to persist admin draft", e);
  }
}

function loadAdminDraft(applicationId) {
  if (!chatInputAdmin) return;
  const key = adminDraftKey(applicationId);
  if (!key) return;
  try {
    chatInputAdmin.value = localStorage.getItem(key) || "";
  } catch (e) {
    console.error("Failed to load admin draft", e);
  }
}

function handleAdminTypingInput(text) {
  if (!currentChatAppId) return;
  const hasText = String(text || "").trim().length > 0;
  if (!hasText) {
    updateAdminTyping(false);
    return;
  }
  updateAdminTyping(true);
  clearTimeout(typingTimerAdmin);
  typingTimerAdmin = setTimeout(() => {
    updateAdminTyping(false);
  }, 1800);
}

async function updateAdminTyping(isTyping) {
  if (!currentChatAppId) return;
  try {
    await setTypingState({ applicationId: currentChatAppId, role: "admin", isTyping });
  } catch (e) {
    console.error("Failed to update admin typing state", e);
  }
}

function exportAdminChatLog({ applicationId, messages }) {
  const lines = (messages || []).map((m) => {
    const when = toDateSafe(m.createdAt || m.created || m.ts || m.timestamp);
    const hh = when ? `${pad2(when.getHours())}:${pad2(when.getMinutes())}` : "--:--";
    const role = m.senderRole === "admin" ? "管理者" : "応募者";
    const status = m.failed ? " [送信失敗]" : m.pending ? " [送信中]" : "";
    return `[${hh}] ${role}${status} ${m.text || ""}`;
  });

  const text = lines.join("\n");
  const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date();
  const stamp = `${ts.getFullYear()}${pad2(ts.getMonth() + 1)}${pad2(ts.getDate())}_${pad2(ts.getHours())}${pad2(ts.getMinutes())}`;
  a.href = url;
  a.download = `chat_admin_${applicationId}_${stamp}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ===== util =====
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveStatus(app) {
  if (typeof app?.status === "string" && app.status.trim()) return app.status.trim();
  return "選考中";
}

function formatWhen(createdAt) {
  const d = toDateSafe(createdAt);
  if (!d) return "";
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatConversationTime(updatedAt) {
  const d = toDateSafe(updatedAt);
  if (!d) return "";
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)}時間前`;
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toDateSafe(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  if (typeof v === "number") return new Date(v);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toSafeWage(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 500 || n > 10000) return null;
  return Math.round(n);
}

function isReasonableWage(value) {
  return toSafeWage(value) !== null;
}

function formatWage(value) {
  const n = toSafeWage(value);
  if (n === null) return "未設定";
  return `${n.toLocaleString()}円`;
}

function isAdminMobile() {
  return window.matchMedia("(max-width: 980px)").matches;
}

function setAdminView(next) {
  adminCurrentView = next;

  for (const sec of adminPanelSections) {
    sec.classList.toggle("active", sec.dataset.adminView === next);
  }

  for (const btn of adminTabButtons) {
    btn.classList.toggle("active", btn.dataset.adminTarget === next);
  }

  updateAdminMobileLayout(next);

  if (!isAdminMobile()) {
    for (const sec of adminPanelSections) sec.classList.remove("active");
  }
}

window.addEventListener("resize", () => {
  setAdminView(adminCurrentView);
});

function updateAdminMobileLayout(view) {
  if (!isAdminMobile()) {
    adminHero?.classList.remove("admin-mobile-hidden");
    adminKpiRow?.classList.remove("admin-mobile-hidden");
    return;
  }

  const showSummary = view === "jobs";
  adminHero?.classList.toggle("admin-mobile-hidden", !showSummary);
  adminKpiRow?.classList.toggle("admin-mobile-hidden", !showSummary);

  const shellTop = document.querySelector(".admin-shell");
  shellTop?.scrollIntoView({ block: "start", behavior: "smooth" });
}

function initJobTemplates() {
  if (!jobTemplateSelect) return;
  const templates = readJobTemplates();
  jobTemplateSelect.innerHTML = `<option value="">テンプレートを選択</option>${templates
    .map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.title || "無題テンプレ")}</option>`)
    .join("")}`;
}

function readJobTemplates() {
  try {
    const raw = localStorage.getItem(ADMIN_TEMPLATE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeJobTemplates(list) {
  try {
    localStorage.setItem(ADMIN_TEMPLATE_KEY, JSON.stringify(list || []));
  } catch (e) {
    console.error("save templates failed", e);
  }
}

function renderAdminConversationList() {
  if (!chatRoomsAdmin) return;
  if (!allConversations.length) {
    chatRoomsAdmin.innerHTML = `<p class="muted admin-chat-empty">会話はまだありません。</p>`;
    return;
  }

  const rows = allConversations.slice(0, 50);
  chatRoomsAdmin.innerHTML = rows
    .map((c) => {
      const app = allApplications.find((a) => a.id === c.id);
      const title = app?.jobTitle || c.jobId || c.id;
      const shop = app?.shop || "店舗未設定";
      const preview = c.lastMessage || "メッセージはまだありません。";
      const unread = Number(c.unreadForAdmin || 0);
      const updatedLabel = formatConversationTime(c.updatedAt);
      const isActive = Boolean(currentChatAppId && currentChatAppId === c.id);
      return `
        <button
          type="button"
          class="admin-chat-room${isActive ? " is-active" : ""}${unread > 0 ? " is-unread" : ""}"
          data-open-room="${escapeHtml(c.id)}"
          aria-label="${escapeHtml(title)} のチャットを開く"
        >
          <span class="admin-chat-room__header">
            <span class="admin-chat-room__title">${escapeHtml(title)}</span>
            <span class="admin-chat-room__time">${escapeHtml(updatedLabel)}</span>
          </span>
          <span class="admin-chat-room__meta">${escapeHtml(shop)}</span>
          <span class="admin-chat-room__preview">${escapeHtml(preview)}</span>
          ${unread > 0 ? `<span class="admin-chat-room__unread">${unread}件未読</span>` : ""}
        </button>
      `;
    })
    .join("");

  chatRoomsAdmin.querySelectorAll("[data-open-room]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const appId = btn.getAttribute("data-open-room");
      const app = allApplications.find((a) => a.id === appId);
      if (app) {
        await openChat(app);
      } else {
        toast("応募情報が見つかりません");
      }
    });
  });
}

function ensureNotificationPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

function notifyAdminUnreadChanges(rows) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  if (!document.hidden) {
    lastUnreadAdmin = new Map(rows.map((r) => [r.id, Number(r.unreadForAdmin || 0)]));
    return;
  }

  for (const r of rows) {
    const prev = Number(lastUnreadAdmin.get(r.id) || 0);
    const next = Number(r.unreadForAdmin || 0);
    if (next > prev) {
      new Notification("新着メッセージ", {
        body: r.lastMessage || "メッセージがあります"
      });
    }
  }

  lastUnreadAdmin = new Map(rows.map((r) => [r.id, Number(r.unreadForAdmin || 0)]));
}

function buildStatusMessage(status, title) {
  if (status === "面接予定") return `${title} の選考は面接予定に進みました。詳細は追ってご連絡します。`;
  if (status === "採用") return `${title} へのご応募ありがとうございます。採用となりました。初回勤務についてご連絡します。`;
  if (status === "不採用") return `${title} へのご応募ありがとうございました。今回は見送りとなりました。`;
  return "";
}

function isToday(ts) {
  const d = toDateSafe(ts);
  if (!d) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

function parseSimpleCsv(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "\"") {
      if (quoted && line[i + 1] === "\"") {
        cur += "\"";
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
