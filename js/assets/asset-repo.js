// ============================================================================
// assets/asset-repo.js
//
// Gorseller (original/processed/thumbnail) sorunun kendisinden AYRI bir
// tabloda tutulur. Neden: soru dokumanini her okudugumuzda kocaman bir
// Blob tasimak istemiyoruz (liste ekrani, filtreleme vb. hizli kalmali).
// question.question.assets.{original,processed,thumbnail} alanlari sadece
// bu tablodaki id'lere referans tutar.
// ============================================================================

import { db, RepoError } from "../db/dexie-db.js";
import { ASSET_TYPES } from "../core/constants.js";

function isValidAssetType(type) {
  return Object.values(ASSET_TYPES).includes(type);
}

/**
 * @param {number|null} questionId - Soru henuz olusturulmadiysa null olabilir;
 *   bu durumda cagiran taraf donen asset id'sini soru olusturulunca baglar.
 * @param {string} type - "original" | "processed" | "thumbnail"
 * @param {Blob} blob
 * @param {{width?: number, height?: number, mimeType?: string}} meta
 */
export async function saveAsset(questionId, type, blob, meta = {}) {
  if (!(blob instanceof Blob)) {
    throw new RepoError("saveAsset: blob bir Blob/File olmali.");
  }
  if (!isValidAssetType(type)) {
    throw new RepoError(`saveAsset: gecersiz asset tipi '${type}'.`);
  }

  const record = {
    questionId: questionId ?? null,
    type,
    blob,
    width: meta.width ?? null,
    height: meta.height ?? null,
    mimeType: meta.mimeType || blob.type || "application/octet-stream",
    size: blob.size,
    processing: meta.processing || null,
    quality: meta.quality || null,
    createdAt: Date.now()
  };

  const id = await db.assets.add(record);
  return { id, ...record };
}

export async function getAsset(id) {
  if (id == null) return null;
  return db.assets.get(Number(id));
}

export async function getAssetsForQuestion(questionId) {
  return db.assets.where("questionId").equals(Number(questionId)).toArray();
}

/** Bir soru silindiginde ona ait tum gorselleri de temizler. */
export async function deleteAssetsForQuestion(questionId) {
  const assets = await getAssetsForQuestion(questionId);
  await db.assets.bulkDelete(assets.map((a) => a.id));
  return assets.length;
}

/** Yeni olusturulan bir sorunun assets id'lerini gercek questionId ile baglar. */
export async function relinkAssetsToQuestion(assetIds, questionId) {
  const ids = assetIds.filter((id) => id != null);
  if (!ids.length) return;
  await db.assets.where("id").anyOf(ids).modify({ questionId: Number(questionId) });
}

/** Gecici goruntuleme icin object URL uretir - cagiran taraf revokeObjectURL etmeli. */
export function assetToObjectURL(assetRecord) {
  if (!assetRecord?.blob) return null;
  return URL.createObjectURL(assetRecord.blob);
}
