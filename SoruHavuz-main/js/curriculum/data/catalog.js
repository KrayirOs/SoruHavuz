// Bu liste yerel Kazanımlar klasörünün açık manifestidir. Tarayıcı dizin
// listeleyemediği için dosyalar burada belirtilir; kaynak içerikleri değişmez.
export const CURRICULUM_DATASET_FILES = Object.freeze([
  "biyoloji.json", "cografya.json", "fizik.json", "kimya.json", "matematik.json", "tarih.json", "turk_dili_ve_edebiyati.json"
]);
export const CURRICULUM_DATASET_BASE_URL = new URL("../../../kazanımlar/", import.meta.url);
