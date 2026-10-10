export const STORAGE_KEY = "pp_demo_members_v1";
export const SESSION_KEY = "pp_demo_session_v1";
export const NOTIF_KEY = "pp_demo_notif_read_v1";
export const LOGS_KEY = "pp_demo_activity_logs_v1";

export const API_CONFIG = {
    MODE_MOCK: false, // Diaktifkan agar terhubung ke Google Sheets
    GAS_ENDPOINT_URL: "https://script.google.com/macros/s/AKfycbzcLrK7EaFxel6CGbLEro1R-ltTnCBIrBf6qB4qP7gskox2vU5JSQ2eGkc7G5DfUTfI/exec"
  };

export const DUMMY_EVENTS = [
  { id: 1, judul: "Bakti Sosial & Donor Darah", tanggal: "25 Oktober 2026", lokasi: "Aulia Plaza Medan", status: "Akan Datang", deskripsi: "Kegiatan donor darah rutin." },
  { id: 2, judul: "Pelatihan Kepemimpinan Pemuda", tanggal: "12 November 2026", lokasi: "Gedung Pemuda Medan", status: "Akan Datang", deskripsi: "Mengasah integritas dan jiwa kepemimpinan." }
];

export const DUMMY_NEWS = [
  { id: 1, judul: "Instruksi Konsolidasi Anggota", tanggal: "01 Oktober 2026", isi: "Diimbau seluruh kader untuk memperbarui data diri." }
];