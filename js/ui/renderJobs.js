// js/ui/renderJobs.js
export function renderJobs({
  wrapEl,
  jobs,
  favoritesSet,
  appliedSet,
  countsMap,
  onToggleFav,
  onRequestApply,
  onCancelApply
}) {
  wrapEl.innerHTML = "";

  if (!jobs.length) return;

  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gap = "10px";

  for (const job of jobs) {
    const card = document.createElement("div");
    card.className = "job-card";

    const fav = favoritesSet?.has(job.id);
    const applied = appliedSet?.has(job.id);
    const count = countsMap?.get(job.id) || 0;

    card.innerHTML = `
      <div class="row space-between" style="align-items:flex-start; gap:10px;">
        <div style="min-width:0;">
          <p class="job-title">${escapeHtml(job.title || "")}</p>
          <div class="job-meta">店舗：${escapeHtml(job.shop || "")}</div>
          <div class="job-meta">エリア：${escapeHtml(job.area || "")}</div>
          <div class="job-meta">時給：¥${escapeHtml(job.wage ?? "")}</div>
          <div class="job-meta">シフト：${escapeHtml(job.shift || "")}</div>
          <div class="job-meta">応募者数：<b>${count}</b>人</div>
        </div>

        <div class="row" style="gap:8px; flex-wrap:wrap; justify-content:flex-end;">
          <button class="btn" data-fav="${job.id}">
            ${fav ? "♥" : "♡"} お気に入り
          </button>

          ${
            applied
              ? `
                <button class="btn" disabled>応募済み</button>
                <button class="btn" data-cancel="${job.id}">取り消し</button>
              `
              : `
                <button class="btn primary" data-apply="${job.id}">応募する</button>
              `
          }
        </div>
      </div>
    `;

    card.querySelector(`[data-fav="${job.id}"]`)?.addEventListener("click", async () => {
      await onToggleFav?.(job.id, !fav);
    });

    card.querySelector(`[data-apply="${job.id}"]`)?.addEventListener("click", () => {
      onRequestApply?.(job);
    });

    card.querySelector(`[data-cancel="${job.id}"]`)?.addEventListener("click", async () => {
      await onCancelApply?.(job.id);
    });

    list.appendChild(card);
  }

  wrapEl.appendChild(list);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
