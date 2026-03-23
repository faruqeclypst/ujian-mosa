import * as XLSX from "xlsx-js-style";
import { INVENTORY_IMPORT_HEADERS } from "./fixedAssetExcel";

export function exportFixedAssetToExcel(params: {
  fixedAssets: Array<{
    code: string;
    name: string;
    brand: string;
    specification: string;
    quantity: number;
    acquisitionDate: string;
    source: string;
    roomId: string;
    condition: string;
  }>;
  rooms: Array<{ id: string; name: string }>;
  filename?: string;
}) {
  const filename = params.filename ?? "data-aset-tetap.xlsx";
  const roomLookup = new Map(params.rooms.map((r) => [r.id, r.name]));

  const aoa = [
    [...INVENTORY_IMPORT_HEADERS],
    ...params.fixedAssets.map((item) => [
      item.code,
      item.name,
      item.brand ?? "",
      item.specification ?? "",
      item.quantity ?? 0,
      item.acquisitionDate ?? "",
      item.source ?? "",
      roomLookup.get(item.roomId) ?? "",
      item.condition ?? "",
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  (ws as any)["!cols"] = [
    { wch: 14 },
    { wch: 24 },
    { wch: 18 },
    { wch: 30 },
    { wch: 10 },
    { wch: 18 },
    { wch: 14 },
    { wch: 22 },
    { wch: 10 },
  ];

  (ws as any)["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
  (ws as any)["!autofilter"] = { ref: "A1:I1" };

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    fill: { patternType: "solid", fgColor: { rgb: "16A34A" } },
    border: {
      top: { style: "thin", color: { rgb: "CBD5E1" } },
      bottom: { style: "thin", color: { rgb: "CBD5E1" } },
      left: { style: "thin", color: { rgb: "CBD5E1" } },
      right: { style: "thin", color: { rgb: "CBD5E1" } },
    },
  };
  for (let c = 0; c < INVENTORY_IMPORT_HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) (ws[addr] as any).s = headerStyle;
  }
  (ws as any)["!rows"] = [{ hpt: 22 }];

  // Keep Tanggal Perolehan as text
  const maxRow = aoa.length + 1;
  for (let r = 2; r <= Math.max(2, maxRow); r++) {
    const addr = `F${r}`;
    if (!ws[addr]) ws[addr] = { t: "s", v: "" };
    (ws[addr] as any).z = "@";
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Aset Tetap");
  XLSX.writeFile(wb, filename);
}

