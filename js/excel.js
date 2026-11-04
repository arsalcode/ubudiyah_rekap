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
    const counts = monthData.counts || {};
    const logs = monthData.logs || [];
    const allNames = Object.keys(counts);

    // 1. DATA SHEET 1: REKAP BULANAN
    const summaryRows = [
      ["REKAPITULASI UBUDIYAH BULANAN (TOTAL BERTUGAS)"],
      [`Periode: ${monthData.name || monthName}`],
      [`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`],
      [],
      ["No", "Nama Petugas", "Total Bertugas 1 Bulan", "Ringkasan Hari Bertugas"]
    ];

    let no = 1;
    let grandTotal = 0;

    allNames.forEach(name => {
      const total = counts[name] || 0;
      grandTotal += total;

      // Ambil daftar hari bertugas dari logs
      const memberLogs = logs.filter(l => l.name === name);
      const daysCount = {};
      memberLogs.forEach(l => {
        const d = l.day || "Hari";
        daysCount[d] = (daysCount[d] || 0) + 1;
      });
      const daysStr = Object.entries(daysCount)
        .map(([d, c]) => `${d} (${c}x)`)
        .join(", ") || (total > 0 ? `${total}x bertugas tercatat` : "-");

      summaryRows.push([no++, name, total, daysStr]);
    });

    summaryRows.push(["TOTAL", "Seluruh Petugas", grandTotal, ""]);

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary["!cols"] = [{ wch: 6 }, { wch: 22 }, { wch: 20 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Rekap Bulanan");

    // 2. DATA SHEET 2: RIWAYAT BERTUGAS LENGKAP
    const logRows = [
      ["RIWAYAT DETAIL PETUGAS BERTUGAS"],
      [`Periode: ${monthData.name || monthName}`],
      [],
      ["No", "Nama Petugas", "Hari", "Tanggal", "Jam WIB", "Keterangan"]
    ];

    let logNo = 1;
    logs.forEach(lg => {
      logRows.push([
        logNo++,
        lg.name || "-",
        lg.day || "-",
        lg.date || "-",
        lg.time ? `${lg.time} WIB` : "-",
        "+1 Bertugas"
      ]);
    });

    const wsLog = XLSX.utils.aoa_to_sheet(logRows);
    wsLog["!cols"] = [{ wch: 6 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsLog, "Riwayat Bertugas");

    const cleanFileName = `Rekap_Ubudiyah_${(monthData.name || "Bulan").replace(/\s+/g, "_")}.xlsx`;
    XLSX.writeFile(wb, cleanFileName);
  }

  /**
   * Impor dari file Excel (Mendukung format Rekap Bulanan baru dan lama)
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
            if (json[i] && (json[i][1] === "Nama Petugas" || json[i][0] === "Nama Petugas")) {
              headerIdx = i;
              break;
            }
          }

          if (headerIdx === -1) {
            throw new Error("Format kolom Excel tidak cocok. Pastikan ada kolom 'Nama Petugas'.");
          }

          const header = json[headerIdx];
          const nameColIdx = header[1] === "Nama Petugas" ? 1 : 0;
          const counts = {};
          const logs = [];

          // Cek apakah ada kolom "Total Bertugas" atau "Total Adzan"
          let totalColIdx = -1;
          for (let c = 0; c < header.length; c++) {
            const h = String(header[c] || "").toLowerCase();
            if (h.includes("total bertugas") || h.includes("total adzan") || (h.includes("total") && c > nameColIdx)) {
              totalColIdx = c;
              break;
            }
          }

          // Cek juga sheet "Riwayat Bertugas" jika ada
          if (workbook.Sheets["Riwayat Bertugas"]) {
            const logJson = XLSX.utils.sheet_to_json(workbook.Sheets["Riwayat Bertugas"], { header: 1 });
            let logHeaderIdx = -1;
            for (let i = 0; i < logJson.length; i++) {
              if (logJson[i] && logJson[i][1] === "Nama Petugas") {
                logHeaderIdx = i;
                break;
              }
            }
            if (logHeaderIdx !== -1) {
              for (let r = logHeaderIdx + 1; r < logJson.length; r++) {
                const row = logJson[r];
                if (!row || !row[1]) continue;
                logs.push({
                  id: Date.now() + r,
                  name: String(row[1]).trim(),
                  day: String(row[2] || "-").trim(),
                  date: String(row[3] || "-").trim(),
                  time: String(row[4] || "-").replace(/WIB/i, "").trim(),
                  timestamp: Date.now()
                });
              }
            }
          }

          for (let r = headerIdx + 1; r < json.length; r++) {
            const row = json[r];
            if (!row || !row[nameColIdx] || String(row[0]).toUpperCase() === "TOTAL" || String(row[nameColIdx]).toUpperCase() === "TOTAL") continue;
            
            const memberName = String(row[nameColIdx]).trim();
            if (totalColIdx !== -1) {
              counts[memberName] = parseInt(row[totalColIdx], 10) || 0;
            } else {
              let sum = 0;
              for (let c = nameColIdx + 1; c < row.length; c++) {
                sum += parseInt(row[c], 10) || 0;
              }
              counts[memberName] = sum;
            }
          }

          resolve({ counts, logs });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  }
}
