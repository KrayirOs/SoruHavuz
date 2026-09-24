// ============================================================================
// core/constants.js
//
// Uygulama genelindeki sabitler. Sprint 1 hedefi: ders/sinav agaci ARTIK
// koda gomulu degil ("hardcoded matematik") - genisletilebilir bir yapida.
// Yeni bir sinav (LGS, KPSS...) veya ders eklemek burada tek satirlik olmali.
// ============================================================================

export const EXAM_TYPES = Object.freeze({
  TYT: "TYT",
  AYT: "AYT"
});

// Ders agaci. "id" alani Dexie index'lerinde kullanilir
// stabil anahtar; "name" ise UI'da gosterilecek Turkce etiket.
// Bu liste ileride ayri bir "subjects" tablosuna tasinabilir (kullanici
// kendi derslerini eklerse); simdilik statik ve yeterli.
export const SUBJECT_TREE = Object.freeze({
  [EXAM_TYPES.TYT]: [
    { id: "turkish", name: "Türkçe" },
    { id: "mathematics", name: "Matematik" },
    { id: "physics", name: "Fizik" },
    { id: "chemistry", name: "Kimya" },
    { id: "biology", name: "Biyoloji" },
    { id: "history", name: "Tarih" },
    { id: "geography", name: "Coğrafya" },
    { id: "philosophy", name: "Felsefe" },
    { id: "religion", name: "Din Kültürü" }
  ],
  [EXAM_TYPES.AYT]: [
    { id: "mathematics", name: "Matematik" },
    { id: "physics", name: "Fizik" },
    { id: "chemistry", name: "Kimya" },
    { id: "biology", name: "Biyoloji" },
    { id: "literature", name: "Edebiyat" },
    { id: "history", name: "Tarih" },
    { id: "geography", name: "Coğrafya" }
  ]
});

// Konu listesi baslangicta bos/kucuk tutuluyor - kullanici serbest metin
// olarak da girebilir (bkz. question-model.js). Burada sadece ornek/onerilen
// Konu listeleri kullanici secimi ve arama icin tutulur.
export const TOPIC_SUGGESTIONS = Object.freeze({
  mathematics: ["Fonksiyonlar", "Polinomlar", "Türev", "İntegral", "Geometri", "Olasılık"],
  physics: ["Kuvvet ve Hareket", "Elektrik", "Optik", "Dalgalar"],
  chemistry: ["Atom Yapısı", "Kimyasal Tepkimeler", "Asit-Baz"],
  biology: ["Hücre", "Genetik", "Sistemler"],
  turkish: ["Anlam Bilgisi", "Dil Bilgisi", "Paragraf"],
  history: ["Kronoloji", "Osmanlı", "Cumhuriyet Dönemi"],
  geography: ["İklim", "Nüfus", "Haritalar"]
});

export function getSubjectsForExam(examType) {
  return SUBJECT_TREE[examType] || [];
}

export function getTopicSuggestions(subjectId) {
  return TOPIC_SUGGESTIONS[subjectId] || [];
}

// Zorluk artik 1-5 olceginde (eski easy/medium/hard yerine) - rapor bunu
// Zorluk kullanici tarafindan belirlenir.
export const DIFFICULTY_SCALE = Object.freeze([1, 2, 3, 4, 5]);

export const DIFFICULTY_LABELS = Object.freeze({
  1: "Çok Kolay",
  2: "Kolay",
  3: "Orta",
  4: "Zor",
  5: "Çok Zor"
});

export function isValidDifficultyValue(value) {
  return DIFFICULTY_SCALE.includes(Number(value));
}

export const SOURCE_TYPES = Object.freeze({
  PHOTO: "photo",
  MANUAL: "manual",
  IMPORT: "import"
});

export const ASSET_TYPES = Object.freeze({
  ORIGINAL: "original",
  PROCESSED: "processed",
  THUMBNAIL: "thumbnail"
});
