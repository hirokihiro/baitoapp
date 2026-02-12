import { register } from "./services/authService.js";
import { toast } from "./ui/toast.js";

const form = document.getElementById("registerForm");
const msg = document.getElementById("msg");
const roleSelect = document.getElementById("role");

function showError(text) {
  msg.textContent = text;
}

function explain(code) {
  switch (code) {
    case "auth/email-already-in-use": return "このメールアドレスは既に登録されています。";
    case "auth/invalid-email": return "メールアドレスの形式が正しくありません。";
    case "auth/weak-password": return "パスワードは6文字以上にしてください。";
    default: return "登録に失敗しました。";
  }
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "";

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const role = (roleSelect?.value === "admin") ? "admin" : "user";

  if (!name) return showError("名前を入力してください。");
  if (!email) return showError("メールアドレスを入力してください。");
  if (!password || password.length < 6) return showError("パスワードは6文字以上にしてください。");

  try {
    await register({ name, email, password, role });
    toast("登録しました。ログインしてください。");
    location.href = "./login.html";
  } catch (err) {
    console.error(err);
    msg.textContent = `登録に失敗しました：${err.code || err.message || "unknown"}`;
  }

});

const params = new URLSearchParams(location.search);
const roleFromQuery = params.get("role");
if (roleSelect && (roleFromQuery === "admin" || roleFromQuery === "user")) {
  roleSelect.value = roleFromQuery;
}
