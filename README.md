# 🕌 Presensi & Rekap Ubudiyah (Sistem Email Google & Pemisahan Role)

Aplikasi web presensi dan rekapitulasi ubudiyah (jadwal adzan) dengan **pemisahan hak akses ketat antara Petugas dan Admin**:

---

## 👥 1. Hak Akses Petugas (Super Simpel & Terkunci Otomatis)

1. **Autentikasi Email Google Petugas**:
   - Petugas memasukkan email Google (Chrome) yang **sudah didaftarkan oleh Admin**.
   - Jika email terdaftar, sistem langsung mengarahkan ke tombol milik petugas tersebut.
   - **Terkunci Otomatis**: Petugas tidak bisa memilih atau berpindah ke akun orang lain. Sekali masuk di Chrome HP, akun tersimpan otomatis.
   - Jika ada yang memasukkan email yang tidak terdaftar, akses **otomatis ditolak**.

2. **Tombol 1-Klik "SAYA ADZAN (+1)"**:
   - Tampilan bersih dan bebas distraksi (hanya nama petugas, status terverifikasi, dan tombol raksasa hijau).
   - Setiap kali klik, hitungan adzan otomatis tercatat ke rekap minggu aktif tanpa perlu memilih waktu sholat.

3. **Indikator Sesi Sementara (Bulat di Pojok Kiri Atas)**:
   - Menampilkan jumlah klik pada sesi tersebut (misal: `1x`, `2x`).
   - Angka ini bersifat **sementara** dan otomatis hilang saat halaman direfresh atau browser ditutup.

4. **Batalkan Klik (-1)**:
   - Kotak merah solid di bawah tombol untuk membatalkan jika petugas salah pencet.

---

## 👑 2. Hak Akses Admin / Pengurus DKM (Dengan PIN)

Admin masuk melalui tombol **"🔒 Masuk Admin"** di pojok kanan atas:
- **PIN Default Awal**: `1234` *(bisa diubah di menu Database & Pengaturan).*
- **Fitur Khusus Admin**:
  1. 📊 **Tabel Rekapitulasi Lengkap**: Melihat seluruh akumulasi adzan semua petugas per minggu dan total akhir bulan.
  2. 👥 **Kelola Petugas & Email Google**:
     - Mendaftarkan petugas baru lengkap dengan email Google.
     - Mengubah nama dan email Google petugas yang sudah ada.
     - Menghapus petugas.
  3. 📅 **Atur Minggu Berjalan**: Menentukan minggu mana yang aktif untuk pencatatan tombol adzan.
  4. 📥 **Database Excel (.xlsx)**: Mengunduh master file Excel (Rekap Bulanan & Riwayat) dan mengimpor file Excel.
  5. 📋 **Salin Format WhatsApp**: 1-klik untuk menyalin laporan rapi berformat tebal untuk dikirimkan ke grup WA pengurus.
  6. 🖨️ **Cetak / PDF**: Format cetak resmi lengkap dengan kolom tanda tangan Ketua DKM dan Sekretaris.
  7. 🔓 **Lepas Kaitan Akun HP**: Fitur bagi admin untuk melepaskan kaitan akun petugas di browser/HP jika perangkat berpindah tangan.

---

## 🚀 Cara Menjalankan

1. Buka folder `ubudiyah_rekap`.
2. Klik ganda file **`index.html`** di browser komputer atau HP Anda.
3. Langsung terbuka tanpa perlu instalasi apapun.

---

## 🌐 Cara Deploy Online Gratis (Agar Bisa Diakses Seluruh Petugas di HP)

### Opsi Termudah: Netlify Drop (10 Detik)
1. Kunjungi [app.netlify.com/drop](https://app.netlify.com/drop).
2. Tarik (*drag & drop*) folder `ubudiyah_rekap` ke browser.
3. Website Anda langsung online dan mendapatkan alamat link gratis yang bisa dibagikan ke semua petugas.
