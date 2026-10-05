import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, Edit2, Check, Banknote } from "lucide-react";
import { masterPb } from "../../lib/pocketbase";

interface BankAccount {
  id: string;
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  is_active: boolean;
}

export const SuperAdminBankAccountsModal = ({ onClose }: { onClose: () => void }) => {
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<BankAccount>>({});

  useEffect(() => {
    loadBanks();
  }, []);

  const loadBanks = async () => {
    try {
      const records = await masterPb.collection("bank_accounts").getFullList<BankAccount>();
      setBanks(records);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.bank_name || !form.account_number || !form.account_name) return alert("Isi semua field wajib");
    try {
      if (isEditing === "new") {
        await masterPb.collection("bank_accounts").create({ ...form, is_active: true });
      } else if (isEditing) {
        await masterPb.collection("bank_accounts").update(isEditing, form);
      }
      setIsEditing(null);
      loadBanks();
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan data rekening");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus rekening ini?")) return;
    try {
      await masterPb.collection("bank_accounts").delete(id);
      loadBanks();
    } catch (err) {
      alert("Gagal menghapus rekening");
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await masterPb.collection("bank_accounts").update(id, { is_active: !current });
      loadBanks();
    } catch (err) {
      alert("Gagal mengubah status");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <Banknote size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm">Kelola Rekening Bank</h2>
              <p className="text-[10px] text-slate-500">Opsi transfer manual untuk tagihan tenant</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition"><X size={16} /></button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 bg-slate-50">
          <div className="flex justify-end mb-4">
            <button 
              onClick={() => { setIsEditing("new"); setForm({ bank_name: "BCA", bank_code: "BCA", account_number: "", account_name: "" }); }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={14} /> Tambah Rekening
            </button>
          </div>

          <div className="space-y-3">
            {banks.map(bank => (
              <div key={bank.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
                {isEditing === bank.id ? (
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Nama Bank</label>
                      <input type="text" className="w-full text-xs p-2 border rounded-lg" value={form.bank_name || ""} onChange={e => setForm({...form, bank_name: e.target.value})} placeholder="Contoh: BCA" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Atas Nama</label>
                      <input type="text" className="w-full text-xs p-2 border rounded-lg" value={form.account_name || ""} onChange={e => setForm({...form, account_name: e.target.value})} placeholder="Contoh: PT Edukasi" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Nomor Rekening</label>
                      <input type="text" className="w-full text-xs p-2 border rounded-lg" value={form.account_number || ""} onChange={e => setForm({...form, account_number: e.target.value})} placeholder="Contoh: 1234567890" />
                    </div>
                    <div className="col-span-2 flex gap-2 justify-end mt-2">
                      <button onClick={() => setIsEditing(null)} className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Batal</button>
                      <button onClick={handleSave} className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1"><Check size={14}/> Simpan</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-black text-xs shrink-0">
                      {bank.bank_name.substring(0, 3).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800 text-sm">{bank.bank_name} <span className="font-mono text-blue-600 ml-1">{bank.account_number}</span></h3>
                      <p className="text-xs text-slate-500 mt-0.5">a.n. <strong>{bank.account_name}</strong></p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => toggleActive(bank.id, bank.is_active)} className={`text-[10px] font-bold px-2 py-1 rounded-md ${bank.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {bank.is_active ? "Aktif" : "Nonaktif"}
                      </button>
                      <button onClick={() => { setIsEditing(bank.id); setForm(bank); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 size={14}/></button>
                      <button onClick={() => handleDelete(bank.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={14}/></button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {isEditing === "new" && (
              <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-sm flex-1 grid grid-cols-2 gap-3 ring-2 ring-blue-500/20">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Nama Bank</label>
                  <input type="text" className="w-full text-xs p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" value={form.bank_name || ""} onChange={e => setForm({...form, bank_name: e.target.value})} placeholder="Contoh: BCA" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Atas Nama</label>
                  <input type="text" className="w-full text-xs p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" value={form.account_name || ""} onChange={e => setForm({...form, account_name: e.target.value})} placeholder="Contoh: PT Edukasi" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Nomor Rekening</label>
                  <input type="text" className="w-full text-xs p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" value={form.account_number || ""} onChange={e => setForm({...form, account_number: e.target.value})} placeholder="Contoh: 1234567890" />
                </div>
                <div className="col-span-2 flex gap-2 justify-end mt-2">
                  <button onClick={() => setIsEditing(null)} className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Batal</button>
                  <button onClick={handleSave} className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1"><Check size={14}/> Simpan</button>
                </div>
              </div>
            )}
            
            {banks.length === 0 && isEditing !== "new" && !loading && (
              <div className="text-center py-8 text-slate-400">
                <Banknote size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs">Belum ada rekening bank.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
