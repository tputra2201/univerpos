# Pengamanan data POS
- [x] Pengaman server untuk penghapusan eksplisit, pembatasan penghapusan massal, dan arsip perubahan.
- [x] Hapus inferensi penghapusan dari basis sinkron; lindungi perpindahan store dan data lokal kosong.
- [x] Cadangan lokal otomatis saat Close Out/End of Day dan unduh arsip.
- [x] Uji aturan keselamatan dan alur cadangan; periksa hasil aplikasi.

## Pembatalan pembayaran dan konfirmasi
- [ ] Pembayaran item terpisah tidak mengubah pesanan sebelum lunas; pembatalan mengembalikan keranjang utuh.
- [ ] Konfirmasi aksi yang mengubah transaksi dan pengaturan, tanpa meminta konfirmasi sinkronisasi otomatis.
- [ ] Uji pembatalan, penyelesaian pembayaran terpisah, dan penolakan konfirmasi.