// js/ui/renderApplications.js
export function renderApplications(wrapEl, apps, options = {}) {
  const { onCancel, onOpenChat, onShowProfile, onUpdateStatus, showUid = false, emptyText = "応募履歴はまだありません。" } = options;

  wrapEl.innerHTML = "";

  if (!apps || !apps.length) {
    wrapEl.innerHTML = `<p class="muted">${escapeHtml(emptyText)}</p>`;
    return;
  }

  const list = document.createElement("div");
  const appsById = new Map();
  list.style.display = "grid";
  list.style.gap = "10px";

  for (const a of apps) {
    appsById.set(String(a.id || ""), a);
    const item = document.createElement("div");
    item.className = "job-card";

    const whenText = formatWhen(a.createdAt);
    const status = resolveStatus(a);
    const hasChat = typeof onOpenChat === "function";
    const hasCancel = typeof onCancel === "function" && !!a.jobId;
    const hasProfile = typeof onShowProfile === "function" && !!a.uid;
    const hasStatusUpdate = typeof onUpdateStatus === "function" && !!a.id;
    const currentStatus = resolveStatus(a);

    item.innerHTML = `
      <div class="row space-between app-head" style="align-items:flex-start; gap:8px;">
        <p class="job-title">${escapeHtml(a.jobTitle || "")}</p>
        <span class="status-pill">${escapeHtml(status)}</span>
      </div>
      <div class="job-meta">店舗：${escapeHtml(a.shop || "")}</div>
      <div class="job-meta">応募ID：<span class="job-id">${escapeHtml(a.id || "")}</span></div>
      ${showUid ? `<div class="job-meta">応募者UID：${escapeHtml(a.uid || "")}</div>` : ``}
      <div class="job-meta">応募日時：${escapeHtml(whenText)}</div>
      ${
        hasStatusUpdate
          ? `
            <div class="row" style="gap:8px; margin-top:8px; flex-wrap:wrap;">
              <select class="select" data-status-select="${escapeHtml(a.id || "")}">
                ${buildStatusOptions(currentStatus)}
              </select>
              <button class="btn" data-status-save="${escapeHtml(a.id || "")}">ステータス更新</button>
            </div>
          `
          : ""
      }

      <div class="row" style="gap:8px; margin-top:10px; flex-wrap:wrap;">
        ${hasChat ? `<button class="btn" data-chat="${escapeHtml(a.id || "")}">チャット</button>` : ``}
        ${hasProfile ? `<button class="btn" data-profile="${escapeHtml(a.uid || "")}">プロフィール</button>` : ``}
        ${hasCancel ? `<button class="btn" data-cancel="${escapeHtml(a.jobId || "")}">応募を取り消す</button>` : ``}
      </div>
    `;

    list.appendChild(item);
  }

  list.addEventListener("click", async (e) => {
    const target = e.target?.closest?.("button[data-chat], button[data-cancel], button[data-profile], button[data-status-save]");
    if (!target) return;

    if (target.dataset.chat) {
      const app = appsById.get(String(target.dataset.chat));
      if (app) onOpenChat?.(app);
      return;
    }

    if (target.dataset.profile) {
      onShowProfile?.(target.dataset.profile);
      return;
    }

    if (target.dataset.statusSave) {
      const appId = String(target.dataset.statusSave);
      const statusEl = Array.from(list.querySelectorAll("[data-status-select]"))
        .find((el) => el.dataset.statusSelect === appId);
      const nextStatus = statusEl?.value || "選考中";
      await onUpdateStatus?.(appId, nextStatus);
      return;
    }

    if (target.dataset.cancel) {
      await onCancel?.(target.dataset.cancel);
    }
  });

  wrapEl.appendChild(list);
}

function formatWhen(createdAt) {
  if (!createdAt || typeof createdAt.toDate !== "function") return "—";
  const d = createdAt.toDate();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
}

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

function buildStatusOptions(current) {
  const statuses = ["選考中", "面接予定", "採用", "不採用"];
  return statuses
    .map((s) => `<option value="${s}" ${s === current ? "selected" : ""}>${s}</option>`)
    .join("");
}
