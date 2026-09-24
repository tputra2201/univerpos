# Varian, Ukuran, Topping & Modifier Produk

## Perbedaan (untuk admin)
- **Varian, Ukuran, Topping** — diatur di dalam satu produk saja. Kalau produk lain butuh pilihan yang sama, harus diisi lagi di produk tersebut.
- **Modifier** — dibuat sekali di tab Modifier, lalu tinggal dicentang di produk mana pun. Mengubah isi modifier (mis. tambah "Extra Ice") otomatis berlaku di semua produk yang memakainya.

## Yang dibuat

### 1. Halaman Produk → tab baru "Modifier"
- Daftar modifier: nama (Ice Doze, Sugar Doze, Condiment), jumlah pilihan, dan berapa produk memakainya.
- Tambah / edit / hapus modifier. Isi modifier berupa daftar pilihan: nama + harga tambahan (0 = gratis), contoh Less Ice (0), More Milk (2.000), Jahe (3.000).
- Pengaturan per modifier: **Wajib pilih** atau opsional, dan **Boleh pilih lebih dari satu** (mis. Condiment) atau hanya satu (mis. Ice Doze).
- Hapus modifier yang masih dipakai meminta konfirmasi dan otomatis dilepas dari produk.

### 2. Form edit produk
Tiga bagian yang bisa ditambah/edit/hapus: **Varian**, **Ukuran**, **Topping** (masing-masing nama + harga tambahan). Bagian **Modifier**: centang dari daftar modifier yang sudah dibuat; bisa pilih beberapa.

### 3. Kasir
Saat produk yang punya pilihan ditekan, muncul satu jendela berisi:
- Varian (pilih satu), Ukuran (pilih satu), Topping (boleh beberapa), lalu tiap Modifier sesuai aturannya.
- Harga total diperbarui langsung; tombol Tambah nonaktif bila ada pilihan wajib yang belum dipilih.
- Di keranjang, struk, tiket dapur, dan pesanan Diproses, pilihan tampil di bawah nama item, mis. "Es Kopi Susu · Large · Less Ice, Jahe".
- Item dengan pilihan berbeda menjadi baris terpisah di keranjang.

### 4. Data lama
Varian yang sudah ada di produk tetap terbawa sebagai Varian. Backup/restore dan impor-ekspor produk ikut menyertakan data baru.

## Detail teknis
- `types.ts`: `Modifier {id, name, required, multiple, options: {id,name,price}[]}`; `Product` + `sizes: Variant[]`, `toppings: Variant[]`, `modifierIds: string[]` (opsional, default []); `PosDatabase.modifiers?: Modifier[]`.
- `CartLine.variantName` tetap dipakai sebagai label gabungan pilihan (kompatibel dengan struk & laporan lama); tambah `options?: {group,name,price}[]` untuk rincian. `unitPrice` = harga + total tambahan.
- Pencocokan baris keranjang memakai label gabungan.
- `produk.tsx`: tab Modifier + editor per produk; `index.tsx`: ganti dialog varian dengan dialog pilihan lengkap; `receipt.ts` sudah membaca `variantName`.
