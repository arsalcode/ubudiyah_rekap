/**
 * Modul Excel untuk Rekapitulasi Ubudiyah Simpel
 * Menggunakan SheetJS (XLSX)
 */

class ExcelHandler {
  /**
   * Ekspor Rekap Bulanan ke file .xlsx
   */
  static exportMonthToExcel(monthData, monthName = "Rekap-Ubudiyah") {
    if (typeof XLSX === "undefined") {
      alert("Library SheetJS (XLSX) belum siap.");
      return;
    }

    const wb = XLSX.utils.book_new();
    const weeks = monthData.weeks || [];

    // Kumpulkan semua nama petugas
    const allNames = new Set();
    weeks.forEach(w => {
      Object.keys(w.counts || {}).forEach(name => allNames.add(name));
    });

    // 1. DATA SHEET 1: REKAP BULANAN
    const headerRow = ["No", "Nama Petugas"];
    weeks.forEach((w, idx) => {
      headerRow.push(w.title || `Minggu ${idx + 1}`);
    });
    headerRow.push("Total Adzan Bulan Ini");

    const summaryRows = [
      ["REKAPITULASI UBUDIYAH (TOTAL ADZAN)"],
      [`Periode: ${monthData.name || monthName}`],
      [`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`],
      [],
      headerRow
    ];

    let no = 1;
    const weekTotals = new Array(weeks.length).fill(0);
    let grandTotal = 0;

    allNames.forEach(name => {
      const row = [no++, name];
      let memberTotal = 0;

      weeks.forEach((w, wIdx) => {
        const count = (w.counts && w.counts[name]) || 0;
        row.push(count);
        memberTotal += count;
        weekTotals[wIdx] += count;
      });

      row.push(memberTotal);
      grandTotal += memberTotal;
      summaryRows.push(row);
    });

    // Baris Total Bawah
    const totalRow = ["TOTAL", "Semua Petugas"];
    weekTotals.forEach(t => totalRow.push(t));
    totalRow.push(grandTotal);
    summaryRows.push(totalRow);

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    
    // Auto width
    const cols = [{ wch: 6 }, { wch: 22 }];
    weeks.forEach(() => cols.push({ wch: 14 }));
    cols.push({ wch: 20 });
    wsSummary["!cols"] = cols;

    XLSX.utils.book_append_sheet(wb, wsSummary, "Rekap Bulanan");

    // 2. DATA SHEET 2: RIWAYAT LOG
    const logRows = [
      ["RIWAYAT LOG KLIK PRESENSI ADZAN"],
      [`Periode: ${monthData.name || monthName}`],
      [],
      ["No", "Waktu", "Nama Petugas", "Minggu Ke", "Keterangan"]
    ];

    let logNo = 1;
    weeks.forEach(w => {
      (w.logs || []).forEach(lg => {
        logRows.push([
          logNo++,
          lg.time || "-",
          lg.name || "-",
          w.title || "-",
          "+1 Adzan"
        ]);
      });
    });

    const wsLog = XLSX.utils.aoa_to_sheet(logRows);
    wsLog["!cols"] = [{ wch: 6 }, { wch: 24 }, { wch: 20 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsLog, "Riwayat Log");

    const cleanFileName = `Rekap_Ubudiyah_${(monthData.name || "Bulan").replace(/\s+/g, "_")}.xlsx`;
    XLSX.writeFile(wb, cleanFileName);
  }

  /**
   * Impor dari file Excel
   */
  static async importFromExcel(file) {
    return new Promise((resolve, reject) => {
      if (typeof XLSX === "undefined") {
        return reject(new Error("SheetJS belum terpasang"));
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          
          const sheetName = workbook.Sheets["Rekap Bulanan"] ? "Rekap Bulanan" : workbook.SheetNames[0];
          const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
          
          // Cari header kolom
          let headerIdx = -1;
          for (let i = 0; i < json.length; i++) {
            if (json[i] && json[i][1] === "Nama Petugas") {
              headerIdx = i;
              break;
            }
          }

          if (headerIdx === -1) {
            throw new Error("Format kolom Excel tidak cocok. Pastikan ada kolom 'Nama Petugas'.");
          }

          const header = json[headerIdx];
          const weekNames = [];
          for (let c = 2; c < header.length; c++) {
            const colName = String(header[c] || "").trim();
            if (colName && !colName.toLowerCase().includes("total")) {
              weekNames.push({ colIndex: c, title: colName });
            }
          }

          const parsedWeeks = weekNames.map((w, idx) => ({
            id: `w_imp_${idx + 1}`,
            title: w.title,
            note: "Diimpor dari Excel",
            counts: {},
            logs: []
          }));

          for (let r = headerIdx + 1; r < json.length; r++) {
            const row = json[r];
            if (!row || !row[1] || String(row[0]).toUpperCase() === "TOTAL") continue;
            
            const memberName = String(row[1]).trim();
            weekNames.forEach((w, wIdx) => {
              const val = parseInt(row[w.colIndex], 10) || 0;
              parsedWeeks[wIdx].counts[memberName] = val;
            });
          }

          resolve(parsedWeeks);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  }
}
