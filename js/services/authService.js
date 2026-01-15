import { auth } from "../firebase.js";
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getUserProfile, upsertUserProfile } from "./usersService.js";

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getUserProfile(cred.user.uid);
  return { user: cred.user, profile };
}

export async function register({ name, email, password, role = "user" }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await upsertUserProfile(cred.user.uid, {
    name,
    email,
    role,
    createdAt: new Date().toISOString()
  });
  const profile = await getUserProfile(cred.user.uid);
  return { user: cred.user, profile };
}

export async function logout() {
  await signOut(auth);
}

export async function fetchMyProfile() {
  const u = auth.currentUser;
  if (!u) return null;
  return await getUserProfile(u.uid);
}
