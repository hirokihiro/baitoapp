// js/ui/renderChat.js

function toDateSafe(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  if (typeof v === "number") return new Date(v);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pad2(n) { return String(n).padStart(2, "0"); }
function formatTime(d) { return d ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : ""; }

function isReadByOther(msg, otherRole) {
  if (Array.isArray(msg.readBy)) return msg.readBy.includes(otherRole);
  if (msg.readBy && typeof msg.readBy === "object") return !!msg.readBy[otherRole];
  if (otherRole === "admin" && msg.readAtAdmin) return true;
  if (otherRole === "user" && msg.readAtUser) return true;
  return false;
}

export function renderChat({ wrapEl, meUid, meRole, messages, typing, onRetryFailed }) {
  if (!wrapEl) return;

  const otherRole = meRole === "user" ? "admin" : "user";
  wrapEl.innerHTML = "";

  for (const msg of messages) {
    // ✅ 重要：senderRoleがあるなら roleだけで判定（UIDは使わない）
    let isMe = false;
    if (msg.senderRole && meRole) {
      isMe = msg.senderRole === meRole;
    } else if (meUid && msg.senderUid) {
      // 古いデータ用の保険
      isMe = msg.senderUid === meUid;
    }

    const row = document.createElement("div");
    row.className = `chat-row ${isMe ? "me" : "other"}`;

    const bubble = document.createElement("div");
    // 色は送信者roleで決定
    const bubbleKind = msg.senderRole === "admin" ? "admin" : "user";
    bubble.className = `chat-message ${bubbleKind} ${msg.pending ? "pending" : ""} ${msg.failed ? "failed" : ""}`;
    bubble.textContent = msg.text || "";

    const meta = document.createElement("div");
    meta.className = `chat-meta-line ${isMe ? "me" : "other"}`;

    const created = toDateSafe(msg.createdAt || msg.created || msg.ts || msg.timestamp);
    const timeEl = document.createElement("span");
    timeEl.className = "chat-time";
    timeEl.textContent = formatTime(created);

    const statusEl = document.createElement("span");
    statusEl.className = "chat-status";
    statusEl.dataset.role = "status";
    if (isMe) {
      if (msg.failed) statusEl.textContent = "送信失敗";
      else if (msg.pending) statusEl.textContent = "送信中…";
      else statusEl.textContent = isReadByOther(msg, otherRole) ? "既読" : "未読";
    }

    meta.appendChild(timeEl);
    if (isMe) meta.appendChild(statusEl);

    if (isMe && msg.failed && typeof onRetryFailed === "function") {
      const retryBtn = document.createElement("button");
      retryBtn.type = "button";
      retryBtn.className = "btn chat-retry-btn";
      retryBtn.textContent = "再送";
      retryBtn.addEventListener("click", () => {
        onRetryFailed(msg);
      });
      meta.appendChild(retryBtn);
    }

    row.appendChild(bubble);
    row.appendChild(meta);
    wrapEl.appendChild(row);
  }

  // typing（相手が入力中…）
  if (typing?.on && typing?.role && typing.role !== meRole) {
    const row = document.createElement("div");
    row.className = `chat-row other`;
    const bubble = document.createElement("div");
    bubble.className = "chat-typing";
    bubble.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
    row.appendChild(bubble);
    wrapEl.appendChild(row);
  }

  wrapEl.scrollTop = wrapEl.scrollHeight;
}
