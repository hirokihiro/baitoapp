import { watchAuth, fetchMyProfile } from "./services/authService.js";

watchAuth(async (user) => {
  if (!user) return;
  try {
    const profile = await fetchMyProfile();
    const startLogin = document.querySelector(".start-login");
    if (startLogin) {
      const nextHref = profile?.role === "admin" ? "./admin.html" : "./app.html";
      startLogin.innerHTML = `ログイン中です。<a href="${nextHref}">続きから開く</a>`;
    }
  } catch (e) {
    console.error(e);
  }
});
