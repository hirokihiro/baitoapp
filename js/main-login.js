import { login } from "./services/authService.js";
import { toast } from "./ui/toast.js";

const form = document.getElementById("loginForm");
const msg = document.getElementById("msg");

function showError(text) {
  msg.textContent = text;
}

function explain(code) {
  switch (code) {
    case "auth/invalid-email": return "メールアドレスの形式が正しくありません。";
    case "auth/invalid-credential": return "メールアドレスまたはパスワードが違います。";
    default: return "ログインに失敗しました。";
  }
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email) return showError("メールアドレスを入力してください。");
  if (!password) return showError("パスワードを入力してください。");

  try {
    const { profile } = await login(email, password);
    toast("ログインしました");
    location.href = profile?.role === "admin" ? "./admin.html" : "./app.html";
  } catch (err) {
    console.error(err);
    msg.textContent = `ログインに失敗しました：${err.code || err.message || "unknown"}`;
  }

});
