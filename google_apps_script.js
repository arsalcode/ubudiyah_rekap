/**
 * ===================================================================
 * BACKEND GOOGLE SHEETS UNTUK APLIKASI PRESENSI & REKAP UBUDIYAH
 * ===================================================================
 * 
 * PANDUAN CARA PASANG (HANYA SEKALI, 2 MENIT):
 * 1. Buka Google Spreadsheet baru di Google Drive Anda (beri nama misal: "Rekap Presensi Ubudiyah").
 * 2. Di menu atas Spreadsheet, klik 'Ekstensi' (Extensions) -> 'Apps Script'.
 * 3. Hapus semua teks yang ada di editor Apps Script, lalu tempel (PASTE) seluruh kode file ini.
 * 4. Klik ikon disket 'Simpan' (Save).
 * 5. Klik tombol biru di pojok kanan atas: 'Terapkan' (Deploy) -> 'Penerapan baru' (New deployment).
 * 6. Klik ikon Roda Gigi (Pilih Jenis) -> Pilih 'Aplikasi web' (Web app).
 * 7. Pada konfigurasi:
 *    - Deskripsi: Presensi Ubudiyah Cloud
 *    - Jalankan sebagai (Execute as): Saya (Me / email Google Anda)
 *    - Siapa yang memiliki akses (Who has access): Siapa saja (Anyone) -> PENTING!
 * 8. Klik tombol 'Terapkan' (Deploy).
 * 9. Klik 'Beri akses' (Authorize access) -> pilih akun Google Anda -> klik 'Advanced' -> klik 'Go to ... (unsafe)' -> klik 'Allow'.
 * 10. Salin "URL Aplikasi Web" yang muncul (panjangnya sekitar 80 karakter, berakhiran /exec).
 * 11. Buka Website Ubudiyah Anda -> Masuk Admin -> Tab 'Database & Excel' -> Tempel URL tersebut di kotak "Koneksi Google Sheets" lalu klik Simpan.
 * 
 * Selesai! Semua HP petugas & HP admin sekarang otomatis terhubung online!
 */

const SHEET_REKAP = "Rekap_Bulanan";
const SHEET_LOGS = "Riwayat_Log";
const SHEET_STATE = "Data_Sistem";

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    initSheetsIfNeeded(ss);

    const action = (e && e.parameter && e.parameter.action) || "get_all";

    if (action === "test") {
      return createJsonResponse({ status: "success", message: "Koneksi ke Google Sheets Berhasil!", timestamp: Date.now() });
    }

    // Ambil data sistem tersimpan
    const stateData = getSavedSystemState(ss);
    return createJsonResponse({
      status: "success",
      activeMonth: stateData.activeMonth || "2026-11",
      months: stateData.months || {},
      members: stateData.members || []
    });
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    initSheetsIfNeeded(ss);

    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action || "upload_attendance";

    if (action === "upload_attendance") {
      const result = recordAttendance(ss, payload);
      return createJsonResponse({ status: "success", message: "Presensi berhasil dicatat di Google Sheets", result: result });
    }

    if (action === "sync_state") {
      saveSystemState(ss, payload.state);
      return createJsonResponse({ status: "success", message: "Data sistem berhasil diperbarui di Google Sheets" });
    }

    if (action === "delete_log") {
      deleteSingleLog(ss, payload.logId, payload.monthId, payload.name);
      return createJsonResponse({ status: "success", message: "Catatan riwayat berhasil dihapus" });
    }

    return createJsonResponse({ status: "error", message: "Aksi tidak dikenali: " + action });
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

// ===================================================================
// FUNGSI INTI LOGIKA DATA
// ===================================================================

