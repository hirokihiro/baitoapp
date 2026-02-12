// js/main-app.js
import { watchAuth, logout, fetchMyProfile } from "./services/authService.js";
import { listJobs } from "./services/jobsService.js";
import {
  listMyApplications,
  applyToJob,
  cancelApplication,
  selectInterviewSlot
} from "./services/applicationsService.js";
import { listFavorites, setFavorite } from "./services/favoritesService.js";
import { renderJobs } from "./ui/renderJobs.js";
import { renderApplications } from "./ui/renderApplications.js";
import { toast } from "./ui/toast.js";
import { openModal, closeModal, wireModalClose } from "./ui/modal.js";

// chat
import {
  ensureConversation,
  watchMessages,
  sendMessage,
  markRead,
  watchConversationMeta,
  setTypingState,
  watchConversationsForUser
} from "./services/chatService.js";
import { renderChat } from "./ui/renderChat.js";

// profile
import { updateUserProfile } from "./services/profileService.js";

const welcomeEl = document.getElementById("welcome");
const jobsMsg = document.getElementById("jobsMsg");
const jobsWrap = document.getElementById("jobsWrap");
const appsMsg = document.getElementById("appsMsg");
const appsWrap = document.getElementById("appsWrap");

const qEl = document.getElementById("q");
const sortEl = document.getElementById("sort");
const areaFilterEl = document.getElementById("areaFilter");
const minWageEl = document.getElementById("minWage");
const maxWageEl = document.getElementById("maxWage");
const showAllBtn = document.getElementById("showAllBtn");
const showFavBtn = document.getElementById("showFavBtn");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const jobsStats = document.getElementById("jobsStats");

const logoutBtn = document.getElementById("logoutBtn");
const adminLink = document.getElementById("adminLink");

// modal
const applyModal = document.getElementById("applyModal");
const applyText = document.getElementById("applyText");
const applyCancel = document.getElementById("applyCancel");
const applyOk = document.getElementById("applyOk");
wireModalClose(applyModal);

// job detail modal
const jobDetailModal = document.getElementById("jobDetailModal");
const jobDetailTitle = document.getElementById("jobDetailTitle");
const jobDetailShop = document.getElementById("jobDetailShop");
const jobDetailBadges = document.getElementById("jobDetailBadges");
const jobDetailWage = document.getElementById("jobDetailWage");
const jobDetailSubmeta = document.getElementById("jobDetailSubmeta");
const jobDetailArea = document.getElementById("jobDetailArea");
const jobDetailShift = document.getElementById("jobDetailShift");
const jobDetailCount = document.getElementById("jobDetailCount");
const jobDetailSim = document.getElementById("jobDetailSim");
const jobDetailDesc = document.getElementById("jobDetailDesc");
const jobDetailApply = document.getElementById("jobDetailApply");
const jobDetailFav = document.getElementById("jobDetailFav");
wireModalClose(jobDetailModal);

// chat UI
const chatMeta = document.getElementById("chatMeta");
const chatWrap = document.getElementById("chatWrap");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
const chatRooms = document.getElementById("chatRooms");
const chatTemplate = document.getElementById("chatTemplate");
const chatExportBtn = document.getElementById("chatExportBtn");
const chatClearDraftBtn = document.getElementById("chatClearDraftBtn");

// profile UI
const profileMsg = document.getElementById("profileMsg");
const profileForm = document.getElementById("profileForm");
const profileReset = document.getElementById("profileReset");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profilePhone = document.getElementById("profilePhone");
const profileBio = document.getElementById("profileBio");
let profileSnapshot = null;

// ===== mobile nav elements =====
const menuBtn = document.getElementById("menuBtn");
const backBtn = document.getElementById("backBtn");
const mobileMenu = document.getElementById("mobileMenu");
const menuBackdrop = document.getElementById("menuBackdrop");
const viewSections = Array.from(document.querySelectorAll("[data-view]"));
const viewNavButtons = Array.from(document.querySelectorAll("button[data-target]"));

let currentView = "jobs";
let viewHistory = ["jobs"];

