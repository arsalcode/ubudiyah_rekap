/**
 * Data Storage & State Manager untuk Ubudiyah Rekap
 * Mendukung autentikasi berbasis Email Google masing-masing petugas
 */

const DEFAULT_MEMBERS = [
  { name: "Muhammad Arsal", email: "arsalcode404@gmail.com", password: "123456" },
  { name: "Ahmad Radit Famudji", email: "raditfam11@gmail.com", password: "123456" },
  { name: "Abdurrohman Arrozi", email: "yurozbelajar@gmail.com", password: "123456" },
  { name: "Rama Wirantara", email: "ramawiran22@gmail.com", password: "123456" },
  { name: "Teguh Firmansyah", email: "firmansyahteguh429@gmail.com", password: "123456" },
  { name: "Alan", email: "sakagalang25@gmail.com", password: "123456" }
];

const DEFAULT_GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbwaWIEd76BJEBHv95XEyYqudZ15ZEahu4K68c1SClhhONJDX8a7wDSmvbK43ATlrSpbag/exec";

const INITIAL_DATA_SIMPLE = {
  currentUser: null,       // Belum ada user sebelum login email di browser HP tersebut
  currentEmail: null,      // Belum ada email sebelum login email di browser HP tersebut
  adminPin: "Alkautsar26", // Password Admin Pengurus DKM
  googleClientId: "",      // Opsional: Google OAuth Client ID untuk Google One Tap
  googleSheetUrl: DEFAULT_GOOGLE_SHEET_URL, // URL Google Apps Script Web App resmi sinkronisasi cloud
  activeMonth: "2026-11",  // Bulan aktif default: November 2026
  members: [...DEFAULT_MEMBERS],
  months: {
    "2026-11": {
      id: "2026-11",
      name: "November 2026",
      counts: {
        "Muhammad Arsal": 0,
        "Ahmad Radit Famudji": 0,
        "Abdurrohman Arrozi": 0,
        "Rama Wirantara": 0,
        "Teguh Firmansyah": 0,
        "Alan": 0
      },
      logs: []
    },
    "2026-07": {
      id: "2026-07",
      name: "Juli 2026",
      counts: {
        "Alan": 18,
        "Rama Wirantara": 16,
        "Teguh Firmansyah": 16,
        "Ahmad Radit Famudji": 13,
        "Muhammad Arsal": 0,
        "Abdurrohman Arrozi": 0
      },
      logs: [
        { id: 101, name: "Alan", day: "Senin", date: "29 Jun 2026", time: "12:10" },
        { id: 102, name: "Alan", day: "Rabu", date: "1 Jul 2026", time: "15:20" },
        { id: 103, name: "Ahmad Radit Famudji", day: "Selasa", date: "30 Jun 2026", time: "18:15" },
        { id: 104, name: "Rama Wirantara", day: "Kamis", date: "2 Jul 2026", time: "19:30" },
        { id: 105, name: "Teguh Firmansyah", day: "Jumat", date: "3 Jul 2026", time: "12:05" }
      ]
    }
  }
};

const STORAGE_KEY = "ubudiyah_simple_v5";

class StorageManager {
  static load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Periksa versi v4, v3, atau v2 sebelumnya untuk dimigrasikan
      const prevV4 = localStorage.getItem("ubudiyah_simple_v4");
      const prevV3 = localStorage.getItem("ubudiyah_simple_v3");
      const prevV2 = localStorage.getItem("ubudiyah_simple_v2");
      const prevRaw = prevV4 || prevV3 || prevV2;
      
