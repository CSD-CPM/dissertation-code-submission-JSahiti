import { jsonFetch } from "./fetcher";

export async function me() {
  try {
    const { res, data } = await jsonFetch("/auth/me");
    return res.ok && data?.ok && !!data.user;
  } catch { return false; }
}
export async function login(email, password) {
  return jsonFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}
export async function registerUser({ firstName, lastName, email, password }) {
  return jsonFetch("/auth/register", { method: "POST", body: JSON.stringify({ firstName, lastName, email, password }) });
}
export async function logout() {
  try { await fetch("/auth/logout", { method: "POST", credentials: "include" }); } catch {}
}
export async function forgot(email) {
  return jsonFetch("/auth/forgot", { method: "POST", body: JSON.stringify({ email }) });
}
export async function reset(token, password) {
  return jsonFetch("/auth/reset", { method: "POST", body: JSON.stringify({ token, password }) });
}
