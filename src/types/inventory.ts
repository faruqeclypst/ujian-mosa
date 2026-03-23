export interface Room {
  id: string;
  name: string;
  buildingCode: string;
  photoUrl?: string;
  condition: "baik" | "cukup" | "rusak";
  notes?: string;
  capacity?: number;
  roomType?: "kelas" | "laboratorium" | "kantor" | "ruang_rapat" | "perpustakaan" | "lainnya";
  floor?: number;
}

export interface Land {
  id: string;
  locationName: string;
  locationCode: string;
  area: number;
  acquisitionYear: number;
  address: string;
  certificateNumber: string;
  origin: string;
  photoUrl?: string;
  description?: string;
}

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  brand: string;
  specification: string;
  quantity: number;
  acquisitionDate: string;
  source: string;
  roomId: string;
  photoUrl?: string;
  condition: "baik" | "cukup" | "rusak";
}

export interface FixedAsset extends InventoryItem {}

export interface Loan {
  id: string;
  loanDate: string;
  returnDate: string;
  itemId: string;
  itemName: string;
  borrowerName: string;
  status: "dipinjam" | "dikembalikan";
  photoUrl?: string;
  notes?: string;
}

export interface IncomingMail {
  id: string;
  mailNumber: string;
  date: string;
  sender: string;
  senderAddress: string;
  recipient: string;
  subject: string;
  content: string;
  priority: "rendah" | "normal" | "tinggi" | "urgent";
  category: "undangan" | "pemberitahuan" | "permohonan" | "laporan" | "lainnya";
  status: "belum_dibaca" | "sudah_dibaca" | "ditindaklanjuti" | "selesai";
  attachmentUrl?: string;
  notes?: string;
  receivedBy: string;
  processedBy?: string;
  processedDate?: string;
}

export interface OutgoingMail {
  id: string;
  mailNumber: string;
  date: string;
  sender: string;
  recipient: string;
  recipientAddress: string;
  subject: string;
  content: string;
  priority: "rendah" | "normal" | "tinggi" | "urgent";
  category: "undangan" | "pemberitahuan" | "permohonan" | "laporan" | "lainnya";
  status: "draft" | "terkirim" | "diterima" | "ditolak";
  attachmentUrl?: string;
  notes?: string;
  createdBy: string;
  sentDate?: string;
  deliveryMethod: "pos" | "kurir" | "email" | "fax" | "langsung";
}

export interface InventorySnapshot {
  items: Record<string, InventoryItem>;
  fixedAssets: Record<string, FixedAsset>;
  rooms: Record<string, Room>;
  lands: Record<string, Land>;
  loans: Record<string, Loan>;
  incomingMail: Record<string, IncomingMail>;
  outgoingMail: Record<string, OutgoingMail>;
}

export type InventoryEntity = InventoryItem | FixedAsset | Room | Land | Loan | IncomingMail | OutgoingMail;
