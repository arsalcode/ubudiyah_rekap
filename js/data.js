/**
 * Data Storage & State Manager untuk Ubudiyah Rekap
 * Mendukung autentikasi berbasis Email Google masing-masing petugas
 */

const DEFAULT_MEMBERS = [
  { name: "Arsal", email: "arsalah18m@gmail.com" },
  { name: "Rohman", email: "rohman@gmail.com" },
  { name: "Alan", email: "alan@gmail.com" },
  { name: "Kang Angga", email: "angga@gmail.com" },
  { name: "Rizki", email: "rizki@gmail.com" },
  { name: "Kang Nabill", email: "nabill@gmail.com" },
  { name: "Tami", email: "tami@gmail.com" },
  { name: "Radit", email: "radit@gmail.com" },
  { name: "Rama", email: "rama@gmail.com" },
  { name: "Teguh", email: "teguh@gmail.com" }
];

const INITIAL_DATA_SIMPLE = {
  currentUser: null,       // Belum ada user sebelum login email di browser HP tersebut
  currentEmail: null,      // Belum ada email sebelum login email di browser HP tersebut
  adminPin: "1234",        // PIN Admin
  googleClientId: "",      // Opsional: Google OAuth Client ID untuk Google One Tap
  activeMonth: "2026-11",  // Bulan aktif default: November 2026
  members: [...DEFAULT_MEMBERS],
  months: {
    "2026-11": {
      id: "2026-11",
      name: "November 2026",
      counts: {
        "Arsal": 0,
        "Rohman": 0,
        "Alan": 0,
        "Kang Angga": 0,
        "Rizki": 0,
        "Kang Nabill": 0,
        "Tami": 0,
        "Radit": 0,
        "Rama": 0,
        "Teguh": 0
      },
      logs: []
    },
    "2026-07": {
      id: "2026-07",
      name: "Juli 2026",
      counts: {
        "Alan": 18,
        "Rama": 16,
        "Teguh": 16,
        "Radit": 13,
        "Arsal": 0,
        "Rohman": 0,
        "Kang Angga": 0,
        "Rizki": 0,
        "Kang Nabill": 0,
        "Tami": 0
      },
      logs: [
        { id: 101, name: "Alan", day: "Senin", date: "29 Jun 2026", time: "12:10" },
        { id: 102, name: "Alan", day: "Rabu", date: "1 Jul 2026", time: "15:20" },
        { id: 103, name: "Radit", day: "Selasa", date: "30 Jun 2026", time: "18:15" },
        { id: 104, name: "Rama", day: "Kamis", date: "2 Jul 2026", time: "19:30" },
        { id: 105, name: "Teguh", day: "Jumat", date: "3 Jul 2026", time: "12:05" }
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
      // Validasi struktur members (pastikan punya format { name, email })
      if (!data.members || data.members.length === 0) {
        data.members = [...DEFAULT_MEMBERS];
      } else {
        data.members = data.members.map((m) => {
          if (typeof m === "string") {
            const defaultMatch = DEFAULT_MEMBERS.find(d => d.name.toLowerCase() === m.toLowerCase());
            return {
              name: m,
              email: defaultMatch ? defaultMatch.email : `${m.toLowerCase().replace(/\s+/g, '')}@gmail.com`
            };
          } else if (typeof m === "object" && m !== null) {
            if (m.name && m.name.toLowerCase() === "arsal" && (!m.email || m.email === "arsal@gmail.com")) {
              m.email = "arsalah18m@gmail.com";
            }
            if (!m.email || !m.email.trim()) {
              const defaultMatch = DEFAULT_MEMBERS.find(d => d.name.toLowerCase() === (m.name || "").toLowerCase());
              m.email = defaultMatch ? defaultMatch.email : `${(m.name || "petugas").toLowerCase().replace(/\s+/g, '')}@gmail.com`;
            }
            return m;
          }
          return m;
        });
      }

      // Ambil akun petugas yang tersimpan khusus di browser perangkat ini
      const savedDeviceEmail = localStorage.getItem("ubudiyah_device_auth_email");
      if (savedDeviceEmail) {
        const matched = data.members.find(m => (typeof m === 'object' ? m.email : '').toLowerCase() === savedDeviceEmail.toLowerCase());
        if (matched) {
          data.currentUser = matched.name;
          data.currentEmail = matched.email;
        } else {
          // Email di HP ini sudah tidak terdaftar / telah diubah oleh Admin -> Cabut akses!
          localStorage.removeItem("ubudiyah_device_auth_email");
          data.currentUser = null;
          data.currentEmail = null;
        }
      } else {
        data.currentUser = null;
        data.currentEmail = null;
      }

      // Pastikan data bulan valid
      if (!data.months || Object.keys(data.months).length === 0) {
        data.months = JSON.parse(JSON.stringify(INITIAL_DATA_SIMPLE.months));
      }

      // Pastikan setiap bulan memiliki counts dan logs
      Object.values(data.months).forEach(m => {
        if (!m.counts) m.counts = {};
        if (!m.logs) m.logs = [];
      });

      if (!data.activeMonth || !data.months[data.activeMonth]) {
        data.activeMonth = Object.keys(data.months)[0];
      }

      if (!data.adminPin) data.adminPin = "1234";
      if (data.googleClientId === undefined) data.googleClientId = "";
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
