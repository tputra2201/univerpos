# Aplikasi POS Fleksibel untuk UKM (Versi 1 — Offline)

Aplikasi kasir yang bisa dipakai kuliner/kafe, retail/toko, maupun jasa/salon. Semua data
tersimpan di perangkat (offline), dengan struktur yang siap ditambah akun online nanti.

## Alur pertama kali dipakai

1. **Aktivasi dengan kode toko** — aplikasi tidak bisa dipakai sebelum pemilik memasukkan
   kode aktivasi toko. Kode tersimpan di perangkat; tanpa kode, aplikasi hanya menampilkan
   layar aktivasi.
2. **Pilih tipe usaha** — Kuliner, Retail, atau Jasa. Pilihan ini mengatur fitur yang tampil
   (meja & pesanan dapur untuk kuliner, barcode & stok untuk retail, layanan & staf untuk jasa).
   Bisa diubah kapan saja di Pengaturan.
3. **Buat PIN/akun kasir** — pemilik (akses penuh) dan kasir (akses terbatas).

Catatan soal kode aktivasi: di versi offline, kode diperiksa di perangkat sehingga sifatnya
pembatas ringan. Kalau nanti diaktifkan mode online, kode bisa diverifikasi dari server agar
benar-benar tidak bisa dipakai tanpa izin. Saran saya: mulai seperti ini sekarang.

## Halaman yang dibuat

- **Login** — daftar pengguna + PIN, tombol ganti pengguna, kunci layar saat idle.
- **Kasir (POS)** — grid produk untuk tablet, daftar untuk HP; pencarian & kategori; keranjang
  dengan qty, catatan item, diskon per item dan per transaksi, pajak opsional, layanan/pembulatan.
  Kuliner: pilih meja/nomor antrean dan tombol "Kirim ke Dapur". Retail: input barcode cepat.
  Jasa: pilih layanan + staf pelaksana.
- **Pembayaran** — tunai (hitung kembalian), QRIS, kartu/debit, transfer, dan metode custom
  buatan sendiri; bisa split dua metode.
- **Struk & cetak** — pratinjau struk 58mm/80mm lalu cetak lewat dialog perangkat (selalu
  tersedia), plus opsi kirim langsung ke printer Bluetooth ESC/POS bila perangkat mendukung
  (Chrome Android/desktop; tidak tersedia di iPhone). Template: Struk, Bill sementara,
  Tiket pesanan dapur, Label cup, Laporan X/Z.
- **Produk** — kategori dan item, harga, varian/opsi, satuan, stok (retail), gambar opsional,
  aktif/nonaktif, impor-ekspor daftar produk.
- **Transaksi** — riwayat, detail, cetak ulang, refund/void dengan alasan.
- **Laporan** — ringkasan harian & shift: omzet, jumlah transaksi, rincian per metode
  pembayaran, produk terlaris, buka/tutup kasir dengan kas awal dan selisih.
- **Pengaturan** — identitas toko (nama, alamat, telepon, logo), tipe usaha, pajak & layanan,
  pengguna & hak akses, metode pembayaran, printer (lebar kertas, header 1/2, footer, margin,
  cetak otomatis saat bayar), meja (kuliner), backup & restore file data, kode toko.

## Desain

Tampilan kasir gelap-terang dengan target tombol besar agar nyaman disentuh di tablet dan HP,
satu identitas warna khas (bukan template ungu-putih generik), angka besar dan mudah dibaca
dari jarak kerja kasir.

## Detail teknis

- TanStack Start + React, semua data di IndexedDB lewat satu lapisan repository sehingga
  penggantian ke Lovable Cloud nanti hanya menyentuh lapisan itu.
- State kasir di TanStack Query dengan persist ke penyimpanan lokal (keranjang tidak hilang saat refresh).
- Gate aktivasi + sesi pengguna sebagai layout route; semua halaman kerja ada di bawahnya.
- Cetak: generator ESC/POS (bytes, CP437, auto-cut) dipakai bersama oleh jalur Web Bluetooth
  dan jalur render HTML 58/80mm untuk dialog cetak.
- Backup: ekspor seluruh data ke satu file `.posbak` (JSON terkompresi) dan restore dengan
  mengganti seluruh isi database.

## Di luar versi 1

Sinkronisasi multi-perangkat, akun online, Google Drive backup, program loyalitas, dan
manajemen pemasok/pembelian — ditambahkan setelah versi offline stabil.
