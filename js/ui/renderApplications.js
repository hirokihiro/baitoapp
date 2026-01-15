// js/ui/renderApplications.js
export function renderApplications(wrapEl, apps, options = {}) {
  const { onCancel, onOpenChat, showUid = false } = options;

  wrapEl.innerHTML = "";

  if (!apps || !apps.length) {
    wrapEl.innerHTML = `<p class="muted">応募履歴はまだありません。</p>`;
    return;
  }

  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gap = "10px";

  for (const a of apps) {
    const item = document.createElement("div");
    item.className = "job-card";

    const whenText = formatWhen(a.createdAt);
    const hasChat = typeof onOpenChat === "function";
    const hasCancel = typeof onCancel === "function" && !!a.jobId;

    item.innerHTML = `
      <p class="job-title">${escapeHtml(a.jobTitle || "")}</p>
      <div class="job-meta">店舗：${escapeHtml(a.shop || "")}</div>
      <div class="job-meta">応募ID：${escapeHtml(a.id || "")}</div>
      ${showUid ? `<div class="job-meta">応募者UID：${escapeHtml(a.uid || "")}</div>` : ``}
      <div class="job-meta">応募日時：${escapeHtml(whenText)}</div>

      <div class="row" style="gap:8px; margin-top:10px; flex-wrap:wrap;">
        ${hasChat ? `<button class="btn" data-chat="1">チャット</button>` : ``}
        ${hasCancel ? `<button class="btn" data-cancel="1">応募を取り消す</button>` : ``}
      </div>
    `;

    item.querySelector(`[data-chat]`)?.addEventListener("click", () => {
      // a.id が applicationId（= uid_jobId）として使える
      onOpenChat?.(a);
    });

    item.querySelector(`[data-cancel]`)?.addEventListener("click", async () => {
      if (!a.jobId) return;
      await onCancel?.(a.jobId);
    });

    list.appendChild(item);
  }

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
