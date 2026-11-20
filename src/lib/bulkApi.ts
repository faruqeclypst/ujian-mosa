// Helper operasi massal lewat endpoint native (/api/bulk/*): satu request +
// satu transaksi di server untuk ratusan/ribuan record, menggantikan loop
// create/delete per-record yang lambat.
// Fallback ke operasi per-record HANYA bila endpoint belum tersedia (404,
// tenant versi lama) dan belum ada chunk yang berhasil — jadi tidak ada
// risiko data ganda bila respons hilang di tengah jalan.

export interface BulkCreateResult {
  created: number;
  ids: string[];
  errors: { index: number; message: string }[];
}

export interface BulkDeleteResult {
  deleted: number;
  errors: { id: string; message: string }[];
}

export interface BulkUpdateResult {
  updated: number;
  errors: { index: number; id: string; message: string }[];
}

export async function bulkUpdateOrFallback(
  pb: any,
  collection: string,
  records: { id: string;[key: string]: any }[]
): Promise<BulkUpdateResult> {
  const errors: { index: number; id: string; message: string }[] = [];
  let updated = 0;
  if (!records.length) return { updated, errors };

  let endpointMissing = false;
  for (let i = 0; i < records.length; i += 1000) {
    const chunk = records.slice(i, i + 1000);
    try {
      const res: any = await pb.send("/api/bulk/update", {
        method: "POST",
        body: { collection, records: chunk },
      });
      if (res?.ok) {
        updated += res.updated || 0;
        (res.errors || []).forEach((e: any) =>
          errors.push({ index: i + (e.index || 0), id: e.id || "", message: e.message }));
        continue;
      }
      throw new Error("bulk update: respons tidak ok");
    } catch (err: any) {
      if (err?.status === 404 && updated === 0 && errors.length === 0) {
        endpointMissing = true;
        break;
      }
      console.error("Bulk update gagal pada chunk:", err);
      chunk.forEach((r, j) => errors.push({ index: i + j, id: r.id, message: String(err?.message || err) }));
    }
  }

  if (endpointMissing) {
    for (let idx = 0; idx < records.length; idx++) {
      const { id, ...fields } = records[idx];
      try {
        await pb.collection(collection).update(id, fields);
        updated++;
      } catch (e: any) {
        errors.push({ index: idx, id, message: String(e?.message || e) });
      }
    }
  }
  return { updated, errors };
}

export async function bulkCreateOrFallback(
  pb: any,
  collection: string,
  records: any[]
): Promise<BulkCreateResult> {
  const errors: { index: number; message: string }[] = [];
  const ids: string[] = [];
  let created = 0;
  if (!records.length) return { created, ids, errors };

  let endpointMissing = false;
  for (let i = 0; i < records.length; i += 1000) {
    const chunk = records.slice(i, i + 1000);
    try {
      const res: any = await pb.send("/api/bulk/create", {
        method: "POST",
        body: { collection, records: chunk },
      });
      if (res?.ok) {
        created += res.created || 0;
        (res.ids || []).forEach((id: string) => ids.push(id));
        (res.errors || []).forEach((e: any) =>
          errors.push({ index: i + (e.index || 0), message: e.message }));
        continue;
      }
      throw new Error("bulk create: respons tidak ok");
    } catch (err: any) {
      if (err?.status === 404 && created === 0 && errors.length === 0) {
        endpointMissing = true;
        break;
      }
      console.error("Bulk create gagal pada chunk:", err);
      chunk.forEach((_, j) => errors.push({ index: i + j, message: String(err?.message || err) }));
    }
  }

  if (endpointMissing) {
    for (let idx = 0; idx < records.length; idx++) {
      try {
        const rec = await pb.collection(collection).create(records[idx]);
        created++;
        if (rec?.id) ids.push(rec.id);
      } catch (e: any) {
        errors.push({ index: idx, message: String(e?.message || e) });
      }
    }
  }
  return { created, ids, errors };
}

export async function bulkDeleteOrFallback(
  pb: any,
  collection: string,
  idsToDelete: string[]
): Promise<BulkDeleteResult> {
  const errors: { id: string; message: string }[] = [];
  let deleted = 0;
  if (!idsToDelete.length) return { deleted, errors };

  let endpointMissing = false;
  for (let i = 0; i < idsToDelete.length; i += 4000) {
    const chunk = idsToDelete.slice(i, i + 4000);
    try {
      const res: any = await pb.send("/api/bulk/delete", {
        method: "POST",
        body: { collection, ids: chunk },
      });
      if (res?.ok) {
        deleted += res.deleted || 0;
        (res.errors || []).forEach((e: any) => errors.push(e));
        continue;
      }
      throw new Error("bulk delete: respons tidak ok");
    } catch (err: any) {
      if (err?.status === 404 && deleted === 0 && errors.length === 0) {
        endpointMissing = true;
        break;
      }
      console.error("Bulk delete gagal pada chunk:", err);
      chunk.forEach((id) => errors.push({ id, message: String(err?.message || err) }));
    }
  }

  if (endpointMissing) {
    for (const id of idsToDelete) {
      try {
        await pb.collection(collection).delete(id);
        deleted++;
      } catch (e: any) {
        errors.push({ id, message: String(e?.message || e) });
      }
    }
  }
  return { deleted, errors };
}
