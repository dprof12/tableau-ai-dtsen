# 🏛️ Tableau AI DTSEN — Multi-Topic Insight Extension

Ekstensi Tableau AI generasi terbaru khusus untuk **Executive Dashboard DTSEN (Data Terpadu Sosial Ekonomi Nasional / Perlindungan Sosial)** Pemerintah Provinsi DKI Jakarta.

Ekstensi ini menggunakan arsitektur **Single-Box Dynamic Container** dengan **5 Interactive Pill Switchers**, memberikan kemudahan bagi pengambil keputusan (Pimpinan/Eksekutif) untuk membedah data dari berbagai sudut pandang strategis dalam 1 klik tanpa harus membaca teks narasi yang kepanjangan.

---

## 🔘 5 Tombol Perspektif Strategis

1. **🌐 [ Ringkasan ] (`overview`):**
   * Total agregat populasi (10 Jt jiwa / 3,4 Jt KK) dan tingkat penetrasi keseluruhan program perlindungan sosial di DKI Jakarta (**49,00%** individu, **59,56%** keluarga).
2. **👥 [ Profil Desil ] (`desil`):**
   * Ketepatan sasaran desil 1–4 (**56,87%**) vs potensi *inclusion error* di desil 7–10 (**43,40%**).
3. **📍 [ Sebaran Wilayah ] (`wilayah`):**
   * Beban geografis terbesar (Jakarta Timur **2,9 Jt** & Jakarta Barat **2,3 Jt**) vs wilayah dengan penetrasi persentase tertinggi (Jakarta Pusat **52,87%**).
4. **🔀 [ Usia & Multi-Bansos ] (`integrasi`):**
   * Pola siklus hidup usia penerima bansos (pelajar di KJP, produktif di PDPEMDA, lansia di KLJ) serta dominasi 88% penerima tunggal vs multi-program.
5. **💰 [ Alokasi Anggaran ] (`anggaran`):**
   * Rasio serapan anggaran rupiah (KJP menyerap porsi terbesar **Rp3,24 Triliun** meski penerima terbanyak adalah PDPEMDA **4,3 Juta jiwa**).
6. **⚠️ [ Temuan & Anomali ] (`temuan`):**
   * Audit mendalam **Exclusion Error** (estimasi **51,60%** warga Desil 1 miskin yang belum tersentuh bantuan), **Inclusion Error** (**43,40%** penerima berada di kelompok mapan Desil 7–10), serta indikasi tumpang tindih ekstrem penerima 3 hingga 4 program bansos.

---

## 🏗️ Struktur Proyek

```
tableau-ai-dtsen/
├── manifest/
│   └── tableau-ai-dtsen.trex              # Manifest siap drag ke Tableau Dashboard
├── public/
│   ├── css/
│   │   └── style.css                      # Styling minimalis, transparent background & modern pill tabs
│   ├── js/
│   │   ├── app.js                         # Core logic, topic switcher & smart in-memory cache
│   │   └── tableau.extensions.1.latest.js # Tableau JS SDK
│   ├── ui.html                            # UI container utama
│   └── index.html                         # Entry point identik
├── api/
│   ├── generate-dtsen-insight.js          # Serverless function (Vercel)
│   └── prompts/
│       └── dtsenPromptEngine.js           # Engine prompt khusus 5 topik DTSEN
├── package.json
└── vercel.json                            # Timeout 30s & CORS configuration
```

---

## 🚀 Panduan Pemasangan di Tableau Dashboard

1. **Buka Tableau Desktop / Server:**
   * Buka workbook/dashboard *Executive Dashboard DTSEN*.
2. **Tambahkan Objek Extension:**
   * Tarik objek **Extension** dari panel kiri ke kanvas dashboard (posisikan di bagian samping KPI, atas, atau bawah).
   * Pilih **Access Local Extension** lalu pilih file `manifest/tableau-ai-dtsen.trex`.
3. **Selesai!**
   * Ekstensi akan otomatis mendeteksi data lembar kerja dan langsung menampilkan 5 tombol topik interaktif yang terhubung langsung dengan filter dashboard.

---

## 🔑 Environment Variables (Vercel)

| Variabel | Pilihan Nilai | Keterangan |
| :--- | :--- | :--- |
| `AI_PROVIDER` | `gemini` / `openrouter` / `openai` | Default: `gemini` |
| `GEMINI_API_KEY` | `AIzaSy...` | API Key Google AI Studio |
| `OPENROUTER_API_KEY`| `sk-or-v1-...` | API Key OpenRouter |
| `AI_MODEL` | `gemini-2.5-flash` / `google/gemini-2.5-flash` | Model GenAI aktif |
