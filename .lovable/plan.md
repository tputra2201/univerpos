# Data Terpusat untuk Store Mode Online

Store dengan mode **Online** memakai satu data bersama di server pusat. Semua perangkat aktif di store itu melihat produk, kategori, modifier, pengguna, meja, pesanan tertahan, pesanan dapur, transaksi, dan laporan yang sama. Store mode **Offline** tetap seperti sekarang, dengan data hanya di perangkat.

## Cara kerja untuk pengguna

- **Tetap jalan saat internet putus.** Setiap perangkat menyimpan salinan data. Transaksi saat offline masuk antrean, lalu otomatis terkirim saat internet kembali.
- **Perubahan langsung sampai.** Produk baru, pesanan dari HP pelayan, atau pesanan dapur muncul di perangkat lain dalam beberapa detik.
- **Perangkat pertama jadi sumber data.** Saat store online pertama kali tersambung, data dari perangkat pertama diunggah. Perangkat kedua dan seterusnya langsung mengunduh data itu saat aktivasi, jadi tidak perlu mengisi produk dan pengguna lagi.
- **Tanda sinkron di header:** "Tersinkron", "Menyinkronkan…" atau "N perubahan menunggu internet".
- **Di /kontrol:** kartu store online menampilkan jumlah produk dan transaksi di server, serta waktu sinkron terakhir.
- **Ganti mode Offline ke Online** di /kontrol: data perangkat berikutnya yang tersambung diunggah sebagai data awal.

## Aturan bentrok

Kalau dua perangkat mengubah data yang sama, perubahan terakhir yang dipakai. Transaksi dan nomor order tidak pernah bentrok. Setiap transaksi punya kode unik, dan nomor order diberi akhiran kode perangkat bila perlu, supaya dua kasir tidak menghasilkan nomor yang sama.

## Detail teknis

- Tabel baru `store_records` (store_id, collection, record_id, data jsonb, deleted, updated_at, device_id), dengan kunci unik (store_id, collection, record_id). Sinkronisasi dilakukan per baris data, bukan satu dokumen utuh.
- Koleksi yang disinkronkan: products, categories, modifiers, users, tables, paymentMethods, serviceTypes, onlineChannels, staff, heldOrders, kitchenOrders, sales, shifts, voids, dan settings (satu record).
- Akses lewat fungsi SECURITY DEFINER yang memeriksa kode store + token perangkat aktif: `sync_push(_code,_token,_records jsonb)` dan `sync_pull(_code,_token,_since timestamptz)`. Tidak ada akses tabel langsung untuk anon.
- Realtime: fungsi `sync_pull` dipanggil saat ada sinyal broadcast channel `store:<code>` yang dikirim setiap push. Data mentah tidak disiarkan ke publik, dan ada polling cadangan setiap 20 detik.
- Klien: `src/lib/pos/sync.ts` membandingkan db sebelum dan sesudah `update()` untuk mendeteksi record yang berubah. Record berubah masuk antrean outbox di IndexedDB, di-push saat online, lalu hasil pull digabung ke db lokal. `store.tsx` memanggil modul sync hanya bila `settings.storeMode === "online"`.
- `activate_device` mengembalikan tanda `has_server_data`. Kalau bernilai true, perangkat baru melewati langkah pembuatan pemilik/PIN dan langsung menarik data.
- Backup/restore tetap ada. Restore di store online meminta konfirmasi karena akan menimpa data pusat.

## Di luar lingkup

Penggabungan data dua store berbeda, dan riwayat versi per record.
