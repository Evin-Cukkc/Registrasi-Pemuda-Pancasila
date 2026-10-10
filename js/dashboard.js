import { initEvents } from './events.js';
import { initAnnouncements } from './announcements.js';
import { createDetailItem } from './ui.js';
import { setupAdmin } from './admin.js';
import { getActivityLogs, safeGetStorage } from './storage.js';

export function navigateToSection(targetId) {
  document.querySelectorAll(".nav-link").forEach(b => b.classList.remove("active"));
  const btn = document.querySelector(`.nav-link[data-target="${targetId}"]`);
  if (btn) btn.classList.add("active");

  document.querySelectorAll(".dashboard-section").forEach(sec => {
    sec.classList.add("hidden");
    sec.classList.remove("section-animate");
  });

  const targetSec = document.getElementById(targetId);
  if (targetSec) {
    targetSec.classList.remove("hidden");
    void targetSec.offsetWidth;
    targetSec.classList.add("section-animate");
  }
}

export function renderDashboard(member) {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById("currentDateDisplay").textContent = new Date().toLocaleDateString('id-ID', options);

  document.getElementById("homeWelcomeName").textContent = `Selamat Datang, ${member.nama}!`;
  document.getElementById("dashMemberEmail").textContent = `Email: ${member.email}`;
  document.getElementById("dashMemberCity").textContent = `Domisili: ${member.kota}`;

  document.getElementById("editTelepon").value = member.telepon || "";
  document.getElementById("editKota").value = member.kota || "Medan";
  document.getElementById("editAlamat").value = member.alamat || "";

  // Render Kartu Digital Header
  const headerCard = document.getElementById("memberHeaderCard");
  headerCard.innerHTML = "";

  if (member.foto) {
    const img = document.createElement("img");
    img.src = member.foto;
    img.className = "member-avatar-img";
    headerCard.appendChild(img);
  } else {
    const ph = document.createElement("div");
    ph.className = "member-avatar-placeholder";
    ph.textContent = member.nama ? member.nama.charAt(0).toUpperCase() : "P";
    headerCard.appendChild(ph);
  }

  const info = document.createElement("div");
  const h3 = document.createElement("h3");
  h3.style.margin = "0 0 4px 0";
  h3.textContent = member.nama;

  const idText = document.createElement("p");
  idText.style.margin = "0";
  idText.style.color = "var(--muted)";
  idText.style.fontSize = "0.85rem";
  idText.textContent = `ID Anggota: ${member.id}`;

  const badge = document.createElement("span");
  badge.className = "badge badge-success";
  badge.textContent = `● ${member.status || "Terdaftar"}`;
  const dashStatus = document.getElementById("dashStatus");
  if (dashStatus) dashStatus.textContent = `● Status: ${member.status || "Terdaftar"}`;

  info.appendChild(h3);
  info.appendChild(idText);
  const yr = member.dibuat ? new Date(member.dibuat).getFullYear() : NaN;
  if (yr) {
    const since = document.createElement("p");
    since.style.cssText = "margin:0 0 6px;font-size:0.8rem";
    since.textContent = `Anggota sejak ${yr}`;
    info.appendChild(since);
  }
  info.appendChild(badge);
  headerCard.appendChild(info);

  // Grid Details
  const grid = document.getElementById("memberGridDetails");
  grid.innerHTML = "";
  grid.appendChild(createDetailItem("Email:", member.email));
  grid.appendChild(createDetailItem("No. Telepon:", member.telepon));
  grid.appendChild(createDetailItem("Kota/Kabupaten:", member.kota));
  grid.appendChild(createDetailItem("Usia:", member.usia ? `${member.usia} Tahun` : "-"));
  grid.appendChild(createDetailItem("Jenis Kelamin:", member.jenis_kelamin));
  grid.appendChild(createDetailItem("Minat/Hobi:", member.hobi && member.hobi.length ? member.hobi.join(", ") : "-"));

  const alm = createDetailItem("Alamat Lengkap:", `${member.alamat} (${member.kode_pos})`);
  alm.classList.add("full-width");
  grid.appendChild(alm);

  initEvents(member);
  renderActivityLogs(member.id);
  initAnnouncements(member);
  setupAdmin(member);
}

export function renderActivityLogs(memberId) {
  const timeline = document.getElementById("activityTimeline");
  timeline.innerHTML = "";
  const logs = getActivityLogs(memberId);

  if (!logs.length) {
    timeline.innerHTML = "<p class='dash-text-sm'>Belum ada riwayat aktivitas.</p>";
    return;
  }

  logs.forEach(log => {
    const item = document.createElement("div");
    item.className = "timeline-item";
    item.innerHTML = `
      <strong>${log.action}</strong>
      <div class="timeline-time">${log.timestamp}</div>
    `;
    timeline.appendChild(item);
  });
}
