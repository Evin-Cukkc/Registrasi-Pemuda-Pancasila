import { SESSION_KEY, NOTIF_KEY } from './config.js';
import { safeSetStorage, safeRemoveStorage, addActivityLog } from './storage.js';
import { showToast, showStatus, withBusy } from './ui.js';
import { initWizard } from './wizard.js';
import { clearEventsCache } from './events.js';
import { markAllRead } from './announcements.js';
import { processLogin, processRegister, resizeImage, calculateAge, saveSession, getSession } from './auth.js';
import { navigateToSection, renderDashboard } from './dashboard.js';
import { apiUpdateProfile, apiGetProfile, apiLogout } from './api.js';

// Logout: cabut token di server (maks 3 detik), lalu hapus sesi di perangkat
async function logout() {
  const s = getSession();
  if (s) await Promise.race([apiLogout(s.token), new Promise(r => setTimeout(r, 3000))]);
  safeRemoveStorage(SESSION_KEY);
  clearEventsCache();
  location.reload();
}

// Registrasi Service Worker untuk PWA
if ('serviceWorker' in navigator) {
  const hadSW = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadSW) showToast('Versi baru tersedia. Muat ulang halaman untuk memakainya.', 'info');
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('PWA Service Worker terdaftar'))
      .catch((err) => console.log('SW Gagal:', err));
  });
}

let deferredPrompt;