      if (prevRaw) {
        try {
          const old = JSON.parse(prevRaw);
          const migrated = this.migrateFromPrevious(old);
          this.save(migrated);
          return migrated;
        } catch (e) {
          console.error("Gagal migrasi data versi lama", e);
        }
      }
      this.save(INITIAL_DATA_SIMPLE);
      return JSON.parse(JSON.stringify(INITIAL_DATA_SIMPLE));
    }

    try {
      const data = JSON.parse(raw);

      // Peta migrasi nama dan email lama ke format resmi baru
      const NAME_MAP = {
        "arsal": "Muhammad Arsal",
        "muhammad arsal": "Muhammad Arsal",
        "radit": "Ahmad Radit Famudji",
        "ahmad radit famudji": "Ahmad Radit Famudji",
        "rohman": "Abdurrohman Arrozi",
        "abdurrohman arrozi": "Abdurrohman Arrozi",
        "rama": "Rama Wirantara",
        "rama wirantara": "Rama Wirantara",
        "teguh": "Teguh Firmansyah",
        "teguh firmansyah": "Teguh Firmansyah",
        "alan": "Alan"
      };

      const OLD_EMAIL_MAP = {
        "arsalah18m@gmail.com": "arsalcode404@gmail.com",
        "arsal@gmail.com": "arsalcode404@gmail.com",
        "radit@gmail.com": "raditfam11@gmail.com",
        "rohman@gmail.com": "yurozbelajar@gmail.com",
        "rama@gmail.com": "ramawiran22@gmail.com",
        "teguh@gmail.com": "firmansyahteguh429@gmail.com",
        "alan@gmail.com": "sakagalang25@gmail.com"
      };

      // 1. Pastikan daftar anggota selalu sinkron dengan 6 DEFAULT_MEMBERS resmi
      const dummyNames = ["kang angga", "rizki", "kang nabill", "tami", "arsal", "radit", "rohman", "rama", "teguh"];
      const finalMembers = DEFAULT_MEMBERS.map(dm => ({ ...dm }));
      (data.members || []).forEach(m => {
        const mName = typeof m === 'object' ? m.name : m;
        const low = mName.toLowerCase();
        if (!dummyNames.includes(low) && !finalMembers.some(fm => fm.name.toLowerCase() === low)) {
          finalMembers.push(typeof m === 'object' ? m : { name: mName, email: `${low.replace(/\s+/g, '')}@gmail.com`, password: "123456" });
        }
      });
      // Pastikan setiap anggota memiliki password
      finalMembers.forEach(m => {
        if (!m.password) m.password = "123456";
      });
      data.members = finalMembers;

      // 2. Migrasikan counts dan logs di setiap bulan agar terhubung ke nama baru
      if (!data.months || Object.keys(data.months).length === 0) {
        data.months = JSON.parse(JSON.stringify(INITIAL_DATA_SIMPLE.months));
      }

      Object.values(data.months).forEach(m => {
        if (!m.counts) m.counts = {};
        if (!m.logs) m.logs = [];

        const updatedCounts = {};
        DEFAULT_MEMBERS.forEach(dm => {
          updatedCounts[dm.name] = 0;
        });

        Object.entries(m.counts).forEach(([k, v]) => {
          const mapped = NAME_MAP[k.toLowerCase()];
          if (mapped) {
            updatedCounts[mapped] = (updatedCounts[mapped] || 0) + (Number(v) || 0);
          } else if (v > 0) {
            updatedCounts[k] = v;
          }
        });
        m.counts = updatedCounts;

        m.logs.forEach(l => {
          if (l.name) {
            const mapped = NAME_MAP[l.name.toLowerCase()];
            if (mapped) l.name = mapped;
          }
        });
      });

      // 3. Ambil akun petugas yang tersimpan khusus di browser perangkat ini
      let savedDeviceEmail = localStorage.getItem("ubudiyah_device_auth_email");
      if (savedDeviceEmail && OLD_EMAIL_MAP[savedDeviceEmail.toLowerCase()]) {
        savedDeviceEmail = OLD_EMAIL_MAP[savedDeviceEmail.toLowerCase()];
        localStorage.setItem("ubudiyah_device_auth_email", savedDeviceEmail);
      }

      if (savedDeviceEmail) {
        const matched = data.members.find(m => (typeof m === 'object' ? m.email : '').toLowerCase() === savedDeviceEmail.toLowerCase());
        if (matched) {
          data.currentUser = matched.name;
          data.currentEmail = matched.email;
        } else {
          localStorage.removeItem("ubudiyah_device_auth_email");
          data.currentUser = null;
          data.currentEmail = null;
        }
      } else {
        data.currentUser = null;
        data.currentEmail = null;
      }

      if (!data.activeMonth || !data.months[data.activeMonth]) {
        data.activeMonth = Object.keys(data.months)[0];
      }

      if (!data.adminPin || data.adminPin === "1234") data.adminPin = "Alkautsar26";
      if (data.googleClientId === undefined) data.googleClientId = "";
      const savedSheetUrl = localStorage.getItem("ubudiyah_google_sheet_url");
      if (savedSheetUrl) {
        data.googleSheetUrl = savedSheetUrl;
      }
      if (!data.googleSheetUrl) {
        data.googleSheetUrl = DEFAULT_GOOGLE_SHEET_URL;
      }
      return data;
    } catch (e) {
      console.error("Gagal membaca LocalStorage, memuat default.", e);
      return JSON.parse(JSON.stringify(INITIAL_DATA_SIMPLE));
    }
  }

  static save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  static reset() {
    this.save(INITIAL_DATA_SIMPLE);
    return JSON.parse(JSON.stringify(INITIAL_DATA_SIMPLE));
  }

  static migrateFromPrevious(old) {
    const fresh = JSON.parse(JSON.stringify(INITIAL_DATA_SIMPLE));
    if (old.adminPin) fresh.adminPin = old.adminPin;
    if (old.currentUser) fresh.currentUser = old.currentUser;
    if (old.currentEmail) fresh.currentEmail = old.currentEmail;

    if (old.members && Array.isArray(old.members)) {
      fresh.members = old.members.map(m => {
        const name = typeof m === "object" ? m.name : m;
        let email = typeof m === "object" ? m.email : "";
        if (name && name.toLowerCase() === "arsal") {
          email = "arsalah18m@gmail.com";
        }
        if (!email) {
          const match = DEFAULT_MEMBERS.find(d => d.name.toLowerCase() === name.toLowerCase());
          email = match ? match.email : `${name.toLowerCase().replace(/\s+/g, '')}@gmail.com`;
        }
        return { name, email };
      });
    }

    // Migrasi bulan dari format mingguan ke bulanan murni
    if (old.months && typeof old.months === "object") {
      fresh.months = {};
      Object.entries(old.months).forEach(([mId, mData]) => {
        if (mData.weeks && Array.isArray(mData.weeks)) {
          const newCounts = {};
          const newLogs = [];

          mData.weeks.forEach(w => {
            Object.entries(w.counts || {}).forEach(([name, c]) => {
              newCounts[name] = (newCounts[name] || 0) + c;
            });
            (w.logs || []).forEach(l => {
              newLogs.push({
                id: l.id || Date.now() + Math.random(),
                name: l.name,
                day: l.day || (l.date ? l.date.split(",")[0] : "Senin"),
                date: l.date || "Juli 2026",
                time: l.time || "12:00"
              });
            });
          });

          fresh.months[mId] = {
            id: mId,
            name: mData.name || mId,
            counts: newCounts,
            logs: newLogs
          };
        } else {
          fresh.months[mId] = {
            id: mId,
            name: mData.name || mId,
            counts: mData.counts || {},
            logs: mData.logs || []
          };
        }
      });

      // Pastikan November 2026 ada
      if (!fresh.months["2026-11"]) {
        fresh.months["2026-11"] = JSON.parse(JSON.stringify(INITIAL_DATA_SIMPLE.months["2026-11"]));
      }
      fresh.activeMonth = old.activeMonth || "2026-11";
      if (!fresh.months[fresh.activeMonth]) {
        fresh.activeMonth = "2026-11";
      }
    }

    return fresh;
  }
}
