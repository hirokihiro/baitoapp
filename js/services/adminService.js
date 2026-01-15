import { fetchMyProfile } from "./authService.js";

export async function requireAdminOrRedirect() {
  const profile = await fetchMyProfile();
  if (!profile || profile.role !== "admin") {
    location.href = "./app.html";
    return null;
  }
  return profile;
}
