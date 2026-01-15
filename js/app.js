// 画面ごとに存在する要素を見て処理を分岐する

document.addEventListener("DOMContentLoaded", () => {
  // 初回データ
  seedJobs(false);

  // index.html: ログイン
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    const msg = document.getElementById("msg");
    const seedBtn = document.getElementById("seedBtn");

    // 既にログインしてたらホームへ
    const me = currentUser();
    if (me) {
      renderHome(); // index.htmlをホームとして使う
      return;
    }

    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;

      const res = loginUser({ email, password });
      msg.className = "msg " + (res.ok ? "ok" : "ng");
      msg.textContent = res.message;

      if (res.ok) {
        renderHome();
      }
    });

    seedBtn.addEventListener("click", () => {
      seedJobs(true);
      msg.className = "msg ok";
      msg.textContent = "求人データを初期化しました。ログイン後に確認できます。";
    });
  }

  // register.html: 新規登録
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    const msg = document.getElementById("msg");
    registerForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("name").value;
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;

      const res = registerUser({ name, email, password });
      msg.className = "msg " + (res.ok ? "ok" : "ng");
      msg.textContent = res.message;

      if (res.ok) {
        registerForm.reset();
      }
    });
  }
});

// =============================
// index.html をログイン後ホームに変身させる
// =============================
function renderHome() {
  const me = currentUser();
  if (!me) {
    location.href = "./index.html";
    return;
  }

  // body内を書き換える（簡易SPA風）
  document.body.innerHTML = `
    <div class="container">
      <header class="header">
        <div class="row space-between">
          <div>
            <h1>BAITOAPP</h1>
            <p class="muted">ようこそ、${escapeHTML(me.name)} さん</p>
          </div>
          <div class="row">
            <button id="logoutBtn" class="btn danger">ログアウト</button>
          </div>
        </div>
      </header>

      <main class="grid two">
        <section class="card">
          <h2 class="card-title">求人を探す</h2>

          <div class="row">
            <input id="q" class="input" placeholder="例：カフェ / 駅前 / 高時給" />
            <select id="sort" class="select" style="max-width:220px;">
              <option value="new">新着順</option>
              <option value="wage_desc">時給が高い順</option>
              <option value="wage_asc">時給が低い順</option>
            </select>
          </div>

          <hr class="sep"/>

          <div id="jobs" class="grid"></div>
          <p id="jobsMsg" class="msg"></p>
        </section>

        <aside class="card">
          <h2 class="card-title">応募履歴</h2>
          <div id="apps" class="grid"></div>
          <p id="appsMsg" class="msg"></p>
        </aside>
      </main>

      <footer class="footer muted">
        <small>デモ：localStorageで求人/応募/ユーザーを保存しています</small>
      </footer>
    </div>
  `;

  document.getElementById("logoutBtn").addEventListener("click", () => {
    logout();
    location.href = "./index.html";
  });

  const q = document.getElementById("q");
  const sort = document.getElementById("sort");
  q.addEventListener("input", () => renderJobs());
  sort.addEventListener("change", () => renderJobs());

  renderJobs();
  renderApplications();
}

// =============================
// Rendering
// =============================
function renderJobs() {
  const me = currentUser();
  const jobsWrap = document.getElementById("jobs");
  const jobsMsg = document.getElementById("jobsMsg");
  if (!jobsWrap) return;

  const query = (document.getElementById("q")?.value || "").trim().toLowerCase();
  const sort = document.getElementById("sort")?.value || "new";

  let jobs = getJobs();

  // filter
  if (query) {
    jobs = jobs.filter(j => {
      const hay = [
        j.title, j.shop, j.area, String(j.wage), j.shift,
        ...(j.tags || []), j.description
      ].join(" ").toLowerCase();
      return hay.includes(query);
    });
  }

  // sort
  if (sort === "new") jobs.sort((a,b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  if (sort === "wage_desc") jobs.sort((a,b) => (b.wage || 0) - (a.wage || 0));
  if (sort === "wage_asc") jobs.sort((a,b) => (a.wage || 0) - (b.wage || 0));

  jobsWrap.innerHTML = "";
  if (jobs.length === 0) {
    jobsMsg.className = "msg";
    jobsMsg.textContent = "該当する求人がありません。";
    return;
  }
  jobsMsg.textContent = "";

  const apps = getApplications();
  const appliedSet = new Set(apps.filter(a => a.userId === me.id).map(a => a.jobId));

  for (const job of jobs) {
    const applied = appliedSet.has(job.id);

    const el = document.createElement("div");
    el.className = "job";
    el.innerHTML = `
      <h3>${escapeHTML(job.title)}</h3>
      <div class="muted">${escapeHTML(job.shop)} / ${escapeHTML(job.area)}</div>

      <div class="badges">
        <span class="badge">時給 ¥${escapeHTML(String(job.wage))}</span>
        <span class="badge">${escapeHTML(job.shift)}</span>
        ${(job.tags || []).map(t => `<span class="badge">${escapeHTML(t)}</span>`).join("")}
      </div>

      <div class="muted">${escapeHTML(job.description)}</div>

      <hr class="sep"/>

      <div class="row">
        <textarea class="textarea" id="reason_${job.id}" placeholder="応募理由（任意）"></textarea>
      </div>

      <div class="row space-between">
        <button class="btn primary" ${applied ? "disabled" : ""} data-apply="${job.id}">
          ${applied ? "応募済み" : "応募する"}
        </button>
        <span class="muted" style="font-size:12px;">求人ID: ${escapeHTML(job.id.slice(-6))}</span>
      </div>

      <p class="msg" id="jobmsg_${job.id}"></p>
    `;

    el.querySelector(`[data-apply="${job.id}"]`).addEventListener("click", () => {
      const reason = document.getElementById(`reason_${job.id}`).value;
      const res = applyToJob({ jobId: job.id, userId: me.id, reason });

      const m = document.getElementById(`jobmsg_${job.id}`);
      m.className = "msg " + (res.ok ? "ok" : "ng");
      m.textContent = res.message;

      if (res.ok) {
        renderJobs();
        renderApplications();
      }
    });

    jobsWrap.appendChild(el);
  }
}

function renderApplications() {
  const me = currentUser();
  const appsWrap = document.getElementById("apps");
  const appsMsg = document.getElementById("appsMsg");
  if (!appsWrap) return;

  const apps = getApplications()
    .filter(a => a.userId === me.id)
    .sort((a,b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  const jobs = getJobs();
  const jobById = new Map(jobs.map(j => [j.id, j]));

  appsWrap.innerHTML = "";
  if (apps.length === 0) {
    appsMsg.className = "msg";
    appsMsg.textContent = "まだ応募がありません。気になる求人に応募してみよう。";
    return;
  }
  appsMsg.textContent = "";

  for (const a of apps) {
    const j = jobById.get(a.jobId);
    const el = document.createElement("div");
    el.className = "job";
    el.innerHTML = `
      <h3>${escapeHTML(j?.title || "（削除された求人）")}</h3>
      <div class="muted">${escapeHTML(j?.shop || "")} ${j?.area ? " / " + escapeHTML(j.area) : ""}</div>

      <div class="kv">
        <div>状態</div><div>${escapeHTML(a.status)}</div>
        <div>応募日</div><div>${escapeHTML(formatDate(a.createdAt))}</div>
        <div>応募理由</div><div>${escapeHTML(a.reason || "（未入力）")}</div>
      </div>
    `;
    appsWrap.appendChild(el);
  }
}

// =============================
// Helpers
// =============================
function escapeHTML(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}
