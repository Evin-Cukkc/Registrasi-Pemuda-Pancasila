import { STORAGE_KEY, LOGS_KEY } from './config.js';

export function safeGetStorage(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function safeSetStorage(key, val) {
  try { localStorage.setItem(key, val); return true; } catch { return false; }
}

export function safeRemoveStorage(key) {
  try { localStorage.removeItem(key); } catch {}
}

export function getMembersLocal() {
  const raw = safeGetStorage(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveMembersLocal(members) {
  return safeSetStorage(STORAGE_KEY, JSON.stringify(members));
}

export function addActivityLog(memberId, action) {
  const raw = safeGetStorage(LOGS_KEY);
  let logs = [];
  try { logs = JSON.parse(raw) || []; } catch {}

  logs.unshift({
    memberId,
    action,
    timestamp: new Date().toLocaleString('id-ID')
  });

  safeSetStorage(LOGS_KEY, JSON.stringify(logs.slice(0, 20)));
}

export function getActivityLogs(memberId) {
  const raw = safeGetStorage(LOGS_KEY);
  if (!raw) return [];
  try {
    const logs = JSON.parse(raw) || [];
    return logs.filter(l => l.memberId === memberId);
  } catch { return []; }
}