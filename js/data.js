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
  currentUser: "Arsal",
  currentEmail: "arsalah18m@gmail.com",
  adminPin: "1234",        // PIN Admin
  googleClientId: "",      // Opsional: Google OAuth Client ID untuk Google One Tap
  activeMonth: "2026-07",
  activeWeekId: "w1",
  members: [...DEFAULT_MEMBERS],
  months: {
    "2026-07": {
      id: "2026-07",
      name: "Juli 2026",
      weeks: [
        {
          id: "w1",
          title: "Minggu Ke-1",
          note: "Mulai Minggu 28 Juni 2026",
          counts: {
            "Arsal": 0,
            "Rohman": 0,
            "Alan": 5,
            "Kang Angga": 0,
            "Rizki": 0,
            "Kang Nabill": 0,
            "Tami": 0,
            "Radit": 4,
            "Rama": 4,
            "Teguh": 4
          },
          logs: []
        },
        {
          id: "w2",
          title: "Minggu Ke-2",
          note: "Mulai Minggu 5 Juli 2026",
          counts: {
            "Arsal": 0,
            "Rohman": 0,
            "Alan": 6,
            "Kang Angga": 0,
            "Rizki": 0,
            "Kang Nabill": 0,
            "Tami": 0,
            "Radit": 3,
            "Rama": 4,
            "Teguh": 4
          },
          logs: []
        },
        {
          id: "w3",
          title: "Minggu Ke-3",
          note: "Mulai Minggu 12 Juli 2026",
          counts: {
            "Arsal": 0,
            "Rohman": 0,
            "Alan": 4,
            "Kang Angga": 0,
            "Rizki": 0,
            "Kang Nabill": 0,
            "Tami": 0,
            "Radit": 3,
            "Rama": 4,
            "Teguh": 4
          },
          logs: []
        },
        {
          id: "w4",
          title: "Minggu Ke-4",
          note: "Mulai Minggu 19 Juli 2026",
          counts: {
            "Arsal": 0,
            "Rohman": 0,
            "Alan": 3,
            "Kang Angga": 0,
            "Rizki": 0,
            "Kang Nabill": 0,
            "Tami": 0,
            "Radit": 3,
            "Rama": 4,
            "Teguh": 4
          },
          logs: []
        }
      ]
    }
  }
};

const STORAGE_KEY = "ubudiyah_simple_v4";

class StorageManager {
  static load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Periksa versi v3 atau v2 sebelumnya untuk dimigrasikan
      const prevV3 = localStorage.getItem("ubudiyah_simple_v3");
      const prevV2 = localStorage.getItem("ubudiyah_simple_v2");
      const prevRaw = prevV3 || prevV2;
      
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
            // Perbarui email Arsal jika masih menggunakan arsal@gmail.com
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

      // Pastikan email aktif Arsal adalah arsalah18m@gmail.com
      if (!data.currentEmail || data.currentEmail === "arsal@gmail.com") {
        data.currentEmail = "arsalah18m@gmail.com";
        data.currentUser = "Arsal";
      }

      if (!data.adminPin) data.adminPin = "1234";
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
    if (old.months) fresh.months = old.months;
    if (old.adminPin) fresh.adminPin = old.adminPin;
    if (old.activeMonth) fresh.activeMonth = old.activeMonth;
    if (old.activeWeekId) fresh.activeWeekId = old.activeWeekId;

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

    fresh.currentUser = "Arsal";
    fresh.currentEmail = "arsalah18m@gmail.com";
    return fresh;
  }
}
