import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Check, Landmark } from "lucide-react";
import { masterPb } from "../../lib/pocketbase";

const POPULAR_BANKS = [
  { code: "BCA", name: "Bank BCA", logo: "https://upload.wikimedia.org/wikipedia/commons/5/5c/Bank_Central_Asia.svg" },
  { code: "BRI", name: "Bank BRI", logo: "https://upload.wikimedia.org/wikipedia/commons/2/2e/BRI_2020.svg" },
  { code: "JAGO", name: "Bank Jago", logo: "https://upload.wikimedia.org/wikipedia/commons/1/1b/Logo_Bank_Jago.png" },
  { code: "SEABANK", name: "SeaBank", logo: "https://upload.wikimedia.org/wikipedia/commons/f/f1/SeaBank_logo.png" },
];

interface BankAccount {
  id: string;
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  is_active: boolean;
}

export const BankAccountsSettings = () => {
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
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Kelola Rekening Bank</h3>
          <p className="text-xs text-slate-500 mt-0.5">Opsi pembayaran manual untuk tenant yang melakukan perpanjangan.</p>
        </div>
        <button 
          onClick={() => { setIsEditing("new"); setForm({ bank_name: "BCA", bank_code: "BCA", account_number: "", account_name: "" }); }}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
        >
          <Plus size={14} /> Tambah Rekening
        </button>
      </div>
      <div className="p-5 space-y-4">
        {banks.map(bank => (
          <div key={bank.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex items-start gap-4">
            {isEditing === bank.id ? (
              <div className="flex-1 grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Pilih Bank</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                    {POPULAR_BANKS.map(b => (
                      <button
                        key={b.code}
                        type="button"
                        onClick={() => setForm({...form, bank_code: b.code, bank_name: b.name})}
                        className={`p-2 border rounded-xl flex flex-col items-center justify-center gap-1.5 transition ${form.bank_code === b.code ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' : 'border-slate-200 hover:bg-slate-50 bg-white'}`}
                      >
                        <div className="h-6 flex items-center justify-center w-full relative">
                           <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase tracking-wider">{b.code.replace('_', ' ')}</span>
                           <img src={b.logo} alt={b.name} className="relative z-10 max-h-full max-w-[50px] object-contain bg-white" onError={e => e.currentTarget.style.display = 'none'} />
                        </div>
                        <span className="text-[9px] font-bold text-slate-600 text-center">{b.name}</span>
                      </button>
                    ))}
                  </div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1 mt-3">Atau Ketik Manual Nama Bank (Jika tidak ada di atas)</label>
                  <input type="text" className="w-full text-sm p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" value={form.bank_name || ""} onChange={e => setForm({...form, bank_code: "OTHER", bank_name: e.target.value})} placeholder="Contoh: Bank BPD Aceh" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Atas Nama</label>
                  <input type="text" className="w-full text-sm p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" value={form.account_name || ""} onChange={e => setForm({...form, account_name: e.target.value})} placeholder="Contoh: PT Edukasi" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Nomor Rekening</label>
                  <input type="text" className="w-full text-sm p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" value={form.account_number || ""} onChange={e => setForm({...form, account_number: e.target.value})} placeholder="Contoh: 1234567890" />
                </div>
                <div className="col-span-2 flex gap-2 justify-end mt-2">
                  <button onClick={() => setIsEditing(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Batal</button>
                  <button onClick={handleSave} className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5"><Check size={14}/> Simpan</button>
                </div>
              </div>
            ) : (
              <>
                <div className="w-14 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 p-1.5 overflow-hidden text-center shadow-sm relative">
                  {POPULAR_BANKS.find(b => b.code === bank.bank_code) && bank.bank_code !== "OTHER" ? (
                     <img src={POPULAR_BANKS.find(b => b.code === bank.bank_code)?.logo} alt={bank.bank_name} className="relative z-10 max-h-full max-w-full object-contain bg-white" onError={e => e.currentTarget.style.display = 'none'} />
                     <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase leading-none">{bank.bank_name.substring(0,4)}</span>
                  ) : (
                     <span className="text-[10px] font-black text-slate-400 uppercase leading-none">{bank.bank_name.substring(0,4)}</span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 text-base">{bank.bank_name} <span className="font-mono text-blue-600 ml-2">{bank.account_number}</span></h3>
                  <p className="text-sm text-slate-500 mt-1">a.n. <strong>{bank.account_name}</strong></p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleActive(bank.id, bank.is_active)} className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${bank.is_active ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                    {bank.is_active ? "Aktif" : "Nonaktif"}
                  </button>
                  <button onClick={() => { setIsEditing(bank.id); setForm(bank); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg transition" title="Edit"><Edit2 size={16}/></button>
                  <button onClick={() => handleDelete(bank.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg transition" title="Hapus"><Trash2 size={16}/></button>
                </div>
              </>
            )}
          </div>
        ))}

        {isEditing === "new" && (
          <div className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm flex-1 grid grid-cols-2 gap-4 ring-2 ring-blue-500/10">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 mb-1">Pilih Bank</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                {POPULAR_BANKS.map(b => (
                  <button
                    key={b.code}
                    type="button"
                    onClick={() => setForm({...form, bank_code: b.code, bank_name: b.name})}
                    className={`p-2 border rounded-xl flex flex-col items-center justify-center gap-1.5 transition ${form.bank_code === b.code ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' : 'border-slate-200 hover:bg-slate-50 bg-white'}`}
                  >
                    <div className="h-6 flex items-center justify-center w-full relative">
                           <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase tracking-wider">{b.code.replace('_', ' ')}</span>
                           <img src={b.logo} alt={b.name} className="relative z-10 max-h-full max-w-[50px] object-contain bg-white" onError={e => e.currentTarget.style.display = 'none'} />
                        </div>
                    <span className="text-[9px] font-bold text-slate-600 text-center">{b.name}</span>
                  </button>
                ))}
              </div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1 mt-3">Atau Ketik Manual Nama Bank (Jika tidak ada di atas)</label>
              <input type="text" className="w-full text-sm p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" value={form.bank_name || ""} onChange={e => setForm({...form, bank_code: "OTHER", bank_name: e.target.value})} placeholder="Contoh: Bank BPD Aceh" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1">Atas Nama</label>
              <input type="text" className="w-full text-sm p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" value={form.account_name || ""} onChange={e => setForm({...form, account_name: e.target.value})} placeholder="Contoh: PT Edukasi" />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 mb-1">Nomor Rekening</label>
              <input type="text" className="w-full text-sm p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" value={form.account_number || ""} onChange={e => setForm({...form, account_number: e.target.value})} placeholder="Contoh: 1234567890" />
            </div>
            <div className="col-span-2 flex gap-2 justify-end mt-2">
              <button onClick={() => setIsEditing(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Batal</button>
              <button onClick={handleSave} className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5"><Check size={14}/> Simpan</button>
            </div>
          </div>
        )}
        
        {banks.length === 0 && isEditing !== "new" && !loading && (
          <div className="text-center py-10 bg-slate-50 border border-slate-200 border-dashed rounded-xl">
            <Landmark size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">Belum ada rekening bank.</p>
            <p className="text-xs text-slate-400 mt-1">Tambahkan rekening untuk mempermudah pembayaran tenant.</p>
          </div>
        )}
      </div>
    </div>
  );
};
