import { normalizeTags } from "../services/jobsService.js";

export function readAdminForm() {
  const title = document.getElementById("title")?.value?.trim();
  const shop = document.getElementById("shop")?.value?.trim();
  const area = document.getElementById("area")?.value?.trim();
  const wage = document.getElementById("wage")?.value;
  const shift = document.getElementById("shift")?.value?.trim();
  const tagsText = document.getElementById("tagsText")?.value || "";
  const description = document.getElementById("description")?.value?.trim();

  return {
    title, shop, area, wage: Number(wage || 0),
    shift,
    tags: normalizeTags(tagsText),
    description
  };
}

export function clearAdminForm() {
  ["title","shop","area","wage","shift","tagsText","description"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = "";
    });
}
