// js/ui/renderChat.js
export function renderChat({ wrapEl, meUid, messages }) {
  wrapEl.innerHTML = "";

  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gap = "8px";

  for (const m of messages) {
    const bubble = document.createElement("div");
    const mine = m.senderUid === meUid;

    bubble.style.maxWidth = "85%";
    bubble.style.justifySelf = mine ? "end" : "start";
    bubble.style.padding = "10px 12px";
    bubble.style.borderRadius = "12px";
    bubble.style.border = "1px solid rgba(255,255,255,0.12)";
    bubble.style.background = mine ? "rgba(120,180,255,0.18)" : "rgba(255,255,255,0.06)";

    bubble.innerHTML = `
      <div style="font-size:12px; opacity:.75; margin-bottom:4px;">
        ${escapeHtml(m.senderRole || "")}
      </div>
      <div style="white-space:pre-wrap; word-break:break-word;">
        ${escapeHtml(m.text || "")}
      </div>
    `;
    list.appendChild(bubble);
  }

  wrapEl.appendChild(list);
  wrapEl.scrollTop = wrapEl.scrollHeight;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
