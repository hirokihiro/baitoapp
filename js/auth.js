// =============================
// Storage keys
// =============================
const KEY_USERS = "baitoapp_users";
const KEY_SESSION = "baitoapp_session";
const KEY_JOBS = "baitoapp_jobs";
const KEY_APPS = "baitoapp_applications";

// =============================
// Utility
// =============================
function readJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
}
function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function uid(prefix="id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function nowISO() {
  return new Date().toISOString();
}

// =============================
// Auth
// =============================
function getUsers() {
  return readJSON(KEY_USERS, []);
}
function setUsers(users) {
  writeJSON(KEY_USERS, users);
}
function getSession() {
  return readJSON(KEY_SESSION, null);
}
function setSession(session) {
  writeJSON(KEY_SESSION, session);
}
function logout() {
  localStorage.removeItem(KEY_SESSION);
}

// ※デモ用：本来はハッシュ化する
function registerUser({ name, email, password }) {
  const users = getUsers();
  const exists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
  if (exists) return { ok:false, message:"このメールアドレスは既に登録されています。" };

  const user = {
    id: uid("user"),
    name,
    email,
    password,
    createdAt: nowISO()
  };
  users.push(user);
  setUsers(users);
  return { ok:true, message:"登録が完了しました。ログインしてください。" };
}

function loginUser({ email, password }) {
  const users = getUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return { ok:false, message:"ユーザーが見つかりません。" };
  if (user.password !== password) return { ok:false, message:"パスワードが違います。" };

  setSession({ userId: user.id, loggedInAt: nowISO() });
  return { ok:true, message:"ログイン成功" };
}

function currentUser() {
  const sess = getSession();
  if (!sess) return null;
  const users = getUsers();
  return users.find(u => u.id === sess.userId) || null;
}

// =============================
// Jobs & Applications
// =============================
function getJobs() {
  return readJSON(KEY_JOBS, []);
}
function setJobs(jobs) {
  writeJSON(KEY_JOBS, jobs);
}
function getApplications() {
  return readJSON(KEY_APPS, []);
}
function setApplications(apps) {
  writeJSON(KEY_APPS, apps);
}

function seedJobs(force=false) {
  const existing = getJobs();
  if (existing.length > 0 && !force) return;

  const demo = [
    {
      id: uid("job"),
      title: "コンビニスタッフ（夕方）",
      shop: "ファミマ風 〇〇店",
      area: "駅前",
      wage: 1200,
      shift: "週2〜 / 17:00-22:00",
      tags: ["未経験OK", "駅近", "高校生可"],
      description: "レジ、品出し、清掃など。先輩が丁寧に教えます。",
      createdAt: nowISO()
    },
    {
      id: uid("job"),
      title: "カフェ店員（ホール/キッチン補助）",
      shop: "Cafe Aoba",
      area: "大学周辺",
      wage: 1150,
      shift: "週3〜 / 10:00-18:00",
      tags: ["まかない", "シフト柔軟"],
      description: "接客、簡単なドリンク作り、洗い物など。",
      createdAt: nowISO()
    },
    {
      id: uid("job"),
      title: "倉庫内軽作業（ピッキング）",
      shop: "物流センターB",
      area: "郊外",
      wage: 1300,
      shift: "週1〜 / 9:00-17:00",
      tags: ["単発OK", "服装自由", "高時給"],
      description: "商品の仕分け・ピッキング。黙々作業が好きな人向け。",
      createdAt: nowISO()
    }
  ];
  setJobs(demo);
}

function applyToJob({ jobId, userId, reason }) {
  const apps = getApplications();
  const already = apps.some(a => a.jobId === jobId && a.userId === userId);
  if (already) return { ok:false, message:"この求人には既に応募済みです。" };

  apps.push({
    id: uid("app"),
    jobId,
    userId,
    reason: (reason || "").trim(),
    status: "応募済み",
    createdAt: nowISO()
  });
  setApplications(apps);
  return { ok:true, message:"応募を受け付けました！" };
}
