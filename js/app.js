/**
 * Aplikasi Ubudiyah Rekap Simpel
 * Pemisahan Hak Akses:
 * - Petugas: Hanya pilih nama sendiri & klik tombol adzan (+1)
 * - Admin: Melihat seluruh rekapitulasi, tambah/hapus petugas, ekspor Excel, ubah pengaturan
 */

let state = {
  data: StorageManager.load(),
  isAdmin: sessionStorage.getItem("ubudiyah_is_admin") === "true",
  currentTab: "presensi",
  searchQuery: ""
};

// Hitungan sementara sesi saat ini (hilang otomatis jika keluar / refresh web)
let sessionClickCount = 0;

// Helper untuk daftar nama dan pencarian email petugas
function getMemberNames() {
  return (state.data.members || []).map(m => typeof m === "object" ? m.name : m);
}

function findMemberByEmail(email) {
  if (!email) return null;
  const clean = email.trim().toLowerCase();
  return (state.data.members || []).find(m => {
    if (typeof m === "object") {
      return (m.email || "").trim().toLowerCase() === clean;
    }
    return false;
  });
}

// Inisialisasi Aplikasi
document.addEventListener("DOMContentLoaded", () => {
  checkUrlAuthParams();
  setupNavigation();
  setupClickAdzanButton();
  setupAdminPinModal();
  renderApp();
  initGoogleIdentity();
});

function checkUrlAuthParams() {
  try {
    if (typeof window !== "undefined" && window.location && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const email = params.get("email");
      if (email) {
        const matched = findMemberByEmail(email);
        if (matched) {
          state.data.currentEmail = matched.email;
          state.data.currentUser = matched.name;
          StorageManager.save(state.data);
        }
      }
    }
  } catch (e) {}
}

window.addEventListener("load", () => {
  initGoogleIdentity();
});

function getActiveMonth() {
  const mId = state.data.activeMonth;
  if (!state.data.months[mId]) {
    const keys = Object.keys(state.data.months);
    if (keys.length > 0) {
      state.data.activeMonth = keys[0];
    } else {
      const defaultId = "2026-11";
      state.data.months[defaultId] = {
        id: defaultId,
        name: "November 2026",
        counts: {},
        logs: []
      };
      state.data.activeMonth = defaultId;
    }
  }
  const month = state.data.months[state.data.activeMonth];
  if (!month.counts) month.counts = {};
  if (!month.logs) month.logs = [];
  return month;
}

/**
 * =========================================================================
 * 1. PENGATURAN NAVIGASI & HAK AKSES
 * =========================================================================
 */
function setupNavigation() {
  document.querySelectorAll(".nav-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });

  const searchInput = document.getElementById("tableSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.toLowerCase().trim();
      renderRekapTable();
    });
  }

  const rekapMonthSel = document.getElementById("rekapMonthSelect");
  if (rekapMonthSel) {
    rekapMonthSel.addEventListener("change", (e) => {
      state.data.activeMonth = e.target.value;
      StorageManager.save(state.data);
      renderApp();
    });
  }
}

function switchTab(tabId) {
  // Jika bukan admin dan mencoba buka tab selain presensi, kunci ke presensi
  if (!state.isAdmin && tabId !== "presensi") {
    tabId = "presensi";
  }

  state.currentTab = tabId;

  document.querySelectorAll(".nav-tab-btn").forEach(btn => {
    if (btn.dataset.tab === tabId) {
      btn.classList.add("bg-emerald-700", "text-white", "shadow-xs");
      btn.classList.remove("text-emerald-200", "hover:bg-emerald-800");
    } else {
      btn.classList.remove("bg-emerald-700", "text-white", "shadow-xs");
      btn.classList.add("text-emerald-200", "hover:bg-emerald-800");
    }
  });

  document.querySelectorAll(".tab-pane").forEach(pane => {
    pane.classList.add("hidden");
  });

  const activePane = document.getElementById(`tab-${tabId}`);
  if (activePane) {
    activePane.classList.remove("hidden");
    activePane.classList.add("fade-in");
  }

  if (tabId === "presensi") renderPresensiTab();
  if (tabId === "rekap") renderRekapTab();
  if (tabId === "kelola") renderKelolaTab();
  if (tabId === "database") renderDatabaseTab();
}

function goToPresensi() {
  switchTab("presensi");
}

function renderApp() {
  updateRoleViews();
  renderPresensiTab();

  if (state.isAdmin) {
    renderRekapTab();
    renderKelolaTab();
    renderDatabaseTab();
  }
}

function updateRoleViews() {
  const adminNav = document.getElementById("adminNavTabs");
  const btnAdminTrigger = document.getElementById("btnAdminLoginTrigger");
  const adminBadge = document.getElementById("adminActiveBadge");
  const userBadge = document.getElementById("currentUserBadge");
  const headerSubtitle = document.getElementById("headerSubtitle");

  if (state.isAdmin) {
    // Mode Admin Aktif
    adminNav.classList.remove("hidden");
    btnAdminTrigger.classList.add("hidden");
    adminBadge.classList.remove("hidden");
    adminBadge.classList.add("flex");
    userBadge.classList.add("hidden");
    headerSubtitle.textContent = "Dashboard Pengurus & Rekap Ubudiyah";
  } else {
    // Mode Petugas Biasa
    adminNav.classList.add("hidden");
    btnAdminTrigger.classList.remove("hidden");
    adminBadge.classList.add("hidden");
    adminBadge.classList.remove("flex");
    headerSubtitle.textContent = "Portal Presensi Adzan Petugas";

    // Jika tab saat ini bukan presensi, otomatis alihkan ke presensi
    if (state.currentTab !== "presensi") {
      switchTab("presensi");
    }

    // Tampilkan nama petugas yang aktif
    const user = state.data.currentUser;
    if (user) {
      userBadge.classList.remove("hidden");
      userBadge.classList.add("flex");
      document.getElementById("currentUserName").textContent = user;
    } else {
      userBadge.classList.add("hidden");
      userBadge.classList.remove("flex");
    }
  }
}

