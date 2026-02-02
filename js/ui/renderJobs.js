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
    const badges = buildBadges(job, count);
    const wage = Number(job.wage || 0);
    const wageText = Number.isFinite(wage) && wage > 0 ? `¥${wage.toLocaleString()}/時` : "時給 未設定";
    const simText = Number.isFinite(wage) && wage > 0
      ? `目安：週2×4hで月約¥${formatYen(wage * 32)}`
      : "";
    const subMeta = buildSubMeta(job);

    card.innerHTML = `
      <div class="job-topbar">
        <div class="job-title-wrap">
          <p class="job-title">${escapeHtml(job.title || "")}</p>
          ${badges ? `<div class="job-badges">${badges}</div>` : ``}
        </div>

        <button class="fav-btn ${fav ? "on" : ""}" data-fav="${job.id}" aria-pressed="${fav ? "true" : "false"}" title="お気に入り">
          ${fav ? "♥" : "♡"}
        </button>
      </div>

      <div class="job-wage-row">
        <div class="job-wage-large">${wageText}</div>
        ${subMeta ? `<div class="job-submeta">${subMeta}</div>` : ``}
      </div>

      <div class="job-meta">店舗：${escapeHtml(job.shop || "")}</div>
      <div class="job-meta">エリア：${escapeHtml(job.area || "")}</div>
      <div class="job-meta">シフト：${escapeHtml(job.shift || "")}</div>
      <div class="job-meta">応募者数：<b>${count}</b>人</div>
      ${simText ? `<div class="job-sim">${simText}</div>` : ``}

      <div class="job-actions">
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

function formatYen(v) {
  return Number(v || 0).toLocaleString();
}

function buildBadges(job, count) {
  const badges = [];
  if (typeof count === "number" && count >= 5) {
    badges.push(`<span class="badge badge-hot">人気</span>`);
  }
  if (isRecent(job.createdAt)) {
    badges.push(`<span class="badge badge-urgent">急募</span>`);
  }

  const tags = Array.isArray(job.tags) ? job.tags : [];
  for (const t of tags.slice(0, 4)) {
    badges.push(`<span class="badge badge-tag">${escapeHtml(t)}</span>`);
  }

  return badges.join("");
}

function buildSubMeta(job) {
  const tags = Array.isArray(job.tags) ? job.tags : [];
  const parts = [];
  const hasTravel = tags.some((t) => /交通費/.test(t));
  const hasFlexible = tags.some((t) => /(シフト|週\d|自由|柔軟)/.test(t)) || /週\d/.test(job.shift || "");

  if (hasTravel) parts.push("交通費あり");
  if (hasFlexible) parts.push("シフト相談OK");

  return parts.join(" / ");
}
