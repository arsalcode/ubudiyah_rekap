/**
 * Parser Cerdas untuk Teks Rekap Ubudiyah
 * Mampu membaca format teks dari WhatsApp / Catatan dan menghitung jumlah adzan per orang.
 */

class TextParser {
  /**
   * Ekstrak jumlah adzan dari teks baris
   * Baik berupa daftar nama sholat ("zuhur, ashar, isya") maupun angka langsung
   */
  static countPrayers(rawText) {
    if (!rawText || !rawText.trim()) return 0;
    const clean = rawText.trim();

    // Jika langsung berupa angka (contoh: "Alan = 5" atau "5x")
    const numMatch = clean.match(/^(\d+)\s*(?:x|kali)?$/i);
    if (numMatch) {
      return parseInt(numMatch[1], 10);
    }

    // Jika berupa daftar nama sholat (contoh: "zuhur, ashar, magrib, isya, ashar")
    const regex = /\b(subuh|shubuh|subh|zuhur|dzuhur|dhuhur|dhuhr|zuhr|ashar|asar|ashr|asr|maghrib|magrib|mgrb|isya'|isya|isyak|isyaa|jumat|jum'at)\b/gi;
    const matches = clean.match(regex);
    if (matches) {
      return matches.length;
    }

    // Jika dipisah dengan koma tapi kata bebas
    const parts = clean.split(/[,;\/]+/).map(s => s.trim()).filter(s => s.length > 0);
    return parts.length;
  }

  /**
   * Parse satu baris anggota: "3. Alan = Zuhur, ashar, magrib, isya, ashar"
   */
  static parseLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Pola umum: [nomor.] [Nama] = [Daftar Sholat / Jumlah]
    const lineRegex = /^(?:\d+[\.\)]\s*)?([^=:]+?)\s*(?:=|:)\s*(.*)$/;
    const match = trimmed.match(lineRegex);

    if (match) {
      const name = match[1].trim();
      const rawDetails = match[2].trim();
      const count = this.countPrayers(rawDetails);
      return {
        name,
        count,
        raw: rawDetails
      };
    }

    return null;
  }

  /**
   * Memecah teks utuh menjadi blok per minggu jika user menempel beberapa minggu sekaligus
   */
  static splitIntoWeekBlocks(fullText) {
    const lines = fullText.split(/\r?\n/);
    const blocks = [];
    let currentBlock = null;

    const headerRegex = /^(?:list\s+)?minggu\b/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (headerRegex.test(line)) {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = {
          header: line,
          lines: []
        };
      } else {
        if (!currentBlock) {
          currentBlock = {
            header: "Data Input Mingguan",
            lines: []
          };
        }
        currentBlock.lines.push(line);
      }
    }

    if (currentBlock) {
      blocks.push(currentBlock);
    }

    return blocks;
  }

  /**
   * Parse teks penuh
   */
  static parseFullText(fullText) {
    const blocks = this.splitIntoWeekBlocks(fullText);
    const results = [];

    blocks.forEach((block, idx) => {
      const weekTitle = block.header;
      const counts = {};
      const parsedMembers = [];

      const dateMatch = block.header.match(/(\d{1,2}\s+[a-zA-Z]+\s+\d{4})/i);
      const extractedDate = dateMatch ? dateMatch[1].replace(/\s+/g, " ").trim() : "";

      block.lines.forEach((line) => {
        const item = this.parseLine(line);
        if (item) {
          counts[item.name] = item.count;
          parsedMembers.push(item);
        }
      });

      results.push({
        index: idx + 1,
        title: weekTitle,
        extractedDate: extractedDate,
        counts: counts,
        membersCount: parsedMembers.length,
        totalAdzan: Object.values(counts).reduce((acc, curr) => acc + curr, 0),
        details: parsedMembers
      });
    });

    return results;
  }
}