/**
 * =========================================================================
 * 2. MODAL & LOGIN ADMIN (PIN)
 * =========================================================================
 */
function setupAdminPinModal() {
  const input = document.getElementById("adminPinInput");
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        submitAdminPin();
      }
    });
  }
}

function openAdminPinModal() {
  const modal = document.getElementById("adminPinModal");
  const input = document.getElementById("adminPinInput");
  input.value = "";
  modal.classList.remove("hidden");
  setTimeout(() => input.focus(), 100);
}

function closeAdminPinModal() {
  document.getElementById("adminPinModal").classList.add("hidden");
}

function submitAdminPin() {
  const input = document.getElementById("adminPinInput");
  const pin = input.value.trim();
  const correctPin = state.data.adminPin || "1234";

  if (pin === correctPin) {
    state.isAdmin = true;
    sessionStorage.setItem("ubudiyah_is_admin", "true");
    closeAdminPinModal();
    renderApp();
    switchTab("rekap"); // Langsung buka tabel rekap untuk admin
    showToast("Selamat datang di Mode Admin Pengurus! 👑");
  } else {
    showToast("PIN Admin salah! Coba periksa kembali.", "error");
    input.select();
  }
}

function logoutAdmin() {
  state.isAdmin = false;
  sessionStorage.removeItem("ubudiyah_is_admin");
  renderApp();
  switchTab("presensi");
  showToast("Anda telah keluar dari Mode Admin.");
}

function promptChangeAdminPin() {
  const currentPin = state.data.adminPin || "1234";
  const oldInput = prompt("Masukkan PIN Admin saat ini:");
  if (oldInput === null) return;
  if (oldInput.trim() !== currentPin) {
    showToast("PIN saat ini salah!", "error");
    return;
  }

  const newPin = prompt("Masukkan PIN Admin baru (4-8 angka/huruf):");
  if (!newPin || !newPin.trim()) {
    showToast("PIN baru tidak boleh kosong.", "error");
    return;
  }

  state.data.adminPin = newPin.trim();
  StorageManager.save(state.data);
  document.getElementById("currentPinPreview").textContent = state.data.adminPin;
  showToast("PIN Admin berhasil diubah!");
}

/**
 * =========================================================================
 * 3. TAB 1: PRESENSI PETUGAS (SAYA ADZAN 1-KLIK)
 * =========================================================================
 */
function renderPresensiTab() {
  const unauth = document.getElementById("unauthenticatedState");
  const auth = document.getElementById("authenticatedState");

  // Cari anggota berdasarkan currentEmail
  let matchedMember = findMemberByEmail(state.data.currentEmail);
  if (!matchedMember && state.data.currentUser) {
    matchedMember = (state.data.members || []).find(m => (typeof m === "object" ? m.name : m) === state.data.currentUser);
  }

  if (!matchedMember) {
    unauth.classList.remove("hidden");
    auth.classList.add("hidden");
    return;
  }

  state.data.currentUser = matchedMember.name;
  state.data.currentEmail = matchedMember.email;

  unauth.classList.add("hidden");
  auth.classList.remove("hidden");

  // Isi data sapaan user & email
  document.getElementById("activeUserGreeting").textContent = matchedMember.name;
  const emailElem = document.getElementById("activeUserEmail");
  if (emailElem) emailElem.textContent = matchedMember.email || "-";

  // Perbarui tampilan angka sesi sementara (0 jika baru buka/refresh)
  updateSessionBadge();
}

function handleEmailLogin(event) {
  if (event) event.preventDefault();
  const input = document.getElementById("inputGoogleEmail");
  const errBox = document.getElementById("emailAuthError");
  const errText = document.getElementById("emailAuthErrorText");
  const email = (input ? input.value : "").trim().toLowerCase();

  if (!email) return;

  const matched = findMemberByEmail(email);
  if (matched) {
    if (errBox) errBox.classList.add("hidden");
    state.data.currentEmail = matched.email;
    state.data.currentUser = matched.name;
    sessionClickCount = 0;
    StorageManager.save(state.data);
    renderApp();
    showToast(`Alhamdulillah! Selamat datang, ${matched.name}.`);
  } else {
    if (errBox) {
      errBox.classList.remove("hidden");
      errText.textContent = `Email "${email}" belum didaftarkan sebagai petugas oleh Admin. Hubungi pengurus DKM untuk mendaftarkan email Anda.`;
    }
    showToast("Email tidak terdaftar sebagai petugas!", "error");
    if (input) input.select();
  }
}

function initGoogleIdentity() {
  if (typeof google === "undefined" || !google.accounts || !google.accounts.id) {
    setTimeout(() => {
      if (typeof google !== "undefined" && google.accounts && google.accounts.id) {
        initGoogleIdentity();
      }
    }, 800);
    return;
  }

  try {
    const clientId = state.data.googleClientId || "1028726207865-dummy.apps.googleusercontent.com";
    google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCredentialResponse,
      auto_select: true
    });

    const btnSlot = document.getElementById("googleBtnSlot");
    if (btnSlot) {
      btnSlot.innerHTML = "";
      google.accounts.id.renderButton(btnSlot, {
        theme: "outline",
        size: "large",
        width: 280,
        text: "continue_with",
        shape: "pill",
        logo_alignment: "left"
      });
    }

    // Auto-prompt One Tap jika belum login
    if (!state.data.currentEmail) {
      google.accounts.id.prompt();
    }
  } catch (err) {
    console.warn("Google Identity Notice:", err);
  }
}