document.addEventListener("DOMContentLoaded", () => {
  const authLayout = document.getElementById("authLayout");
  const dashboardLayout = document.getElementById("dashboardLayout");
  const appNav = document.getElementById("appNav");
  const navLogoutBtn = document.getElementById("navLogoutBtn");
  const notifWrapper = document.getElementById("notifWrapper");
  const pwaInstallBtn = document.getElementById("pwaInstallBtn");
  const pwaStatusText = document.getElementById("pwaStatusText");
  initWizard();
  if (!navigator.onLine) document.getElementById("offlineBar").classList.remove("hidden");
  const logo = document.querySelector(".logo"); // pengganti onerror inline (kompatibel dengan CSP)
  if (logo) {
    const hideLogo = () => { logo.style.visibility = "hidden"; };
    if (logo.complete && !logo.naturalWidth) hideLogo();
    logo.addEventListener("error", hideLogo);
  }
  document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () =>
    document.querySelector(`.nav-link[data-target="${b.dataset.go}"]`).click()));

  // Deteksi Status Online / Offline
  window.addEventListener('online', () => {
    pwaStatusText.textContent = "ONLINE";
    document.getElementById("offlineBar").classList.add("hidden");
    showToast("Koneksi terhubung kembali.", "success");
  });
  window.addEventListener('offline', () => {
    pwaStatusText.textContent = "OFFLINE";
    document.getElementById("offlineBar").classList.remove("hidden");
    showToast("Anda sedang menggunakan mode offline.", "error");
  });

  // Prompt Instal PWA
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (pwaInstallBtn) pwaInstallBtn.classList.remove("hidden");
  });

  if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast("Aplikasi berhasil diinstal!", "success");
      }
      deferredPrompt = null;
      pwaInstallBtn.classList.add("hidden");
    });
  }

  // Nav Links Event
  document.querySelectorAll(".nav-link").forEach(btn => {
    btn.addEventListener("click", () => navigateToSection(btn.getAttribute("data-target")));
  });

  const quickProfileBtn = document.getElementById("quickProfileBtn");
  if (quickProfileBtn) {
    quickProfileBtn.addEventListener("click", () => navigateToSection("profileSection"));
  }

  // Toggle Password
  document.querySelectorAll(".toggle-pwd-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.getAttribute("data-for"));
      input.type = input.type === "password" ? "text" : "password";
      btn.textContent = input.type === "password" ? "👁️" : "🙈";
    });
  });

  // Hitung Usia Form
  const birthInput = document.getElementById("tanggalLahir");
  const ageInput = document.getElementById("usia");
  if (birthInput && ageInput) {
    birthInput.addEventListener("input", () => {
      const age = calculateAge(birthInput.value);
      ageInput.value = age === null ? "" : String(age);
    });
  }

  // Switch Tabs Auth
  document.getElementById("loginTab").addEventListener("click", () => {
    document.getElementById("loginPanel").classList.remove("hidden");
    document.getElementById("registerPanel").classList.add("hidden");
    document.getElementById("loginTab").setAttribute("aria-selected", "true");
    document.getElementById("registerTab").setAttribute("aria-selected", "false");
  });

  document.getElementById("registerTab").addEventListener("click", () => {
    document.getElementById("loginPanel").classList.add("hidden");
    document.getElementById("registerPanel").classList.remove("hidden");
    document.getElementById("loginTab").setAttribute("aria-selected", "false");
    document.getElementById("registerTab").setAttribute("aria-selected", "true");
  });

  document.getElementById("goRegister").addEventListener("click", () => {
    document.getElementById("registerTab").click();
  });

  // Submit Login
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;
    
    showToast("Memproses masuk ke database...", "info");
    const res = await withBusy(e.submitter, "Memproses...", () => processLogin(email, password));

    if (res.success && res.member) {
      authLayout.classList.add("hidden");
      dashboardLayout.classList.remove("hidden");
      appNav.classList.remove("hidden");
      navLogoutBtn.classList.remove("hidden");
      notifWrapper.classList.remove("hidden");

      renderDashboard(res.member);
      showToast(`Selamat datang kembali, ${res.member.nama}!`, "success");
    } else {
      showStatus(document.getElementById("loginStatus"), res.message, "error");
      showToast(res.message, "error");
    }
  });

  // Submit Register
  document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(document.getElementById("registerForm"));
    const photoInput = document.getElementById("foto");
    let photoBase64 = "";

    if (photoInput.files[0]) {
      try { photoBase64 = await resizeImage(photoInput.files[0]); } catch {}
    }

    showToast("Mendaftarkan data ke Google Sheets...", "info");
    const res = await withBusy(e.submitter, "Mendaftarkan...", () => processRegister(formData, photoBase64));
    if (res.success) {
      document.getElementById("registerForm").reset();
      document.getElementById("loginTab").click();
      if (res.member && res.member.email) {
        document.getElementById("loginEmail").value = res.member.email;
      }
      showToast("Registrasi berhasil! Silakan masuk.", "success");
    } else {
      showStatus(document.getElementById("registerStatus"), res.message, "error");
      showToast(res.message, "error");
    }
  });

  // Cetak Kartu Anggota
  document.getElementById("printCardBtn").addEventListener("click", () => {
    window.print();
  });

  // Edit Profil: dianggap berhasil hanya jika server mengembalikan data anggota terbaru
  document.getElementById("editProfileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const session = getSession();
    if (!session) { showToast("Sesi berakhir. Silakan masuk kembali.", "error"); return; }
    const btn = e.submitter; if (btn) btn.disabled = true;
    const fields = {
      telepon: document.getElementById("editTelepon").value.trim(),
      kota: document.getElementById("editKota").value,
      alamat: document.getElementById("editAlamat").value.trim()
    };
    const file = document.getElementById("editFoto").files[0];
    if (file) {
      try { fields.foto = await resizeImage(file); }
      catch { showToast("File foto tidak valid.", "error"); if (btn) btn.disabled = false; return; }
    }
    showToast("Menyimpan ke database...", "info");
    const res = await apiUpdateProfile(session.token, fields);
    if (btn) btn.disabled = false;
    if (res.success && res.member) {
      saveSession(session.token, res.member);
      addActivityLog(res.member.id, "Memperbarui data profil");
      renderDashboard(res.member);
      document.getElementById("editFoto").value = "";
      showToast("Profil tersimpan di database.", "success");
    } else if (res.code === "UNAUTHORIZED") {
      safeRemoveStorage(SESSION_KEY);
      showToast(res.message, "error");
      setTimeout(() => location.reload(), 1200);
    } else {
      showToast(res.message || "Gagal menyimpan profil.", "error");
    }
  });

  // Notifikasi Dropdown
  document.getElementById("notifBellBtn").addEventListener("click", () => {
    document.getElementById("notifDropdown").classList.toggle("hidden");
  });

  document.getElementById("markReadBtn").addEventListener("click", () => {
    markAllRead();
    showToast("Pengumuman ditandai dibaca.");
  });

  // Logout & Modal
  navLogoutBtn.addEventListener("click", logout);

  document.getElementById("openDeleteModalBtn").addEventListener("click", () => {
    document.getElementById("deleteModal").classList.remove("hidden");
  });

  document.getElementById("cancelDeleteBtn").addEventListener("click", () => {
    document.getElementById("deleteModal").classList.add("hidden");
  });

  document.getElementById("confirmDeleteBtn").addEventListener("click", logout);

  // Pemulihan sesi: tampilkan cache lokal, lalu segarkan dari server
  const session = getSession();
  if (session) {
    authLayout.classList.add("hidden");
    dashboardLayout.classList.remove("hidden");
    appNav.classList.remove("hidden");
    navLogoutBtn.classList.remove("hidden");
    notifWrapper.classList.remove("hidden");
    renderDashboard(session.member);
    apiGetProfile(session.token).then(res => {
      if (res.success && res.member) { saveSession(session.token, res.member); renderDashboard(res.member); }
      else if (res.code === "UNAUTHORIZED") { safeRemoveStorage(SESSION_KEY); location.reload(); }
    });
  } else {
    safeRemoveStorage(SESSION_KEY); // hapus sesi format lama
  }
});
