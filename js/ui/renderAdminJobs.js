export function renderAdminJobs({
  wrapEl,
  jobs,
  onEdit,
  onDelete
}) {
  wrapEl.innerHTML = "";

  if (!jobs.length) {
    wrapEl.innerHTML = `<p class="muted">求人がありません。</p>`;
    return;
  }

  const box = document.createElement("div");
  box.style.display = "grid";
  box.style.gap = "10px";

  for (const j of jobs) {
    const card = document.createElement("div");
    card.className = "job-card";

    card.innerHTML = `
      <div class="job-top">
        <div>
          <p class="job-title">${escapeHtml(j.title || "")}</p>
          <div class="job-meta">店舗：${escapeHtml(j.shop || "")}</div>
          <div class="job-meta">エリア：${escapeHtml(j.area || "")} / シフト：${escapeHtml(j.shift || "")}</div>
        </div>
        <div class="job-wage">¥${Number(j.wage || 0).toLocaleString()}/時</div>
      </div>

      <div class="job-actions">
        <button class="btn" data-edit="${j.id}">編集</button>
        <button class="btn" data-del="${j.id}">削除</button>
      </div>
    `;

    card.querySelector("[data-edit]")?.addEventListener("click", () => onEdit(j));
    card.querySelector("[data-del]")?.addEventListener("click", () => onDelete(j));

    box.appendChild(card);
  }

  wrapEl.appendChild(box);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