function recordAttendance(ss, payload) {
  const monthId = payload.monthId || "2026-11";
  const monthName = payload.monthName || "November 2026";
  const name = payload.name;
  const email = payload.email || "-";
  const count = Number(payload.count) || 1;
  const logs = payload.logs || [];

  if (!name) throw new Error("Nama petugas wajib diisi.");

  // 1. Tulis setiap log ke Sheet Riwayat_Log
  const logSheet = ss.getSheetByName(SHEET_LOGS);
  const now = new Date();
  const timeFormatted = Utilities.formatDate(now, "Asia/Jakarta", "dd/MM/yyyy HH:mm:ss");

  logs.forEach(function (l) {
    logSheet.appendRow([
      l.id || Date.now(),
      timeFormatted,
      l.day || "-",
      l.date || "-",
      l.time || "-",
      name,
      email,
      monthName,
      "+1 Bertugas"
    ]);
  });

  // 2. Perbarui State Sistem
  const stateData = getSavedSystemState(ss);
  if (!stateData.months) stateData.months = {};
  if (!stateData.months[monthId]) {
    stateData.months[monthId] = { id: monthId, name: monthName, counts: {}, logs: [] };
  }

  const m = stateData.months[monthId];
  if (!m.counts) m.counts = {};
  if (!m.logs) m.logs = [];

  m.counts[name] = (Number(m.counts[name]) || 0) + count;

  // Sisipkan logs di depan
  logs.forEach(function (l) {
    m.logs.unshift(l);
  });

  saveSystemState(ss, stateData);

  // 3. Update Sheet Rekap_Bulanan (Human-friendly)
  updateRekapBulananSheet(ss, stateData);

  return {
    monthId: monthId,
    name: name,
    newTotal: m.counts[name]
  };
}

function updateRekapBulananSheet(ss, stateData) {
  const sheet = ss.getSheetByName(SHEET_REKAP);
  sheet.clearContents();

  // Header
  sheet.appendRow(["REKAPITULASI UBUDIYAH (TOTAL BERTUGAS)"]);
  sheet.appendRow(["Update Terakhir: " + Utilities.formatDate(new Date(), "Asia/Jakarta", "dd MMMM yyyy HH:mm") + " WIB"]);
  sheet.appendRow([]);
  sheet.appendRow(["No", "Nama Petugas", "Bulan / Periode", "Total Bertugas", "Keterangan"]);

  const headerRange = sheet.getRange(4, 1, 1, 5);
  headerRange.setBackground("#059669");
  headerRange.setFontColor("#FFFFFF");
  headerRange.setFontWeight("bold");

  let no = 1;
  const months = stateData.months || {};
  Object.values(months).forEach(function (m) {
    const counts = m.counts || {};
    Object.keys(counts).forEach(function (pName) {
      const c = counts[pName];
      if (c > 0) {
        sheet.appendRow([no++, pName, m.name, c + "x Bertugas", "Tercatat Online"]);
      }
    });
  });
}

function deleteSingleLog(ss, logId, monthId, name) {
  const stateData = getSavedSystemState(ss);
  if (stateData.months && stateData.months[monthId]) {
    const m = stateData.months[monthId];
    if (m.logs) {
      const idx = m.logs.findIndex(function(l) { return String(l.id) === String(logId); });
      if (idx !== -1) {
        m.logs.splice(idx, 1);
      }
    }
    if (m.counts && m.counts[name] !== undefined) {
      m.counts[name] = Math.max(0, (Number(m.counts[name]) || 0) - 1);
    }
    saveSystemState(ss, stateData);
    updateRekapBulananSheet(ss, stateData);
  }

  // Hapus juga di sheet Riwayat_Log jika ditemukan ID yang cocok
  const logSheet = ss.getSheetByName(SHEET_LOGS);
  const data = logSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(logId)) {
      logSheet.deleteRow(i + 1);
      break;
    }
  }
}

function getSavedSystemState(ss) {
  const stateSheet = ss.getSheetByName(SHEET_STATE);
  const val = stateSheet.getRange(1, 1).getValue();
  if (!val) {
    return {
      activeMonth: "2026-11",
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
        }
      }
    };
  }
  try {
    return JSON.parse(val);
  } catch (e) {
    return {};
  }
}

function saveSystemState(ss, stateData) {
  const stateSheet = ss.getSheetByName(SHEET_STATE);
  stateSheet.getRange(1, 1).setValue(JSON.stringify(stateData));
}

function initSheetsIfNeeded(ss) {
  if (!ss.getSheetByName(SHEET_REKAP)) {
    const s = ss.insertSheet(SHEET_REKAP);
    s.appendRow(["REKAPITULASI UBUDIYAH (TOTAL BERTUGAS)"]);
  }
  if (!ss.getSheetByName(SHEET_LOGS)) {
    const s = ss.insertSheet(SHEET_LOGS);
    s.appendRow(["ID", "Waktu Input", "Hari", "Tanggal", "Jam", "Nama Petugas", "Email", "Periode Bulan", "Status"]);
    const r = s.getRange(1, 1, 1, 9);
    r.setBackground("#0284c7");
    r.setFontColor("#FFFFFF");
    r.setFontWeight("bold");
  }
  if (!ss.getSheetByName(SHEET_STATE)) {
    const s = ss.insertSheet(SHEET_STATE);
    s.hideSheet(); // Sembunyikan agar rapi
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
