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
      const defaultId = "2026-07";
      state.data.months[defaultId] = {
        id: defaultId,
        name: "Juli 2026",
        weeks: []
      };
      state.data.activeMonth = defaultId;
    }
  }
  return state.data.months[state.data.activeMonth];
}

function getActiveWeek() {
  const month = getActiveMonth();
  const weeks = month.weeks || [];
  if (weeks.length === 0) return null;

  let activeW = weeks.find(w => w.id === state.data.activeWeekId);
  if (!activeW) {
    activeW = weeks[0];
    state.data.activeWeekId = activeW.id;
  }
  return activeW;
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
      const month = getActiveMonth();
      if (month.weeks && month.weeks.length > 0) {
        state.data.activeWeekId = month.weeks[0].id;
      }
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

    const activeW = getActiveWeek();
    if (!activeW) {
      showToast("Belum ada minggu aktif di sistem. Hubungi Admin.", "error");
      return;
    }

    if (!activeW.counts) activeW.counts = {};
    activeW.counts[user] = (activeW.counts[user] || 0) + 1;

    // Catat log
    if (!activeW.logs) activeW.logs = [];
    const now = new Date();
    activeW.logs.unshift({
      id: Date.now(),
      name: user,
      time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      date: now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
    });

    // Tambah hitungan sesi sementara (di sebelah kiri tombol)
    sessionClickCount++;
    updateSessionBadge();

    StorageManager.save(state.data);
    playSuccessSound();
    renderPresensiTab();
    showToast(`Alhamdulillah! +1 Adzan berhasil dicatat untuk ${user} 🕌`);
  });
}

function undoLastAdzan() {
  const user = state.data.currentUser;
  const activeW = getActiveWeek();
  if (!user || !activeW) return;

  const currentCount = (activeW.counts && activeW.counts[user]) || 0;
  if (currentCount <= 0) {
    showToast("Hitungan adzan Anda sudah 0.", "error");
    return;
  }

  activeW.counts[user] = currentCount - 1;

  if (activeW.logs) {
    const idx = activeW.logs.findIndex(l => l.name === user);
    if (idx !== -1) {
      activeW.logs.splice(idx, 1);
    }
  }

  // Kurangi hitungan sesi sementara
  sessionClickCount = Math.max(0, sessionClickCount - 1);
  updateSessionBadge();

  StorageManager.save(state.data);
  renderPresensiTab();
  showToast("1 hitungan adzan berhasil dibatalkan (-1).");
}