function isMobile() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function setView(next, options = {}) {
  const { push = true, replace = false } = options;
  currentView = next;

  if (isMobile()) {
    for (const sec of viewSections) {
      sec.classList.toggle("active", sec.dataset.view === next);
    }
  } else {
    for (const sec of viewSections) sec.classList.remove("active");
  }

  if (isMobile()) {
    if (replace) {
      viewHistory[viewHistory.length - 1] = next;
    } else if (push) {
      if (viewHistory[viewHistory.length - 1] !== next) viewHistory.push(next);
    }
  }

  for (const btn of viewNavButtons) {
    btn.classList.toggle("active", btn.dataset.target === next);
  }

  updateBackBtn();
}

function openMenu() {
  if (!mobileMenu || !menuBackdrop || !menuBtn) return;
  mobileMenu.classList.remove("hidden");
  menuBackdrop.classList.remove("hidden");
  menuBtn.setAttribute("aria-expanded", "true");
}

function closeMenu() {
  if (!mobileMenu || !menuBackdrop || !menuBtn) return;
  mobileMenu.classList.add("hidden");
  menuBackdrop.classList.add("hidden");
  menuBtn.setAttribute("aria-expanded", "false");
}

menuBtn?.addEventListener("click", () => {
  if (mobileMenu?.classList.contains("hidden")) openMenu();
  else closeMenu();
});

menuBackdrop?.addEventListener("click", closeMenu);

viewNavButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target;
    setView(target, { push: true });
    if (mobileMenu?.contains(btn)) closeMenu();
  });
});

window.addEventListener("resize", () => {
  setView(currentView, { push: false, replace: true });
  if (!isMobile()) closeMenu();
});

function updateBackBtn() {
  if (!backBtn) return;
  const show = isMobile() && viewHistory.length > 1;
  backBtn.style.display = show ? "inline-flex" : "none";
}

backBtn?.addEventListener("click", () => {
  if (!isMobile()) return;
  if (viewHistory.length <= 1) return;
  viewHistory.pop();
  const prev = viewHistory[viewHistory.length - 1] || "jobs";
  setView(prev, { push: false, replace: true });
});

// ===== app state =====
let uid = null;
let profile = null;

let allJobs = [];
let favorites = new Set();
let showingFav = false;
let pendingApplyJob = null;
let detailJob = null;
let appliedJobs = new Set();
let myApplications = [];
let queryDebounceTimer = null;
const APP_STATE_KEY = "baitoapp.user.filters.v1";

// chat state
let currentChatAppId = null;
let unSubChat = null;
let unSubConvMeta = null;
let unSubConversations = null;
let typingTimer = null;
let typingRemote = { on: false, role: null };
let myConversations = [];
let lastUnreadUser = new Map();

// ★ 追加：送信中/失敗のローカルメッセージ
let remoteMessages = [];
let localPending = []; // [{ id, senderUid, senderRole, text, createdAt, pending, failed }]

function mergeMessages(remote, pending) {
  // pendingは最後尾に付ける（送信中の吹き出しを確実に出す）
  return [...remote, ...pending];
}

function repaintChat() {
  if (!chatWrap || !uid) return;
  renderChat({
    wrapEl: chatWrap,
    meUid: uid,
    meRole: "user",
    messages: mergeMessages(remoteMessages, localPending),
    typing: typingRemote,
    onRetryFailed: retryFailedMessage
  });
}

logoutBtn?.addEventListener("click", async () => {
  await logout();
  location.href = "./index.html";
});

showAllBtn?.addEventListener("click", () => {
  showingFav = false;
  saveUiState();
  paint();
});

showFavBtn?.addEventListener("click", () => {
  showingFav = true;
  saveUiState();
  paint();
});

/* ✅ ここが重要修正
   inputはテキスト入力(q)だけ
   select(sort/area)はchangeで反映
 */
qEl?.addEventListener("input", () => {
  clearTimeout(queryDebounceTimer);
  queryDebounceTimer = setTimeout(() => {
    saveUiState();
    paint();
  }, 120);
});

areaFilterEl?.addEventListener("change", () => {
  saveUiState();
  paint();
});

sortEl?.addEventListener("change", async () => {
  saveUiState();
  await refreshJobs();
  paint();
});

minWageEl?.addEventListener("input", () => {
  clearTimeout(queryDebounceTimer);
  queryDebounceTimer = setTimeout(() => {
    saveUiState();
    paint();
  }, 120);
});

maxWageEl?.addEventListener("input", () => {
  clearTimeout(queryDebounceTimer);
  queryDebounceTimer = setTimeout(() => {
    saveUiState();
    paint();
  }, 120);
});

