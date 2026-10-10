import { DUMMY_EVENTS, DUMMY_NEWS, NOTIF_KEY } from './config.js';
import { createDetailItem } from './ui.js';
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
  idText.textContent = `ID DEMO: PP-DEMO-${member.id.slice(0, 6).toUpperCase()}`;

  const badge = document.createElement("span");
  badge.className = "badge badge-success";
  badge.textContent = "● Akun Demo Aktif";

  info.appendChild(h3);
  info.appendChild(idText);
  info.appendChild(badge);
  headerCard.appendChild(info);

  // Grid Details
  const grid = document.getElementById("memberGridDetails");
  grid.innerHTML = "";
  grid.appendChild(createDetailItem("Email:", member.email));
  grid.appendChild(createDetailItem("No. Telepon:", member.telepon));
  grid.appendChild(createDetailItem("Kota/Kabupaten:", member.kota));
  grid.appendChild(createDetailItem("Usia:", `${member.usia} Tahun`));
  grid.appendChild(createDetailItem("Jenis Kelamin:", member.jenis_kelamin));
  grid.appendChild(createDetailItem("Minat/Hobi:", member.hobi && member.hobi.length ? member.hobi.join(", ") : "-"));

  const alm = createDetailItem("Alamat Lengkap:", `${member.alamat} (${member.kode_pos})`);
  alm.classList.add("full-width");
  grid.appendChild(alm);

  renderEvents(DUMMY_EVENTS);
  renderActivityLogs(member.id);
  setupNotifications();
}

export function renderEvents(eventsList) {
  const eventsContainer = document.getElementById("eventsContainer");
  eventsContainer.innerHTML = "";

  if (!eventsList.length) {
    eventsContainer.innerHTML = "<p style='grid-column: 1/-1; color: var(--muted); padding: 16px; text-align: center;'>Tidak ada kegiatan yang cocok.</p>";
    return;
  }

  eventsList.forEach(ev => {
    const card = document.createElement("div");
    card.className = "card-item card-hover";
    card.innerHTML = `
      <div>
        <span class="badge ${ev.status === 'Selesai' ? '' : 'badge-success'}">${ev.status} [DEMO]</span>
        <h3>${ev.judul}</h3>
        <p>${ev.deskripsi}</p>
      </div>
      <div class="card-meta">
        <span class="card-date">📅 ${ev.tanggal}</span>
        <span>📍 ${ev.lokasi}</span>
      </div>
    `;
    eventsContainer.appendChild(card);
  });
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

export function setupNotifications() {
  const isRead = safeGetStorage(NOTIF_KEY) === "true";
  const bellDot = document.getElementById("bellDot");
  const notifList = document.getElementById("notifList");

  if (bellDot) bellDot.classList.toggle("hidden", isRead);

  if (notifList) {
    notifList.innerHTML = "";
    DUMMY_NEWS.forEach(nw => {
      const li = document.createElement("li");
      li.textContent = `📣 ${nw.judul} (${nw.tanggal})`;
      notifList.appendChild(li);
    });
  }
}