function handleGoogleCredentialResponse(response) {
  try {
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    const payload = JSON.parse(jsonPayload);
    const email = (payload.email || "").trim().toLowerCase();

    const errBox = document.getElementById("emailAuthError");
    const errText = document.getElementById("emailAuthErrorText");

    const matched = findMemberByEmail(email);
    if (matched) {
      if (errBox) errBox.classList.add("hidden");
      state.data.currentEmail = matched.email;
      state.data.currentUser = matched.name;
      sessionClickCount = 0;
      StorageManager.save(state.data);
      renderApp();
      showToast(`Alhamdulillah! Akun Google Chrome terverifikasi: ${matched.name} 🕌`);
    } else {
      if (errBox) {
        errBox.classList.remove("hidden");
        errText.innerHTML = `Akun Google Chrome Anda (<strong>${email}</strong>) belum didaftarkan sebagai petugas oleh Admin DKM. Anda tidak memiliki akses ke presensi.`;
      }
      showToast("Email Google tidak terdaftar sebagai petugas!", "error");
    }
  } catch (err) {
    console.error("Gagal memproses akun Google Chrome", err);
    showToast("Gagal memproses akun Google Chrome.", "error");
  }
}

function updateSessionBadge() {
  const badge = document.getElementById("sessionClickBadge");
  const num = document.getElementById("sessionClickNumber");
  if (!badge || !num) return;

  if (sessionClickCount > 0) {
    num.textContent = `${sessionClickCount}x`;
    badge.classList.remove("hidden");
    badge.classList.add("flex");
    badge.classList.remove("badge-pop");
    void badge.offsetWidth; // Reflow untuk memicu animasi pop membal
    badge.classList.add("badge-pop");
  } else {
    badge.classList.add("hidden");
    badge.classList.remove("flex");
  }
}



function setupClickAdzanButton() {
  const btn = document.getElementById("btnClickAdzan");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const user = state.data.currentUser;
    if (!user) {
      showToast("Silakan masuk dengan email Google Anda terlebih dahulu.", "error");
      renderPresensiTab();
      return;
    }

    const month = getActiveMonth();
    if (!month) {
      showToast("Belum ada bulan aktif di sistem. Hubungi Admin.", "error");
      return;
    }

    if (!month.counts) month.counts = {};
    month.counts[user] = (month.counts[user] || 0) + 1;

    // Catat log bertugas harian
    if (!month.logs) month.logs = [];
    const now = new Date();
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const dayName = days[now.getDay()];
    const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    month.logs.unshift({
      id: Date.now(),
      name: user,
      day: dayName,
      date: dateStr,
      time: timeStr,
      timestamp: Date.now()
    });

    // Tambah hitungan sesi sementara (di sebelah kiri tombol)
    sessionClickCount++;
    updateSessionBadge();

    // Sembunyikan keterangan upload selesai saat ada klik baru
    const notice = document.getElementById("uploadStatusNotice");
    if (notice) {
      notice.classList.add("hidden");
      notice.classList.remove("flex");
    }

    StorageManager.save(state.data);
    playSuccessSound();
    renderPresensiTab();
    showToast(`Alhamdulillah! +1 Adzan berhasil dicatat untuk ${user} 🕌`);
  });
}

function undoLastAdzan() {
  const user = state.data.currentUser;
  const month = getActiveMonth();
  if (!user || !month) return;

  const currentCount = (month.counts && month.counts[user]) || 0;
  if (currentCount <= 0) {
    showToast("Hitungan adzan Anda sudah 0.", "error");
    return;
  }

  month.counts[user] = currentCount - 1;

  if (month.logs) {
    const idx = month.logs.findIndex(l => l.name === user);
    if (idx !== -1) {
      month.logs.splice(idx, 1);
    }
  }

  // Kurangi hitungan sesi sementara
  sessionClickCount = Math.max(0, sessionClickCount - 1);
  updateSessionBadge();

  // Sembunyikan keterangan upload selesai saat dikurangi
  const notice = document.getElementById("uploadStatusNotice");
  if (notice) {
    notice.classList.add("hidden");
    notice.classList.remove("flex");
  }

  StorageManager.save(state.data);
  renderPresensiTab();
  showToast("1 hitungan adzan berhasil dikurangi (-1).");
}

function handleUploadAttendance() {
  const user = state.data.currentUser;
  if (!user) {
    showToast("Silakan login terlebih dahulu.", "error");
    return;
  }

  const btn = document.getElementById("btnUploadPresensi");
  const icon = document.getElementById("btnUploadIcon");
  const text = document.getElementById("btnUploadText");
  const notice = document.getElementById("uploadStatusNotice");

  if (btn) btn.disabled = true;
  if (icon) icon.className = "fa-solid fa-spinner fa-spin text-xs";
  if (text) text.textContent = "Mengunggah...";

  setTimeout(() => {
    StorageManager.save(state.data);

    // Hilangkan angka dan lingkaran "Tercatat" di pojok kiri atas setelah upload selesai
    sessionClickCount = 0;
    updateSessionBadge();

    if (btn) btn.disabled = false;
    if (icon) icon.className = "fa-solid fa-cloud-arrow-up text-xs";
    if (text) text.textContent = "Upload";

    if (notice) {
      notice.classList.remove("hidden");
      notice.classList.add("flex");
    }

    playSuccessSound();
    showToast(`Alhamdulillah! Upload selesai untuk ${user} ☁️`);
  }, 400);
}


function playSuccessSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

/**
 * =========================================================================
 * 4. TAB 2: TABEL REKAPITULASI BULANAN (KHUSUS ADMIN)
 * =========================================================================
 */