resetFiltersBtn?.addEventListener("click", async () => {
  if (qEl) qEl.value = "";
  if (areaFilterEl) areaFilterEl.value = "";
  if (minWageEl) minWageEl.value = "";
  if (maxWageEl) maxWageEl.value = "";
  if (sortEl && sortEl.value !== "new") {
    sortEl.value = "new";
    await refreshJobs();
  }
  showingFav = false;
  saveUiState();
  paint();
  toast("検索条件をリセットしました");
});

applyCancel?.addEventListener("click", () => closeModal(applyModal));
applyOk?.addEventListener("click", async () => {
  if (!pendingApplyJob || !uid) return;
  try {
    await applyToJob({
      uid,
      jobId: pendingApplyJob.id,
      jobTitle: pendingApplyJob.title,
      shop: pendingApplyJob.shop
    });
    toast("応募しました！");
    closeModal(applyModal);
    pendingApplyJob = null;

    await refreshApplications();
    paint();
  } catch (e) {
    console.error(e);
    toast("応募に失敗しました");
  }
});

jobDetailApply?.addEventListener("click", () => {
  if (!detailJob) return;
  pendingApplyJob = detailJob;
  applyText.textContent = `${detailJob.title}（${detailJob.shop}）に応募しますか？`;
  closeModal(jobDetailModal);
  openModal(applyModal);
});

jobDetailFav?.addEventListener("click", async () => {
  if (!detailJob || !uid) return;
  const next = !favorites.has(detailJob.id);
  await setFavorite(uid, detailJob.id, next);
  if (next) favorites.add(detailJob.id);
  else favorites.delete(detailJob.id);
  paint();
  openJobDetail(detailJob, { keepOpen: true });
});