function renderUserLogs(activeW, user) {
  const container = document.getElementById("userLogList");
  const countLabel = document.getElementById("logCountLabel");
  if (!container || !activeW) return;

  const userLogs = (activeW.logs || []).filter(l => l.name === user);
  countLabel.textContent = `${userLogs.length} Catatan`;
  container.innerHTML = "";

  if (userLogs.length === 0) {
    container.innerHTML = `<p class="text-slate-400 italic py-2 text-center">Belum ada riwayat klik pada minggu ini.</p>`;
    return;
  }

  userLogs.slice(0, 5).forEach(l => {
    const item = document.createElement("div");
    item.className = "flex items-center justify-between py-1.5 px-3 bg-slate-50 rounded-xl border border-slate-100";
    item.innerHTML = `
      <span class="font-medium text-slate-700"><i class="fa-regular fa-clock text-emerald-600 mr-1.5"></i> ${l.date}, pukul ${l.time} WIB</span>
      <span class="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[10px]">+1 Adzan</span>
    `;
    container.appendChild(item);
  });
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
 * 4. TAB 2: TABEL REKAPITULASI (KHUSUS ADMIN)
 * =========================================================================
 */
function renderRekapTab() {
  if (!state.isAdmin) return;

  const month = getActiveMonth();
  const weeks = month.weeks || [];

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
  document.getElementById("printReportTitle").textContent = `REKAPITULASI UBUDIYAH (TOTAL ADZAN) - ${month.name.toUpperCase()}`;

  let grandTotal = 0;
  const memberTotals = {};
  getMemberNames().forEach(name => {
    memberTotals[name] = 0;
  });

  weeks.forEach(w => {
    Object.entries(w.counts || {}).forEach(([name, count]) => {
      if (memberTotals[name] === undefined) memberTotals[name] = 0;
      memberTotals[name] += count;
      grandTotal += count;
    });
  });

  const sorted = Object.entries(memberTotals).sort((a, b) => b[1] - a[1]);
  const topMember = sorted.length > 0 && sorted[0][1] > 0 ? `${sorted[0][0]} (${sorted[0][1]}x)` : "-";

  document.getElementById("statGrandTotal").textContent = `${grandTotal}x`;
  document.getElementById("statTopMember").textContent = topMember;
  document.getElementById("statWeeksCount").textContent = `${weeks.length} Minggu`;

  renderRekapTable();
}

function renderRekapTable() {
  if (!state.isAdmin) return;

  const month = getActiveMonth();
  const weeks = month.weeks || [];
  const members = getMemberNames();

  const thead = document.getElementById("rekapTableHead");
  const tbody = document.getElementById("rekapTableBody");
  const tfoot = document.getElementById("rekapTableFoot");

  let headerHtml = `<tr>
    <th class="py-3 px-3 text-center w-12">No</th>
    <th class="py-3 px-3 w-40">Nama Petugas</th>`;
  
  weeks.forEach((w, idx) => {
    headerHtml += `<th class="py-3 px-3 text-center">${w.title || `Minggu ${idx + 1}`}</th>`;
  });

  headerHtml += `<th class="py-3 px-3 text-center w-28 bg-emerald-50 text-emerald-900">Total Bulan</th>
    <th class="py-3 px-3 text-center w-24 no-print">Ubah (+/-)</th>
  </tr>`;
  thead.innerHTML = headerHtml;

  const filteredMembers = state.searchQuery 
    ? members.filter(m => m.toLowerCase().includes(state.searchQuery))
    : members;

  tbody.innerHTML = "";
  if (filteredMembers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${weeks.length + 4}" class="text-center py-6 text-slate-400">Tidak ada nama yang cocok.</td></tr>`;
    return;
  }

  const weekSums = new Array(weeks.length).fill(0);
  let grandTotal = 0;

  filteredMembers.forEach((name, idx) => {
    let rowTotal = 0;
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition-colors";

    let rowHtml = `
      <td class="py-2.5 px-3 text-center text-slate-400 font-medium">${idx + 1}</td>
      <td class="py-2.5 px-3 font-bold text-slate-800">${name}</td>
    `;

    weeks.forEach((w, wIdx) => {
      const val = (w.counts && w.counts[name]) || 0;
      rowTotal += val;
      weekSums[wIdx] += val;
      rowHtml += `<td class="py-2.5 px-3 text-center font-semibold ${val > 0 ? 'text-emerald-700 bg-emerald-50/30' : 'text-slate-300'}">${val}</td>`;
    });

    grandTotal += rowTotal;

    rowHtml += `
      <td class="py-2.5 px-3 text-center font-black ${rowTotal > 0 ? 'text-emerald-800 bg-emerald-100/60' : 'text-slate-300'}">
        ${rowTotal}
      </td>
      <td class="py-2.5 px-3 text-center no-print">
        <div class="inline-flex items-center gap-1">
          <button onclick="manualAdjust('${escapeName(name)}', 1)" class="w-6 h-6 rounded bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 text-xs font-bold" title="Tambah 1 ke minggu aktif">+</button>
          <button onclick="manualAdjust('${escapeName(name)}', -1)" class="w-6 h-6 rounded bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 text-xs font-bold" title="Kurangi 1 dari minggu aktif">-</button>
        </div>
      </td>
    `;

    tr.innerHTML = rowHtml;
    tbody.appendChild(tr);
  });

  let footHtml = `<tr>
    <td colspan="2" class="py-3 px-3 text-right uppercase text-xs tracking-wider">Total Adzan:</td>`;
  
  weekSums.forEach(sum => {
    footHtml += `<td class="py-3 px-3 text-center text-emerald-800 font-bold">${sum}</td>`;
  });

  footHtml += `<td class="py-3 px-3 text-center text-emerald-900 font-black bg-emerald-100">${grandTotal}</td>
    <td class="no-print"></td>
  </tr>`;
  tfoot.innerHTML = footHtml;
}

function manualAdjust(name, delta) {
  if (!state.isAdmin) return;

  const activeW = getActiveWeek();
  if (!activeW) return;
  if (!activeW.counts) activeW.counts = {};

  const current = activeW.counts[name] || 0;
  const next = Math.max(0, current + delta);
  activeW.counts[name] = next;

  StorageManager.save(state.data);
  renderApp();
  showToast(`${name}: ${next} adzan (${activeW.title})`);
}

function copyWhatsAppSummary() {
  if (!state.isAdmin) return;

  const month = getActiveMonth();
  const weeks = month.weeks || [];
  const members = getMemberNames();

  const memberTotals = {};
  let grandTotal = 0;
  members.forEach(m => memberTotals[m] = 0);

  weeks.forEach(w => {
    Object.entries(w.counts || {}).forEach(([m, count]) => {
      if (memberTotals[m] === undefined) memberTotals[m] = 0;
      memberTotals[m] += count;
      grandTotal += count;
    });
  });

  const sorted = Object.entries(memberTotals)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  let text = `📋 *REKAPITULASI UBUDIYAH (TOTAL ADZAN)*\n`;
  text += `📅 *Periode:* ${month.name}\n`;
  text += `📊 *Total Adzan:* ${grandTotal}x (${weeks.length} Minggu)\n\n`;
  text += `*Perolehan Petugas:*\n`;

  if (sorted.length === 0) {
    text += `_(Belum ada data adzan)_\n`;
  } else {
    sorted.forEach(([name, count], idx) => {
      const icon = idx === 0 ? "🥇 " : idx === 1 ? "🥈 " : idx === 2 ? "🥉 " : `${idx + 1}. `;
      text += `${icon}*${name}*: ${count}x adzan\n`;
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

/**
 * =========================================================================
 * 5. TAB 3: KELOLA PETUGAS & MINGGU (KHUSUS ADMIN)
 * =========================================================================
 */
function renderKelolaTab() {
  if (!state.isAdmin) return;
  renderManageMembers();
  renderAdminWeekCards();
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

    // Update jika nama berubah di data bulan/minggu
    if (cleanName !== oldName) {
      Object.values(state.data.months).forEach(m => {
        (m.weeks || []).forEach(w => {
          if (w.counts && w.counts[oldName] !== undefined) {
            w.counts[cleanName] = w.counts[oldName];
            delete w.counts[oldName];
          }
          if (w.logs) {
            w.logs.forEach(l => {
              if (l.name === oldName) l.name = cleanName;
            });
          }
        });
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

function renderAdminWeekCards() {
  const container = document.getElementById("adminWeekSelectorCards");
  if (!container) return;
  container.innerHTML = "";

  const month = getActiveMonth();
  const weeks = month.weeks || [];

  weeks.forEach(w => {
    const isActive = w.id === state.data.activeWeekId;
    const card = document.createElement("div");
    card.className = `p-4 rounded-2xl border transition flex items-center justify-between ${
      isActive 
        ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20" 
        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
    }`;

    card.innerHTML = `
      <div>
        <div class="flex items-center gap-2">
          <h4 class="font-bold text-slate-800 text-sm">${w.title}</h4>
          ${isActive ? '<span class="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full">Aktif Presensi</span>' : ''}
        </div>
        <p class="text-xs text-slate-500 mt-0.5">${w.note || 'Tidak ada catatan tanggal'}</p>
      </div>

      <div class="flex items-center space-x-1.5">
        ${!isActive ? `<button onclick="setActiveWeek('${w.id}')" class="px-3 py-1.5 bg-white hover:bg-emerald-600 hover:text-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition">Aktifkan</button>` : ''}
        <button onclick="editWeekNote('${w.id}')" class="p-1.5 text-slate-400 hover:text-emerald-700 text-xs" title="Ubah Judul/Tanggal"><i class="fa-solid fa-pen"></i></button>
      </div>
    `;

    container.appendChild(card);
  });
}

function setActiveWeek(weekId) {
  if (!state.isAdmin) return;
  state.data.activeWeekId = weekId;
  StorageManager.save(state.data);
  renderApp();
  showToast("Minggu aktif untuk presensi telah diganti.");
}

function editWeekNote(weekId) {
  if (!state.isAdmin) return;
  const month = getActiveMonth();
  const w = (month.weeks || []).find(item => item.id === weekId);
  if (!w) return;

  const newTitle = prompt("Nama Minggu:", w.title);
  if (newTitle) w.title = newTitle;
  const newNote = prompt("Catatan Tanggal:", w.note || "");
  if (newNote !== null) w.note = newNote;

  StorageManager.save(state.data);
  renderApp();
  showToast("Informasi minggu diperbarui.");
}

function promptNewWeek() {
  if (!state.isAdmin) return;

  const month = getActiveMonth();
  const nextNum = (month.weeks || []).length + 1;
  const title = prompt("Nama Minggu (contoh: Minggu Ke-" + nextNum + "):", "Minggu Ke-" + nextNum);
  if (!title) return;
  const note = prompt("Catatan tanggal (contoh: Mulai 26 Juli 2026):", "");

  const newWeek = {
    id: "w_" + Date.now(),
    title: title,
    note: note || "",
    counts: {},
    logs: []
  };

  month.weeks.push(newWeek);
  state.data.activeWeekId = newWeek.id;
  StorageManager.save(state.data);
  renderApp();
  showToast("Minggu baru berhasil ditambahkan!");
}

function promptNewMonth() {
  if (!state.isAdmin) return;

  const name = prompt("Nama Bulan & Tahun (contoh: Agustus 2026):");
  if (!name || !name.trim()) return;

  const id = "month_" + Date.now();
  state.data.months[id] = {
    id: id,
    name: name.trim(),
    weeks: [
      {
        id: "w_1",
        title: "Minggu Ke-1",
        note: "Mulai awal bulan",
        counts: {},
        logs: []
      }
    ]
  };

  state.data.activeMonth = id;
  state.data.activeWeekId = "w_1";
  StorageManager.save(state.data);
  renderApp();
  showToast(`Bulan "${name}" berhasil dibuat!`);
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
    const parsedWeeks = await ExcelHandler.importFromExcel(file);
    if (!parsedWeeks || parsedWeeks.length === 0) {
      showToast("Gagal membaca minggu dari Excel.", "error");
      return;
    }

    const month = getActiveMonth();
    if (confirm(`Ditemukan ${parsedWeeks.length} data minggu. Timpa ke bulan ${month.name}?`)) {
      month.weeks = parsedWeeks;
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
  const sample = `List Minggu Pertama Mulai Tanggal minggu 28 Juni 2026
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
    showToast("Tidak ada format minggu yang terdeteksi.", "error");
    return;
  }

  const month = getActiveMonth();
  parsed.forEach(p => {
    const newW = {
      id: "w_paste_" + Date.now() + "_" + p.index,
      title: p.title,
      note: p.extractedDate || "",
      counts: p.counts,
      logs: []
    };
    month.weeks.push(newW);

    Object.keys(p.counts).forEach(name => {
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
  showToast(`Berhasil menambahkan ${parsed.length} minggu ke rekap!`);
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