function renderRekapTab() {
  if (!state.isAdmin) return;

  const month = getActiveMonth();
  const counts = month.counts || {};
  const logs = month.logs || [];

  const rekapMonthSel = document.getElementById("rekapMonthSelect");
  if (rekapMonthSel) {
    rekapMonthSel.innerHTML = "";
    Object.values(state.data.months).forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name;
      if (m.id === state.data.activeMonth) opt.selected = true;
      rekapMonthSel.appendChild(opt);
    });
  }

  document.getElementById("tableMonthLabel").textContent = month.name;
  document.getElementById("printReportTitle").textContent = `REKAPITULASI UBUDIYAH BULANAN - ${month.name.toUpperCase()}`;

  let grandTotal = 0;
  let activeMembersCount = 0;
  const memberTotals = {};
  getMemberNames().forEach(name => {
    const val = counts[name] || 0;
    memberTotals[name] = val;
    grandTotal += val;
    if (val > 0) activeMembersCount++;
  });

  const sorted = Object.entries(memberTotals).sort((a, b) => b[1] - a[1]);
  const topMember = sorted.length > 0 && sorted[0][1] > 0 ? `${sorted[0][0]} (${sorted[0][1]}x)` : "-";

  document.getElementById("statGrandTotal").textContent = `${grandTotal}x`;
  document.getElementById("statTopMember").textContent = topMember;
  const statActiveElem = document.getElementById("statActiveMembersCount");
  if (statActiveElem) statActiveElem.textContent = `${activeMembersCount} Orang`;

  renderRekapTable();
}

