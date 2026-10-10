import { SESSION_KEY, NOTIF_KEY, STORAGE_KEY } from './config.js';
import { safeGetStorage, safeSetStorage, safeRemoveStorage, getMembersLocal, saveMembersLocal, addActivityLog } from './storage.js';
import { showToast, showStatus } from './ui.js';
import { processLogin, processRegister, readFileAsDataURL, calculateAge } from './auth.js';
import { navigateToSection, renderDashboard, setupNotifications } from './dashboard.js';
import { apiUpdateProfile } from './api.js';

// Registrasi Service Worker untuk PWA
if ('serviceWorker' in navigator) {
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

  // Deteksi Status Online / Offline
  window.addEventListener('online', () => {
    pwaStatusText.textContent = "ONLINE";
    showToast("Koneksi terhubung kembali.", "success");
  });
  window.addEventListener('offline', () => {
    pwaStatusText.textContent = "OFFLINE";
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
    const res = await processLogin(email, password);

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
      try { photoBase64 = await readFileAsDataURL(photoInput.files[0]); } catch {}
    }

    showToast("Mendaftarkan data ke Google Sheets...", "info");
    const res = await processRegister(formData, photoBase64);
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

  // Ekspor JSON (Opsional Cadangan Lokal)
  document.getElementById("exportDataBtn").addEventListener("click", () => {
    const sessionRaw = safeGetStorage(SESSION_KEY);
    if (!sessionRaw) return;
    const blob = new Blob([sessionRaw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-profil-anggota-${Date.now()}.json`;
    a.click();
    showToast("Profil berhasil diekspor.", "success");
  });

  // Edit Profil
  document.getElementById("editProfileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const sessionRaw = safeGetStorage(SESSION_KEY);
    if (!sessionRaw) return;
    
    let currentMember;
    try { currentMember = JSON.parse(sessionRaw); } catch { return; }

    const updateFields = {
      telepon: document.getElementById("editTelepon").value,
      kota: document.getElementById("editKota").value,
      alamat: document.getElementById("editAlamat").value
    };

    const editFoto = document.getElementById("editFoto");
    if (editFoto.files[0]) {
      try { updateFields.foto = await readFileAsDataURL(editFoto.files[0]); } catch {}
    }

    showToast("Memperbarui profil di server...", "info");
    const res = await apiUpdateProfile(currentMember.id, updateFields);
    if (res.success) {
      const updatedMember = { ...currentMember, ...updateFields };
      if (res.member && res.member.foto) updatedMember.foto = res.member.foto;
      
      safeSetStorage(SESSION_KEY, JSON.stringify(updatedMember));
      addActivityLog(currentMember.id, "Memperbarui data profil");
      renderDashboard(updatedMember);
      showToast("Profil berhasil diperbarui!", "success");
    } else {
      showToast(res.message || "Gagal memperbarui profil.", "error");
    }
  });

  // Notifikasi Dropdown
  document.getElementById("notifBellBtn").addEventListener("click", () => {
    document.getElementById("notifDropdown").classList.toggle("hidden");
  });

  document.getElementById("markReadBtn").addEventListener("click", () => {
    safeSetStorage(NOTIF_KEY, "true");
    setupNotifications();
    showToast("Notifikasi ditandai dibaca.");
  });

  // Logout & Modal
  navLogoutBtn.addEventListener("click", () => {
    safeRemoveStorage(SESSION_KEY);
    location.reload();
  });

  document.getElementById("openDeleteModalBtn").addEventListener("click", () => {
    document.getElementById("deleteModal").classList.remove("hidden");
  });

  document.getElementById("cancelDeleteBtn").addEventListener("click", () => {
    document.getElementById("deleteModal").classList.add("hidden");
  });

  document.getElementById("confirmDeleteBtn").addEventListener("click", () => {
    safeRemoveStorage(SESSION_KEY);
    showToast("Sesi akun ditutup.");
    location.reload();
  });

  // Pemulihan Sesi (Restore Session) saat halaman dimuat ulang
  const savedSession = safeGetStorage(SESSION_KEY);
  if (savedSession) {
    try {
      const member = JSON.parse(savedSession);
      if (member && member.id) {
        authLayout.classList.add("hidden");
        dashboardLayout.classList.remove("hidden");
        appNav.classList.remove("hidden");
        navLogoutBtn.classList.remove("hidden");
        notifWrapper.classList.remove("hidden");
        renderDashboard(member);
      }
    } catch {
      safeRemoveStorage(SESSION_KEY);
    }
  }
});