// js/main-app.js
import { watchAuth, logout, fetchMyProfile } from "./services/authService.js";
import { listJobs } from "./services/jobsService.js";
import { listMyApplications, applyToJob, cancelApplication } from "./services/applicationsService.js";
import { listFavorites, setFavorite } from "./services/favoritesService.js";
import { renderJobs } from "./ui/renderJobs.js";
import { renderApplications } from "./ui/renderApplications.js";
import { toast } from "./ui/toast.js";
import { openModal, closeModal, wireModalClose } from "./ui/modal.js";

// chat
import { ensureConversation, watchMessages, sendMessage, markRead } from "./services/chatService.js";
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
const showAllBtn = document.getElementById("showAllBtn");
const showFavBtn = document.getElementById("showFavBtn");

const logoutBtn = document.getElementById("logoutBtn");
const adminLink = document.getElementById("adminLink");

// modal
const applyModal = document.getElementById("applyModal");
const applyText = document.getElementById("applyText");
const applyCancel = document.getElementById("applyCancel");
const applyOk = document.getElementById("applyOk");
wireModalClose(applyModal);

// chat UI
const chatMeta = document.getElementById("chatMeta");
const chatWrap = document.getElementById("chatWrap");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");

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
const mobileMenu = document.getElementById("mobileMenu");
const menuBackdrop = document.getElementById("menuBackdrop");
const viewSections = Array.from(document.querySelectorAll("[data-view]"));

let currentView = "jobs";

function isMobile() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function setView(next) {
  currentView = next;

  // mobile：active だけ表示
  if (isMobile()) {
    for (const sec of viewSections) {
      sec.classList.toggle("active", sec.dataset.view === next);
    }
  } else {
    // desktop：全部表示（active制御を外す）
    for (const sec of viewSections) sec.classList.remove("active");
  }
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

mobileMenu?.querySelectorAll("button[data-target]")?.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target;
    setView(target);
    closeMenu();
  });
});

// 画面回転/リサイズ対策
window.addEventListener("resize", () => {
  setView(currentView);
  if (!isMobile()) closeMenu();
});

// ===== app state =====
let uid = null;
let profile = null;

let allJobs = [];
let favorites = new Set();
let showingFav = false;
let pendingApplyJob = null;

// chat state
let currentChatAppId = null;
let unSubChat = null;

logoutBtn?.addEventListener("click", async () => {
  await logout();
  location.href = "./index.html";
});

showAllBtn?.addEventListener("click", () => {
  showingFav = false;
  paint();
});

showFavBtn?.addEventListener("click", () => {
  showingFav = true;
  paint();
});

[qEl, sortEl, areaFilterEl].forEach((el) => el?.addEventListener("input", paint));
sortEl?.addEventListener("change", async () => {
  await refreshJobs();
  paint();
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

// chat send
chatSend?.addEventListener("click", async () => {
  const text = (chatInput?.value || "").trim();
  if (!text || !currentChatAppId || !uid) return;

  try {
    await sendMessage({
      applicationId: currentChatAppId,
      senderUid: uid,
      senderRole: "user",
      text
    });
    chatInput.value = "";
  } catch (e) {
    console.error(e);
    toast("送信に失敗しました");
  }
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

    // スマホなら保存後もプロフィール画面を維持
    if (isMobile()) setView("profile");
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

  // welcome
  welcomeEl.textContent = profile?.name ? `ようこそ、${profile.name}さん` : "";

  // adminリンクは admin の時だけ表示
  if (adminLink) adminLink.style.display = profile?.role === "admin" ? "" : "none";

  // profile form reflect
  profileSnapshot = profile ? { ...profile } : null;
  if (profileName) profileName.value = profile?.name || "";
  if (profileEmail) profileEmail.value = user?.email || "";
  if (profilePhone) profilePhone.value = profile?.phone || "";
  if (profileBio) profileBio.value = profile?.bio || "";

  await Promise.all([refreshJobs(), refreshFavorites(), refreshApplications()]);
  paint();

  // スマホは初期「求人一覧」だけ表示
  setView("jobs");
});

async function refreshJobs() {
  jobsMsg.textContent = "読み込み中...";
  try {
    allJobs = await listJobs(sortEl?.value || "new");
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
    appsMsg.textContent = "";

    renderApplications(appsWrap, apps, {
      onCancel: async (jobId) => {
        await cancelApplication({ uid, jobId });
        toast("応募を取り消しました");
        await refreshApplications();
        paint();
        if (isMobile()) setView("applications");
      },
      onOpenChat: async (app) => {
        // 応募IDを conversationId として使う想定（あなたの既存仕様）
        currentChatAppId = app.id;

        await ensureConversation({
          applicationId: app.id,
          jobId: app.jobId,
          applicantUid: uid
        });

        if (chatMeta) chatMeta.textContent = `${app.jobTitle || ""}（${app.shop || ""}）のチャット`;

        if (unSubChat) unSubChat();
        unSubChat = watchMessages(app.id, (msgs) => {
          if (!chatWrap) return;
          renderChat({ wrapEl: chatWrap, meUid: uid, messages: msgs });
        });

        await markRead({ applicationId: app.id, viewerRole: "user" });

        // ★スマホなら自動で「チャット」画面へ移動（ここが一番大事）
        if (isMobile()) setView("chat");
      }
    });
  } catch (e) {
    console.error(e);
    appsMsg.textContent = "応募履歴の取得に失敗しました。";
  }
}

function filteredJobs() {
  const q = (qEl?.value || "").trim().toLowerCase();
  const area = areaFilterEl?.value || "";

  let list = allJobs.slice();

  if (area) list = list.filter((j) => String(j.area || "") === area);

  if (q) {
    list = list.filter((j) => {
      const hay = [
        j.title, j.shop, j.area, j.shift,
        ...(j.tags || []),
        j.description
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  if (showingFav) list = list.filter((j) => favorites.has(j.id));

  return list;
}

function paint() {
  const list = filteredJobs();

  renderJobs({
    wrapEl: jobsWrap,
    jobs: list,
    favoritesSet: favorites,
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
    }
  });

  if (!list.length) {
    jobsMsg.textContent = showingFav ? "お気に入りに求人がありません。" : "条件に一致する求人がありません。";
  } else {
    jobsMsg.textContent = "";
  }
}