function renderRekapTable() {
  if (!state.isAdmin) return;

  const month = getActiveMonth();
  const counts = month.counts || {};
  const logs = month.logs || [];
  const members = getMemberNames();

  const thead = document.getElementById("rekapTableHead");
  const tbody = document.getElementById("rekapTableBody");
  const tfoot = document.getElementById("rekapTableFoot");

  thead.innerHTML = `<tr>
    <th class="py-3 px-3 text-center w-12">No</th>
    <th class="py-3 px-3 w-40">Nama Petugas</th>
    <th class="py-3 px-3 text-center w-36 bg-emerald-50 text-emerald-900">Total 1 Bulan</th>
    <th class="py-3 px-3">Hari & Tanggal Bertugas</th>
    <th class="py-3 px-3 text-center w-36 no-print">Detail Riwayat</th>
    <th class="py-3 px-3 text-center w-24 no-print">Ubah (+/-)</th>
  </tr>`;

  const filteredMembers = state.searchQuery 
    ? members.filter(m => m.toLowerCase().includes(state.searchQuery))
    : members;

  tbody.innerHTML = "";
  if (filteredMembers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400">Tidak ada nama yang cocok.</td></tr>`;
    return;
  }

  let grandTotal = 0;

  filteredMembers.forEach((name, idx) => {
    const val = counts[name] || 0;
    grandTotal += val;

    // Ambil riwayat log petugas ini
    const memberLogs = logs.filter(l => l.name === name);

    // Hitung kemunculan per hari
    const dayCounts = {};
    memberLogs.forEach(l => {
      const d = l.day || "Hari";
      dayCounts[d] = (dayCounts[d] || 0) + 1;
    });

    const daysSummaryHtml = Object.entries(dayCounts).length > 0
      ? Object.entries(dayCounts).map(([d, c]) => 
          `<span class="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-bold mr-1 mb-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            ${d} <span class="text-emerald-700 font-extrabold">(${c}x)</span>
          </span>`
        ).join("")
      : (val > 0 
          ? `<span class="text-slate-400 text-xs italic">${val}x adzan tercatat</span>` 
          : `<span class="text-slate-300 text-xs">-</span>`);

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition-colors";
    tr.innerHTML = `
      <td class="py-3 px-3 text-center text-slate-400 font-medium">${idx + 1}</td>
      <td class="py-3 px-3 font-bold text-slate-800">${name}</td>
      <td class="py-3 px-3 text-center">
        <span class="inline-block px-3 py-1 rounded-xl font-black text-sm ${val > 0 ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' : 'bg-slate-100 text-slate-400'}">
          ${val}x
        </span>
      </td>
      <td class="py-3 px-3">
        <div class="flex flex-wrap items-center">
          ${daysSummaryHtml}
        </div>
      </td>
      <td class="py-3 px-3 text-center no-print">
        <button onclick="openMemberHistoryModal('${escapeName(name)}')" class="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1 mx-auto shadow-2xs cursor-pointer" title="Lihat detail riwayat hari & jam bertugas">
          <i class="fa-solid fa-clock-rotate-left text-[11px] text-emerald-600"></i>
          <span>Riwayat (${memberLogs.length})</span>
        </button>
      </td>
      <td class="py-3 px-3 text-center no-print">
        <div class="inline-flex items-center gap-1">
          <button onclick="manualAdjust('${escapeName(name)}', 1)" class="w-6 h-6 rounded bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 text-xs font-bold cursor-pointer" title="Tambah 1">+</button>
          <button onclick="manualAdjust('${escapeName(name)}', -1)" class="w-6 h-6 rounded bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 text-xs font-bold cursor-pointer" title="Kurangi 1">-</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tfoot.innerHTML = `<tr>
    <td colspan="2" class="py-3 px-3 text-right uppercase text-xs font-black tracking-wider text-slate-700">Total Adzan 1 Bulan:</td>
    <td class="py-3 px-3 text-center text-emerald-900 font-black text-base bg-emerald-100 border border-emerald-200">${grandTotal}x</td>
    <td colspan="3" class="no-print"></td>
  </tr>`;
}

function manualAdjust(name, delta) {
  if (!state.isAdmin) return;

  const month = getActiveMonth();
  if (!month) return;
  if (!month.counts) month.counts = {};

  const current = month.counts[name] || 0;
  const next = Math.max(0, current + delta);
  month.counts[name] = next;

  if (delta > 0) {
    const now = new Date();
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    if (!month.logs) month.logs = [];
    month.logs.unshift({
      id: Date.now(),
      name: name,
      day: days[now.getDay()],
      date: now.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
      time: now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      timestamp: Date.now()
    });
  } else if (delta < 0 && month.logs) {
    const idx = month.logs.findIndex(l => l.name === name);
    if (idx !== -1) month.logs.splice(idx, 1);
  }

  StorageManager.save(state.data);
  renderApp();
  showToast(`${name}: ${next} adzan (${month.name})`);
}

function copyWhatsAppSummary() {
  if (!state.isAdmin) return;

  const month = getActiveMonth();
  const counts = month.counts || {};
  const logs = month.logs || [];
  const members = getMemberNames();

  let grandTotal = 0;
  const sorted = members
    .map(name => {
      const c = counts[name] || 0;
      grandTotal += c;
      const memberLogs = logs.filter(l => l.name === name);
      const days = [...new Set(memberLogs.map(l => l.day).filter(Boolean))];
      return { name, count: c, days };
    })
    .filter(m => m.count > 0)
    .sort((a, b) => b.count - a.count);

  let text = `📋 *REKAPITULASI UBUDIYAH BULANAN*\n`;
  text += `📅 *Periode:* ${month.name}\n`;
  text += `📊 *Total Adzan:* ${grandTotal}x (${sorted.length} Petugas Bertugas)\n\n`;
  text += `*Perolehan Petugas:*\n`;

  if (sorted.length === 0) {
    text += `_(Belum ada data adzan pada bulan ini)_\n`;
  } else {
    sorted.forEach((m, idx) => {
      const icon = idx === 0 ? "🥇 " : idx === 1 ? "🥈 " : idx === 2 ? "🥉 " : `${idx + 1}. `;
      const daysStr = m.days.length > 0 ? ` _(Hari: ${m.days.join(", ")})_` : "";
      text += `${icon}*${m.name}*: ${m.count}x adzan${daysStr}\n`;
    });
  }

  text += `\n_Jazakumullah Khairan Katsiran_ ✨`;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showToast("Format teks WhatsApp berhasil disalin ke Clipboard!");
    }).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const temp = document.createElement("textarea");
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand("copy");
  document.body.removeChild(temp);
  showToast("Format teks WhatsApp berhasil disalin!");
}

function openMemberHistoryModal(name) {
  const modal = document.getElementById("memberHistoryModal");
  if (!modal) return;

  const month = getActiveMonth();
  const title = document.getElementById("memberHistoryTitle");
  const subtitle = document.getElementById("memberHistorySubtitle");
  const badge = document.getElementById("memberHistoryCountBadge");
  const list = document.getElementById("memberHistoryList");

  if (title) title.textContent = `Riwayat Bertugas: ${name}`;
  if (subtitle) subtitle.textContent = `Periode: ${month.name}`;

  const memberLogs = (month.logs || []).filter(l => l.name === name);
  const total = (month.counts && month.counts[name]) || memberLogs.length;

  if (badge) badge.textContent = `${total}x Adzan`;
  if (list) {
    list.innerHTML = "";
    if (memberLogs.length === 0) {
      list.innerHTML = `<div class="p-6 text-center text-slate-400 italic text-xs">Belum ada catatan detail riwayat waktu untuk ${name} pada bulan ${month.name}.</div>`;
    } else {
      memberLogs.forEach(l => {
        const item = document.createElement("div");
        item.className = "flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 text-xs";
        item.innerHTML = `
          <div class="flex items-center space-x-2.5">
            <span class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-[11px] shrink-0">
              ${(l.day || "Hari").slice(0, 3)}
            </span>
            <div>
              <p class="font-bold text-slate-800">${l.day ? l.day + ', ' : ''}${l.date || '-'}</p>
              <p class="text-[11px] text-slate-500 font-medium"><i class="fa-regular fa-clock mr-1 text-slate-400"></i>Pukul ${l.time || '-'} WIB</p>
            </div>
          </div>
          <button onclick="deleteLogEntry(${l.id}, '${escapeName(name)}')" class="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition cursor-pointer" title="Hapus catatan ini">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        `;
        list.appendChild(item);
      });
    }
  }

  modal.classList.remove("hidden");
}

function closeMemberHistoryModal() {
  const modal = document.getElementById("memberHistoryModal");
  if (modal) modal.classList.add("hidden");
}

function deleteLogEntry(logId, name) {
  if (!state.isAdmin) return;
  if (!confirm(`Hapus 1 catatan adzan ini untuk ${name}?`)) return;

  const month = getActiveMonth();
  const idx = (month.logs || []).findIndex(l => l.id == logId);
  if (idx !== -1) {
    month.logs.splice(idx, 1);
  }

  if (month.counts && month.counts[name] !== undefined) {
    month.counts[name] = Math.max(0, month.counts[name] - 1);
  }

  StorageManager.save(state.data);
  renderApp();
  openMemberHistoryModal(name);
  showToast(`1 catatan riwayat ${name} berhasil dihapus.`);
}

/**
 * =========================================================================
 * 5. TAB 3: KELOLA PETUGAS & MINGGU (KHUSUS ADMIN)
 * =========================================================================
 */
function renderKelolaTab() {
  if (!state.isAdmin) return;
  renderManageMembers();
  renderAdminMonthCards();
}

function renderManageMembers() {
  const container = document.getElementById("manageMembersList");
  if (!container) return;
  container.innerHTML = "";

  const members = state.data.members || DEFAULT_MEMBERS;
  members.forEach((m, idx) => {
    const name = typeof m === "object" ? m.name : m;
    const email = typeof m === "object" ? (m.email || "Belum ada email") : "Belum ada email";

    const card = document.createElement("div");
    card.className = "p-3.5 bg-slate-50 hover:bg-slate-100/90 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full sm:w-[calc(50%-0.4rem)] shadow-2xs transition";
    card.innerHTML = `
      <div class="flex items-center space-x-3 overflow-hidden min-w-0">
        <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-sm shrink-0">
          ${name.charAt(0).toUpperCase()}
        </div>
        <div class="min-w-0 flex-1">
          <h4 class="font-bold text-slate-800 text-sm truncate">${name}</h4>
          <p class="text-xs text-slate-500 font-medium truncate flex items-center gap-1.5 mt-0.5" title="${email}">
            <i class="fa-brands fa-google text-[11px] text-emerald-600 shrink-0"></i>
            <span class="truncate font-mono text-[11px] text-slate-600">${email}</span>
          </p>
        </div>
      </div>
      <div class="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
        <button onclick="openEditMemberModal(${idx})" class="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-2xs" title="Edit Nama & Email Petugas">
          <i class="fa-solid fa-pen-to-square text-emerald-600 text-[11px]"></i>
          <span>Edit</span>
        </button>
        <button onclick="removeMemberByIndex(${idx})" class="p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-300 rounded-xl text-xs transition" title="Hapus Petugas">
          <i class="fa-solid fa-trash-can text-xs"></i>
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function openAddMemberModal() {
  if (!state.isAdmin) return;
  const modal = document.getElementById("memberFormModal");
  if (!modal) return;

  document.getElementById("memberFormIndex").value = "-1";
  document.getElementById("memberFormTitle").textContent = "Tambah Petugas Baru";
  document.getElementById("memberFormSubmitText").textContent = "Daftarkan Petugas";
  document.getElementById("memberFormName").value = "";
  document.getElementById("memberFormEmail").value = "";

  modal.classList.remove("hidden");
  setTimeout(() => {
    const input = document.getElementById("memberFormName");
    if (input) input.focus();
  }, 100);
}

function openEditMemberModal(target) {
  if (!state.isAdmin) return;
  const modal = document.getElementById("memberFormModal");
  if (!modal) return;

  let idx = -1;
  if (typeof target === "number") {
    idx = target;
  } else {
    idx = (state.data.members || []).findIndex(m => (typeof m === "object" ? m.name : m) === target);
  }

  if (idx === -1 || !state.data.members[idx]) {
    showToast("Data petugas tidak ditemukan.", "error");
    return;
  }

  const obj = state.data.members[idx];
  const name = typeof obj === "object" ? obj.name : obj;
  const email = typeof obj === "object" ? (obj.email || "") : "";

  document.getElementById("memberFormIndex").value = String(idx);
  document.getElementById("memberFormTitle").textContent = `Edit Petugas: ${name}`;
  document.getElementById("memberFormSubmitText").textContent = "Simpan Perubahan";
  document.getElementById("memberFormName").value = name;
  document.getElementById("memberFormEmail").value = email;

  modal.classList.remove("hidden");
  setTimeout(() => {
    const emailInput = document.getElementById("memberFormEmail");
    if (emailInput) {
      emailInput.focus();
      emailInput.select();
    }
  }, 100);
}

function closeMemberFormModal() {
  const modal = document.getElementById("memberFormModal");
  if (modal) modal.classList.add("hidden");
}

function handleMemberFormSubmit(event) {
  if (event) event.preventDefault();
  if (!state.isAdmin) return;

  const idx = parseInt(document.getElementById("memberFormIndex").value, 10);
  const nameInput = document.getElementById("memberFormName");
  const emailInput = document.getElementById("memberFormEmail");

  const cleanName = (nameInput ? nameInput.value : "").trim();
  const cleanEmail = (emailInput ? emailInput.value : "").trim().toLowerCase();

  if (!cleanName) {
    showToast("Nama petugas tidak boleh kosong!", "error");
    if (nameInput) nameInput.focus();
    return;
  }
  if (!cleanEmail) {
    showToast("Email Google tidak boleh kosong!", "error");
    if (emailInput) emailInput.focus();
    return;
  }

  // Cek apakah email sudah dipakai oleh petugas LAIN
  const emailDuplicate = (state.data.members || []).some((m, mIdx) => {
    if (mIdx === idx) return false;
    const mEmail = typeof m === "object" ? (m.email || "") : "";
    return mEmail.trim().toLowerCase() === cleanEmail;
  });

  if (emailDuplicate) {
    showToast(`Email "${cleanEmail}" sudah digunakan oleh petugas lain!`, "error");
    if (emailInput) emailInput.select();
    return;
  }

  if (idx >= 0 && idx < (state.data.members || []).length) {
    // Mode EDIT
    const oldObj = state.data.members[idx];
    const oldName = typeof oldObj === "object" ? oldObj.name : oldObj;
    const oldEmail = typeof oldObj === "object" ? oldObj.email : "";

    state.data.members[idx] = { name: cleanName, email: cleanEmail };

    // Update jika nama berubah di data bulan
    if (cleanName !== oldName) {
      Object.values(state.data.months).forEach(m => {
        if (m.counts && m.counts[oldName] !== undefined) {
          m.counts[cleanName] = m.counts[oldName];
          delete m.counts[oldName];
        }
        if (m.logs) {
          m.logs.forEach(l => {
            if (l.name === oldName) l.name = cleanName;
          });
        }
      });
    }

    // Perbarui kaitan aktif di browser jika user yang sedang aktif diedit
    if (state.data.currentUser === oldName || state.data.currentEmail === oldEmail) {
      state.data.currentUser = cleanName;
      state.data.currentEmail = cleanEmail;
    }

    StorageManager.save(state.data);
    closeMemberFormModal();
    renderApp();
    showToast(`Data petugas "${cleanName}" (${cleanEmail}) berhasil diperbarui!`);
  } else {
    // Mode TAMBAH BARU
    const nameDuplicate = (state.data.members || []).some(m => {
      const mName = typeof m === "object" ? m.name : m;
      return mName.trim().toLowerCase() === cleanName.toLowerCase();
    });
    if (nameDuplicate) {
      showToast(`Nama "${cleanName}" sudah terdaftar!`, "error");
      if (nameInput) nameInput.select();
      return;
    }

    state.data.members.push({ name: cleanName, email: cleanEmail });
    StorageManager.save(state.data);
    closeMemberFormModal();
    renderApp();
    showToast(`Petugas baru "${cleanName}" (${cleanEmail}) berhasil didaftarkan!`);
  }
}

function removeMemberByIndex(idx) {
  if (!state.isAdmin) return;
  const obj = (state.data.members || [])[idx];
  if (!obj) return;
  const name = typeof obj === "object" ? obj.name : obj;

  if (confirm(`Yakin ingin menghapus petugas "${name}" dari daftar?`)) {
    state.data.members.splice(idx, 1);
    if (state.data.currentUser === name) {
      state.data.currentUser = null;
      state.data.currentEmail = null;
    }
    StorageManager.save(state.data);
    renderApp();
    showToast(`Petugas "${name}" telah dihapus.`);
  }
}

// Backward-compatible aliases
function promptNewMember() {
  openAddMemberModal();
}

function editMemberModal(oldName) {
  openEditMemberModal(oldName);
}

function removeMember(name) {
  const idx = (state.data.members || []).findIndex(m => (typeof m === "object" ? m.name : m) === name);
  if (idx !== -1) {
    removeMemberByIndex(idx);
  }
}

function renderAdminMonthCards() {
  const container = document.getElementById("adminMonthSelectorCards");
  if (!container) return;
  container.innerHTML = "";

  const months = Object.values(state.data.months || {});
  if (months.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic col-span-2 p-3">Belum ada periode bulan. Silakan tambah bulan baru.</p>`;
    return;
  }

  months.forEach(m => {
    const isActive = m.id === state.data.activeMonth;
    const totalAdzan = Object.values(m.counts || {}).reduce((a, b) => a + (Number(b) || 0), 0);
    const totalPetugas = Object.values(m.counts || {}).filter(c => c > 0).length;

    const card = document.createElement("div");
    card.className = `p-4 rounded-2xl border transition flex items-center justify-between ${
      isActive 
        ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20" 
        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
    }`;

    card.innerHTML = `
      <div>
        <div class="flex items-center gap-2">
          <h4 class="font-bold text-slate-800 text-sm">${m.name}</h4>
          ${isActive ? '<span class="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full">Bulan Aktif</span>' : ''}
        </div>
        <p class="text-xs text-slate-500 mt-0.5">
          <span class="font-semibold text-emerald-700">${totalAdzan}x</span> total adzan • <span class="font-semibold text-slate-700">${totalPetugas}</span> petugas aktif
        </p>
      </div>

      <div class="flex items-center space-x-1.5">
        ${!isActive ? `<button onclick="setActiveMonth('${m.id}')" class="px-3 py-1.5 bg-white hover:bg-emerald-600 hover:text-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer">Aktifkan</button>` : ''}
        <button onclick="editMonthName('${m.id}')" class="p-1.5 text-slate-400 hover:text-emerald-700 text-xs cursor-pointer" title="Ubah Nama Bulan"><i class="fa-solid fa-pen"></i></button>
        ${!isActive && Object.keys(state.data.months || {}).length > 1 ? `<button onclick="deleteMonth('${m.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 text-xs cursor-pointer" title="Hapus Periode Bulan"><i class="fa-solid fa-trash-can"></i></button>` : ''}
      </div>
    `;

    container.appendChild(card);
  });
}

function setActiveMonth(monthId) {
  if (!state.isAdmin) return;
  state.data.activeMonth = monthId;
  StorageManager.save(state.data);
  renderApp();
  showToast("Periode bulan aktif presensi telah diganti.");
}

function editMonthName(monthId) {
  if (!state.isAdmin) return;
  const m = state.data.months && state.data.months[monthId];
  if (!m) return;
  const newName = prompt("Ubah Nama Bulan & Tahun:", m.name);
  if (newName && newName.trim()) {
    m.name = newName.trim();
    StorageManager.save(state.data);
    renderApp();
    showToast("Nama bulan berhasil diperbarui.");
  }
}

function deleteMonth(monthId) {
  if (!state.isAdmin) return;
  const m = state.data.months && state.data.months[monthId];
  if (!m) return;
  if (confirm(`Yakin ingin menghapus periode "${m.name}" beserta seluruh data riwayatnya?`)) {
    delete state.data.months[monthId];
    if (state.data.activeMonth === monthId) {
      const remaining = Object.keys(state.data.months || {});
      state.data.activeMonth = remaining[0] || "2026-11";
    }
    StorageManager.save(state.data);
    renderApp();
    showToast(`Periode "${m.name}" telah dihapus.`);
  }
}

function promptNewMonth() {
  if (!state.isAdmin) return;

  const name = prompt("Nama Bulan & Tahun Baru (contoh: Desember 2026):");
  if (!name || !name.trim()) return;

  const id = "month_" + Date.now();
  if (!state.data.months) state.data.months = {};

  const initialCounts = {};
  (state.data.members || []).forEach(m => {
    const mName = typeof m === "object" ? m.name : m;
    initialCounts[mName] = 0;
  });

  state.data.months[id] = {
    id: id,
    name: name.trim(),
    counts: initialCounts,
    logs: []
  };

  state.data.activeMonth = id;
  StorageManager.save(state.data);
  renderApp();
  showToast(`Bulan "${name.trim()}" berhasil dibuat dan diaktifkan!`);
}

/**
 * =========================================================================
 * 6. TAB 4: DATABASE & EXCEL (KHUSUS ADMIN)
 * =========================================================================
 */
function renderDatabaseTab() {
  if (!state.isAdmin) return;
  document.getElementById("currentPinPreview").textContent = state.data.adminPin || "1234";
  const boundLabel = document.getElementById("deviceBoundUserLabel");
  if (boundLabel) {
    boundLabel.textContent = state.data.currentUser 
      ? `${state.data.currentUser} (${state.data.currentEmail || ''})` 
      : "Tidak Ada";
  }

  const bindSel = document.getElementById("bindDeviceSelect");
  if (bindSel) {
    bindSel.innerHTML = "";
    (state.data.members || []).forEach(m => {
      const name = typeof m === "object" ? m.name : m;
      const email = typeof m === "object" ? (m.email || "") : "";
      const opt = document.createElement("option");
      opt.value = email;
      opt.textContent = `${name} (${email})`;
      if (email === state.data.currentEmail) {
        opt.selected = true;
      }
      bindSel.appendChild(opt);
    });
  }
}

function bindDeviceToSelectedMember() {
  if (!state.isAdmin) return;
  const sel = document.getElementById("bindDeviceSelect");
  if (!sel || !sel.value) {
    showToast("Pilih petugas yang akan dikunci pada perangkat ini.", "error");
    return;
  }
  const email = sel.value;
  const matched = findMemberByEmail(email);
  if (!matched) {
    showToast("Petugas tidak ditemukan.", "error");
    return;
  }

  state.data.currentEmail = matched.email;
  state.data.currentUser = matched.name;
  sessionClickCount = 0;
  StorageManager.save(state.data);
  renderApp();
  showToast(`Berhasil! Browser HP ini dikunci untuk "${matched.name}". Setiap kali dibuka akan langsung masuk ke tombol adzan.`);
}

function resetDeviceAccount() {
  if (!state.isAdmin) return;
  if (confirm("Lepas kaitan akun petugas di perangkat ini? Perangkat ini akan kembali meminta login email saat mode petugas dibuka.")) {
    state.data.currentUser = null;
    state.data.currentEmail = null;
    sessionClickCount = 0;
    StorageManager.save(state.data);
    renderApp();
    showToast("Kaitan akun di perangkat ini telah dilepas!");
  }
}

function exportCurrentMonthExcel() {
  if (!state.isAdmin) return;
  const month = getActiveMonth();
  ExcelHandler.exportMonthToExcel(month, month.name);
  showToast("File Excel berhasil diunduh!");
}

async function handleExcelFile(e) {
  if (!state.isAdmin) return;
  const file = e.target.files[0];
  if (!file) return;

  try {
    const result = await ExcelHandler.importFromExcel(file);
    if (!result || !result.counts || Object.keys(result.counts).length === 0) {
      showToast("Gagal membaca data dari Excel.", "error");
      return;
    }

    const month = getActiveMonth();
    if (confirm(`Timpa data bulan ${month.name} dengan data dari file Excel?`)) {
      month.counts = result.counts;
      if (result.logs && result.logs.length > 0) {
        month.logs = result.logs;
      }

      // Pastikan semua nama di excel terdaftar di daftar anggota
      Object.keys(result.counts).forEach(name => {
        const exists = (state.data.members || []).some(m => (typeof m === 'object' ? m.name : m).toLowerCase() === name.toLowerCase());
        if (!exists) {
          state.data.members.push({
            name: name,
            email: `${name.toLowerCase().replace(/\s+/g, '')}@gmail.com`
          });
        }
      });

      StorageManager.save(state.data);
      renderApp();
      showToast("Sukses impor data dari Excel!");
      switchTab("rekap");
    }
  } catch (err) {
    alert("Gagal membaca Excel: " + err.message);
  } finally {
    e.target.value = "";
  }
}

function loadSampleText() {
  const sample = `List Rekap Ubudiyah
1. Arsal = 
2. Rohman = 
3. Alan = Zuhur, ashar, magrib, isya, ashar
4. Kang Angga =
5. Rizki = 
6. Kang Nabill = 
7. Tami = 
8. Radit = Zuhur, Asar, Maghrib,Isya
9. Rama = dzuhur, asar, maghrib, isya
10. Teguh = dzuhur, ashar, maghrib, isya`;

  document.getElementById("pasteTextInput").value = sample;
}

function processPastedText() {
  if (!state.isAdmin) return;

  const text = document.getElementById("pasteTextInput").value;
  if (!text.trim()) {
    showToast("Tempel teks terlebih dahulu!", "error");
    return;
  }

  const parsed = TextParser.parseFullText(text);
  if (!parsed || parsed.length === 0) {
    showToast("Tidak ada format rekap/minggu yang terdeteksi.", "error");
    return;
  }

  const month = getActiveMonth();
  if (!month.counts) month.counts = {};
  if (!month.logs) month.logs = [];

  let addedTotal = 0;
  parsed.forEach(p => {
    Object.entries(p.counts || {}).forEach(([name, count]) => {
      if (count > 0) {
        month.counts[name] = (month.counts[name] || 0) + count;
        addedTotal += count;
        
        for (let i = 0; i < count; i++) {
          month.logs.push({
            id: Date.now() + Math.floor(Math.random() * 100000),
            name: name,
            day: "Catatan WA",
            date: p.extractedDate || p.title || "Teks WA",
            time: "-",
            timestamp: Date.now()
          });
        }
      }

      const exists = (state.data.members || []).some(m => (typeof m === 'object' ? m.name : m).toLowerCase() === name.toLowerCase());
      if (!exists) {
        state.data.members.push({
          name: name,
          email: `${name.toLowerCase().replace(/\s+/g, '')}@gmail.com`
        });
      }
    });
  });

  StorageManager.save(state.data);
  renderApp();
  showToast(`Berhasil menambahkan ${addedTotal}x adzan ke bulan ${month.name}!`);
  switchTab("rekap");
}

function resetDataPrompt() {
  if (!state.isAdmin) return;

  if (confirm("Kembalikan data ke awal (contoh Juli 2026)?")) {
    state.data = StorageManager.reset();
    renderApp();
    showToast("Data telah direset ke bawaan.");
  }
}

function escapeName(name) {
  return name.replace(/'/g, "\\'");
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toastNotification");
  const msgElem = document.getElementById("toastMessage");
  if (!toast || !msgElem) return;

  msgElem.textContent = message;
  toast.classList.remove("hidden", "translate-y-10", "opacity-0");
  toast.classList.add("translate-y-0", "opacity-100");

  if (type === "error") {
    toast.classList.add("border-rose-500", "bg-rose-50", "text-rose-800");
    toast.classList.remove("border-emerald-500", "bg-white", "text-slate-800");
  } else {
    toast.classList.remove("border-rose-500", "bg-rose-50", "text-rose-800");
    toast.classList.add("border-emerald-500", "bg-white", "text-slate-800");
  }

  setTimeout(() => {
    toast.classList.add("translate-y-10", "opacity-0");
    setTimeout(() => toast.classList.add("hidden"), 300);
  }, 2800);
}
