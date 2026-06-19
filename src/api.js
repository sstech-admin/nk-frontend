// Local dev: leave VITE_API_URL unset — Vite proxies /api to the backend (see vite.config.js).
// Production (Amplify): set VITE_API_URL to your App Runner backend URL, e.g. https://xxxx.awsapprunner.com
const API_ROOT = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const BASE = API_ROOT + "/api";

let TOKEN = localStorage.getItem("nk_token") || null;
let onUnauthorized = () => {};

export function setToken(t) {
  TOKEN = t || null;
  if (t) localStorage.setItem("nk_token", t);
  else localStorage.removeItem("nk_token");
}
export function getToken() { return TOKEN; }
export function setOnUnauthorized(fn) { onUnauthorized = fn; }

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(TOKEN ? { Authorization: "Bearer " + TOKEN } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401) {
    setToken(null);
    onUnauthorized();
    let msg = "Session expired";
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // auth
  login: (username, password) => call("POST", "/auth/login", { username, password }),
  me: () => call("GET", "/auth/me"),
  // users (admin)
  users: () => call("GET", "/users"),
  createUser: (u) => call("POST", "/users", u),
  updateUser: (id, u) => call("PATCH", "/users/" + id, u),
  delUser: (id) => call("DELETE", "/users/" + id),
  // app data
  health: () => call("GET", "/health"),
  meta: () => call("GET", "/meta"),
  orders: () => call("GET", "/orders"),
  createOrder: (o) => call("POST", "/orders", o),
  patchOrder: (wo, set) => call("PATCH", `/orders/${wo}`, set),
  advance: (wo, to) => call("POST", `/orders/${wo}/advance`, { to }),
  dispatch: (wo) => call("POST", `/orders/${wo}/dispatch`),
  delOrder: (wo) => call("DELETE", `/orders/${wo}`),
  addDesigner: (name) => call("POST", "/designers", { name }),
  delDesigner: (name) => call("DELETE", "/designers/" + encodeURIComponent(name)),
  addContractor: (name) => call("POST", "/contractors", { name }),
  delContractor: (name) => call("DELETE", "/contractors/" + encodeURIComponent(name)),
  reports: (month) => call("GET", "/reports" + (month ? `?month=${month}` : "")),
  seed: () => call("POST", "/seed"),
  wipe: () => call("POST", "/wipe")
};
