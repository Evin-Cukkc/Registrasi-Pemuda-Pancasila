export function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
  
    setTimeout(() => toast.remove(), 3500);
  }
  
  export function showStatus(element, message, type = "success") {
    if (!element) return;
    element.textContent = message;
    element.className = `status show ${type}`;
  }
  
  export function clearStatus(element) {
    if (!element) return;
    element.textContent = "";
    element.className = "status";
  }
  
  export function createDetailItem(label, val) {
    const div = document.createElement("div");
    div.className = "member-grid-item";
    const str = document.createElement("strong");
    str.textContent = label;
    const sp = document.createElement("span");
    sp.textContent = val || "-";
    div.appendChild(str);
    div.appendChild(document.createElement("br"));
    div.appendChild(sp);
    return div;
  }

export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function skeleton(box, n = 3) {
  box.replaceChildren(...Array.from({ length: n }, () => el('div', 'skeleton')));
}

export async function withBusy(btn, label, fn) {
  const t = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = label; }
  try { return await fn(); } finally { if (btn) { btn.disabled = false; btn.textContent = t; } }
}
