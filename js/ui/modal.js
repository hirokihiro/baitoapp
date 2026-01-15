export function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add("open");
  modalEl.setAttribute("aria-hidden", "false");
}

export function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove("open");
  modalEl.setAttribute("aria-hidden", "true");
}

export function wireModalClose(modalEl) {
  if (!modalEl) return;
  modalEl.addEventListener("click", (e) => {
    const t = e.target;
    if (t?.dataset?.close) closeModal(modalEl);
  });
}
