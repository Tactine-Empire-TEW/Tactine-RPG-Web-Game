/**
 * api.js — backend client.
 * Auth is handled via httpOnly cookies set by the server.
 * JS never touches the token — credentials:'include' sends the cookie automatically.
 */

const BASE = '/api';

async function _req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',                    // send the httpOnly auth cookie
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw Object.assign(new Error(err.detail ?? 'Request failed'), { status: res.status });
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────

export const auth = {
  async register(email, password) { return _req('POST', '/auth/register', { email, password }); },
  async login(email, password)    { return _req('POST', '/auth/login',    { email, password }); },
  async me()                      { return _req('GET',  '/auth/me'); },
  async logout() {
    await _req('POST', '/auth/logout').catch(() => {});
    window.location.href = '/';
  },
};

// ── Economy ───────────────────────────────────────────────────────────

export const economy = {
  async getBalance()  { return _req('GET', '/user/balance'); },
  async setBalance(n) { return _req('PUT', '/user/balance', { ruflux_balance: n }); },
};

// ── Inventory ─────────────────────────────────────────────────────────

export const inventory = {
  async getAll()           { return _req('GET',    '/user/inventory'); },
  async purchase(item)     { return _req('POST',   '/user/inventory/purchase', item); },
  async consume(item_key)  { return _req('DELETE', `/user/inventory/${encodeURIComponent(item_key)}`); },
};

// ── World state ───────────────────────────────────────────────────────

export const worldApi = {
  async load()                         { return _req('GET', '/world/state'); },
  async save(world_data, biome = 'normal') { return _req('PUT', '/world/state', { world_data, biome }); },
};
