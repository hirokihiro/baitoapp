export function toast(message, { duration = 2200 } = {}) {
  const wrap = document.getElementById("toastWrap");
  if (!wrap) return;

  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;

  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));

  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 220);
  }, duration);
}