// ===== チャット送信（送信中…/失敗/Enter送信） =====
async function doSendChat(textOverride = null) {
  const text = (typeof textOverride === "string" ? textOverride : (chatInput?.value || "")).trim();
  if (!text || !currentChatAppId || !uid) return;

  const tempId = `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const tempMsg = {
    id: tempId,
    senderUid: uid,
    senderRole: "user",
    text,
    createdAt: new Date(),
    pending: true,
    failed: false
  };

  // 先に表示（送信中…）
  localPending.push(tempMsg);
  if (chatInput && textOverride == null) chatInput.value = "";
  persistDraft("");
  await updateTyping(false);
  repaintChat();

  try {
    await sendMessage({
      applicationId: currentChatAppId,
      senderUid: uid,
      senderRole: "user",
      text
    });

    // 成功：pendingから除去（Firestore側のwatchで本物が来る）
    localPending = localPending.filter((m) => m.id !== tempId);
    repaintChat();
  } catch (e) {
    console.error(e);
    // 失敗：failed表示にする
    localPending = localPending.map((m) =>
      m.id === tempId ? { ...m, pending: false, failed: true } : m
    );
    repaintChat();
    toast("送信に失敗しました");
  }
}

chatSend?.addEventListener("click", doSendChat);

// Enterで送信（日本語IME中は送らない）
chatInput?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  if (e.isComposing) return; // IME変換中
  e.preventDefault();
  doSendChat();
});

chatInput?.addEventListener("input", () => {
  const text = chatInput.value || "";
  persistDraft(text);
  handleTypingInput(text);
});

chatTemplate?.addEventListener("change", () => {
  const tpl = chatTemplate.value;
  if (!tpl || !chatInput) return;
  const prev = (chatInput.value || "").trim();
  chatInput.value = prev ? `${prev}\n${tpl}` : tpl;
  persistDraft(chatInput.value);
  handleTypingInput(chatInput.value);
  chatInput.focus();
  chatTemplate.value = "";
});

chatClearDraftBtn?.addEventListener("click", async () => {
  if (!chatInput) return;
  chatInput.value = "";
  persistDraft("");
  await updateTyping(false);
  toast("下書きをクリアしました");
});

chatExportBtn?.addEventListener("click", () => {
  if (!currentChatAppId) {
    toast("先にチャットを開いてください");
    return;
  }
  exportChatLog({
    applicationId: currentChatAppId,
    messages: mergeMessages(remoteMessages, localPending)
  });
});

// profile save
profileForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!uid) return;

  const name = (profileName?.value || "").trim();
  const phone = (profilePhone?.value || "").trim();
  const bio = (profileBio?.value || "").trim();

  if (!name) {
    if (profileMsg) profileMsg.textContent = "名前は必須です。";
    return;
  }

  if (profileMsg) profileMsg.textContent = "保存中...";

  try {
    await updateUserProfile(uid, { name, phone, bio });
    welcomeEl.textContent = `ようこそ、${name}さん`;

    if (profileMsg) profileMsg.textContent = "保存しました。";
    toast("プロフィールを保存しました");
    profileSnapshot = { ...(profileSnapshot || {}), name, phone, bio };

    if (isMobile()) setView("profile", { push: true });
  } catch (err) {
    console.error(err);
    if (profileMsg) profileMsg.textContent = "保存に失敗しました。";
    toast("保存に失敗しました");
  }
});

profileReset?.addEventListener("click", () => {
  if (!profileSnapshot) return;
  if (profileMsg) profileMsg.textContent = "";
  if (profileName) profileName.value = profileSnapshot.name || "";
  if (profilePhone) profilePhone.value = profileSnapshot.phone || "";
  if (profileBio) profileBio.value = profileSnapshot.bio || "";
});

watchAuth(async (user) => {
  if (!user) {
    location.href = "./index.html";
    return;
  }

  uid = user.uid;
  profile = await fetchMyProfile();
  ensureNotificationPermission();

  welcomeEl.textContent = profile?.name ? `ようこそ、${profile.name}さん` : "";

  if (adminLink) adminLink.style.display = profile?.role === "admin" ? "" : "none";

  profileSnapshot = profile ? { ...profile } : null;
  if (profileName) profileName.value = profile?.name || "";
  if (profileEmail) profileEmail.value = user?.email || "";
  if (profilePhone) profilePhone.value = profile?.phone || "";
  if (profileBio) profileBio.value = profile?.bio || "";

  restoreUiState();
  await Promise.all([refreshJobs(), refreshFavorites(), refreshApplications()]);
  paint();

  if (unSubConversations) unSubConversations();
  unSubConversations = watchConversationsForUser(uid, (rows) => {
    myConversations = rows || [];
    renderUserConversationList();
    notifyUserUnreadChanges(rows || []);
  });

  viewHistory = ["jobs"];
  setView("jobs", { push: false, replace: true });
});

async function refreshJobs() {
  jobsMsg.textContent = "読み込み中...";
  try {
    const jobs = await listJobs(sortEl?.value || "new");
    allJobs = jobs.map(indexJobForSearch);
    jobsMsg.textContent = "";
  } catch (e) {
    console.error(e);
    jobsMsg.textContent = "求人の取得に失敗しました。";
  }
}

async function refreshFavorites() {
  try {
    favorites = await listFavorites(uid);
  } catch (e) {
    console.error(e);
    favorites = new Set();
  }
}

async function refreshApplications() {
  appsMsg.textContent = "読み込み中...";
  try {
    const apps = await listMyApplications(uid);
    myApplications = apps;
    appsMsg.textContent = "";
    appliedJobs = new Set(apps.map((a) => a.jobId).filter(Boolean));

    renderApplications(appsWrap, apps, {
      onCancel: async (jobId) => {
        await cancelApplication({ uid, jobId });
        toast("応募を取り消しました");
        await refreshApplications();
        paint();
        if (isMobile()) setView("applications", { push: true });
      },
      onOpenChat: async (app) => {
        const derivedJobId = app.jobId || deriveJobId(app.id, uid);
        const applicationId = app.id || (derivedJobId ? `${uid}_${derivedJobId}` : null);

        if (!applicationId || !derivedJobId) {
          toast("チャットを開始できませんでした（応募データ不足）");
          return;
        }

        if (currentChatAppId && currentChatAppId !== applicationId) {
          await updateTyping(false);
        }
        currentChatAppId = applicationId;
        if (isMobile()) setView("chat", { push: true });
        if (chatMeta) chatMeta.textContent = "チャットを読み込み中...";
        if (chatWrap) chatWrap.innerHTML = "";

        try {
          await ensureConversation({
            applicationId,
            jobId: derivedJobId,
            applicantUid: uid
          });

          if (chatMeta) chatMeta.textContent = `${app.jobTitle || ""}（${app.shop || ""}）のチャット`;

          // pending表示をリセット（別応募のチャットに切り替えたので）
          localPending = [];
          remoteMessages = [];
          typingRemote = { on: false, role: null };
          loadDraft(applicationId);
          repaintChat();

          if (unSubChat) unSubChat();
          unSubChat = watchMessages(applicationId, (msgs) => {
            remoteMessages = Array.isArray(msgs) ? msgs : [];
            repaintChat();
          });

          if (unSubConvMeta) unSubConvMeta();
          unSubConvMeta = watchConversationMeta(applicationId, (meta) => {
            const typingAt = Number(meta?.typingAdminAt || 0);
            const isTyping = typingAt > 0 && (Date.now() - typingAt) < 3500;
            typingRemote = { on: isTyping, role: "admin" };
            repaintChat();
          });

          await markRead({ applicationId, viewerRole: "user" });
        } catch (err) {
          console.error(err);
          if (chatMeta) chatMeta.textContent = "チャットの読み込みに失敗しました。";
          toast("チャットの読み込みに失敗しました");
        }
      },
      onSelectInterview: async (applicationId, slot) => {
        await handleSelectInterview(applicationId, slot);
      }
    });
  } catch (e) {
    console.error(e);
    appsMsg.textContent = "応募履歴の取得に失敗しました。";
  }
}

function filteredJobs() {
  const q = (qEl?.value || "").trim().toLowerCase();
  const area = (areaFilterEl?.value || "").trim();
  const minWage = toNumberOrNull(minWageEl?.value);
  const maxWage = toNumberOrNull(maxWageEl?.value);

  let list = allJobs.slice();

  if (area) list = list.filter((j) => String(j.area || "").trim() === area);

  if (q) {
    list = list.filter((j) => String(j._searchText || "").includes(q));
  }

  if (minWage !== null) {
    list = list.filter((j) => Number(j.wage || 0) >= minWage);
  }

  if (maxWage !== null) {
    list = list.filter((j) => Number(j.wage || 0) <= maxWage);
  }

  if (showingFav) list = list.filter((j) => favorites.has(j.id));
  return list;
}

function indexJobForSearch(job) {
  return {
    ...job,
    _searchText: [
      job?.title,
      job?.shop,
      job?.area,
      job?.shift,
      ...(Array.isArray(job?.tags) ? job.tags : []),
      job?.description
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
  };
}

function paint() {
  const list = filteredJobs();
  const total = allJobs.length;

  renderJobs({
    wrapEl: jobsWrap,
    jobs: list,
    favoritesSet: favorites,
    appliedSet: appliedJobs,
    onToggleFav: async (jobId, next) => {
      await setFavorite(uid, jobId, next);
      if (next) favorites.add(jobId);
      else favorites.delete(jobId);
      paint();
    },
    onRequestApply: (job) => {
      pendingApplyJob = job;
      applyText.textContent = `${job.title}（${job.shop}）に応募しますか？`;
      openModal(applyModal);
    },
    onOpenDetail: (job) => openJobDetail(job)
  });

  if (!list.length) {
    jobsMsg.textContent = showingFav ? "お気に入りに求人がありません。" : "条件に一致する求人がありません。";
  } else {
    jobsMsg.textContent = "";
  }

  if (jobsStats) {
    jobsStats.textContent = total
      ? `${list.length} / ${total} 件を表示`
      : "0 件";
  }

  if (showAllBtn) showAllBtn.classList.toggle("primary", !showingFav);
  if (showFavBtn) showFavBtn.classList.toggle("primary", showingFav);
}

function openJobDetail(job, options = {}) {
  if (!jobDetailModal) return;
  detailJob = job;

  const count = Number(job.applicantsCount ?? job.appCount ?? 0);
  const tags = Array.isArray(job.tags) ? job.tags : [];
  const wage = Number(job.wage || 0);
  const wageText = Number.isFinite(wage) && wage > 0 ? `¥${wage.toLocaleString()}/時` : "時給 未設定";
  const simText = Number.isFinite(wage) && wage > 0 ? `目安：週2×4hで月約¥${(wage * 32).toLocaleString()}` : "";

  if (jobDetailTitle) jobDetailTitle.textContent = job.title || "求人詳細";
  if (jobDetailShop) jobDetailShop.textContent = job.shop ? `店舗：${job.shop}` : "";
  if (jobDetailWage) jobDetailWage.textContent = wageText;
  if (jobDetailArea) jobDetailArea.textContent = job.area ? `エリア：${job.area}` : "";
  if (jobDetailShift) jobDetailShift.textContent = job.shift ? `シフト：${job.shift}` : "";
  if (jobDetailCount) {
    jobDetailCount.textContent = count ? `応募者数：${count}人` : "";
  }
  if (jobDetailSim) jobDetailSim.textContent = simText;
  if (jobDetailDesc) jobDetailDesc.textContent = job.description || "";

  if (jobDetailBadges) {
    const badgeHtml = [
      count >= 5 ? `<span class="badge badge-hot">人気</span>` : "",
      isRecent(job.createdAt) ? `<span class="badge badge-urgent">急募</span>` : "",
      ...tags.slice(0, 6).map((t) => `<span class="badge badge-tag">${escapeHtml(t)}</span>`)
    ].filter(Boolean).join("");
    jobDetailBadges.innerHTML = badgeHtml;
  }

  if (jobDetailSubmeta) {
    const parts = [];
    if (tags.some((t) => /交通費/.test(t))) parts.push("交通費あり");
    if (tags.some((t) => /(シフト|週\d|自由|柔軟)/.test(t)) || /週\d/.test(job.shift || "")) parts.push("シフト相談OK");
    jobDetailSubmeta.textContent = parts.join(" / ");
    jobDetailSubmeta.style.display = parts.length ? "inline-flex" : "none";
  }

  if (jobDetailApply) {
    const already = appliedJobs.has(job.id);
    jobDetailApply.disabled = already;
    jobDetailApply.textContent = already ? "応募済み" : "応募する";
  }

  if (jobDetailFav) {
    const fav = favorites.has(job.id);
    jobDetailFav.textContent = `${fav ? "♥" : "♡"} お気に入り`;
  }

  if (!options.keepOpen) openModal(jobDetailModal);
}

function toDateSafe(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  if (typeof v === "number") return new Date(v);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isRecent(createdAt, days = 3) {
  const d = toDateSafe(createdAt);
  if (!d) return false;
  const diff = Date.now() - d.getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function deriveJobId(applicationId, uidValue) {
  if (!applicationId || !uidValue) return null;
  const prefix = `${uidValue}_`;
  if (!applicationId.startsWith(prefix)) return null;
  const jobId = applicationId.slice(prefix.length);
  return jobId || null;
}

function retryFailedMessage(msg) {
  if (!msg?.failed || !msg?.text) return;
  localPending = localPending.filter((m) => m.id !== msg.id);
  repaintChat();
  doSendChat(msg.text);
}

async function handleSelectInterview(applicationId, slot) {
  if (!applicationId || !slot) return;
  try {
    await selectInterviewSlot(applicationId, slot);
    await refreshApplications();
    toast("面接候補を選択しました");
  } catch (e) {
    console.error(e);
    toast("面接候補の選択に失敗しました");
  }
}

function chatDraftKey(applicationId) {
  if (!uid || !applicationId) return "";
  return `baitoapp.chatdraft.user.${uid}.${applicationId}`;
}

function persistDraft(text) {
  if (!currentChatAppId) return;
  const key = chatDraftKey(currentChatAppId);
  if (!key) return;
  try {
    localStorage.setItem(key, String(text || ""));
  } catch (e) {
    console.error("Failed to persist chat draft", e);
  }
}

function loadDraft(applicationId) {
  if (!chatInput) return;
  const key = chatDraftKey(applicationId);
  if (!key) return;
  try {
    const saved = localStorage.getItem(key) || "";
    chatInput.value = saved;
  } catch (e) {
    console.error("Failed to load chat draft", e);
  }
}

function handleTypingInput(text) {
  if (!currentChatAppId) return;
  const hasText = String(text || "").trim().length > 0;
  if (!hasText) {
    updateTyping(false);
    return;
  }

  updateTyping(true);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    updateTyping(false);
  }, 1800);
}

async function updateTyping(isTyping) {
  if (!currentChatAppId) return;
  try {
    await setTypingState({ applicationId: currentChatAppId, role: "user", isTyping });
  } catch (e) {
    console.error("Failed to update typing state", e);
  }
}

function exportChatLog({ applicationId, messages }) {
  const lines = (messages || []).map((m) => {
    const when = toDateSafe(m.createdAt || m.created || m.ts || m.timestamp);
    const hh = when ? `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}` : "--:--";
    const role = m.senderRole === "admin" ? "管理者" : "自分";
    const status = m.failed ? " [送信失敗]" : m.pending ? " [送信中]" : "";
    return `[${hh}] ${role}${status} ${m.text || ""}`;
  });

  const text = lines.join("\n");
  const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date();
  const stamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, "0")}${String(ts.getDate()).padStart(2, "0")}_${String(ts.getHours()).padStart(2, "0")}${String(ts.getMinutes()).padStart(2, "0")}`;
  a.href = url;
  a.download = `chat_${applicationId}_${stamp}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderUserConversationList() {
  if (!chatRooms) return;
  if (!myConversations.length) {
    chatRooms.innerHTML = `<p class="muted">会話はまだありません。</p>`;
    return;
  }
  chatRooms.innerHTML = myConversations
    .slice(0, 8)
    .map((c) => {
      const app = myApplications.find((a) => a.id === c.id);
      const title = app?.jobTitle || c.jobId || c.id;
      const unread = Number(c.unreadForUser || 0);
      return `
        <button type="button" class="btn" data-open-room="${escapeHtml(c.id)}" style="width:100%; text-align:left; margin-bottom:6px;">
          ${escapeHtml(title)}
          ${unread > 0 ? `<span class="status-pill">${unread}件未読</span>` : ""}
        </button>
      `;
    })
    .join("");

  chatRooms.querySelectorAll("[data-open-room]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const appId = btn.getAttribute("data-open-room");
      const app = myApplications.find((a) => a.id === appId);
      if (!app) return;
      currentChatAppId = app.id;
      if (isMobile()) setView("chat", { push: true });
      if (chatMeta) chatMeta.textContent = `${app.jobTitle || ""}（${app.shop || ""}）のチャット`;
      if (chatWrap) chatWrap.innerHTML = "";

      localPending = [];
      remoteMessages = [];
      typingRemote = { on: false, role: null };
      loadDraft(app.id);
      repaintChat();

      if (unSubChat) unSubChat();
      unSubChat = watchMessages(app.id, (msgs) => {
        remoteMessages = Array.isArray(msgs) ? msgs : [];
        repaintChat();
      });
      if (unSubConvMeta) unSubConvMeta();
      unSubConvMeta = watchConversationMeta(app.id, (meta) => {
        const typingAt = Number(meta?.typingAdminAt || 0);
        const isTyping = typingAt > 0 && (Date.now() - typingAt) < 3500;
        typingRemote = { on: isTyping, role: "admin" };
        repaintChat();
      });
      await markRead({ applicationId: app.id, viewerRole: "user" });
    });
  });
}

function ensureNotificationPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

function notifyUserUnreadChanges(rows) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  if (!document.hidden) {
    lastUnreadUser = new Map(rows.map((r) => [r.id, Number(r.unreadForUser || 0)]));
    return;
  }
  for (const r of rows) {
    const prev = Number(lastUnreadUser.get(r.id) || 0);
    const next = Number(r.unreadForUser || 0);
    if (next > prev) {
      new Notification("新着メッセージ", {
        body: r.lastMessage || "メッセージがあります"
      });
    }
  }
  lastUnreadUser = new Map(rows.map((r) => [r.id, Number(r.unreadForUser || 0)]));
}

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function saveUiState() {
  try {
    localStorage.setItem(
      APP_STATE_KEY,
      JSON.stringify({
        q: qEl?.value || "",
        area: areaFilterEl?.value || "",
        sort: sortEl?.value || "new",
        minWage: minWageEl?.value || "",
        maxWage: maxWageEl?.value || "",
        showingFav
      })
    );
  } catch (e) {
    console.error("Failed to save UI state", e);
  }
}

function restoreUiState() {
  try {
    const raw = localStorage.getItem(APP_STATE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);

    if (qEl && typeof state.q === "string") qEl.value = state.q;
    if (areaFilterEl && typeof state.area === "string") areaFilterEl.value = state.area;
    if (minWageEl && typeof state.minWage === "string") minWageEl.value = state.minWage;
    if (maxWageEl && typeof state.maxWage === "string") maxWageEl.value = state.maxWage;

    if (sortEl && typeof state.sort === "string") {
      const hasOption = Array.from(sortEl.options).some((o) => o.value === state.sort);
      sortEl.value = hasOption ? state.sort : "new";
    }

    showingFav = !!state.showingFav;
  } catch (e) {
    console.error("Failed to restore UI state", e);
  }
}
