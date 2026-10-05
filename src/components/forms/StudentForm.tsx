import { useEffect, useMemo, useState, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Camera, Trash2, Upload, Loader2, User } from "lucide-react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import FormField from "./FormField";
import { Select } from "../ui/select";
import type { ClassData } from "../../types/exam";
import { useTenant } from "../../context/TenantContext";
import { uploadInventoryImage } from "../../lib/storage";
import { compressImage } from "../../lib/imageCompression";

export type StudentFormValues = {
  nisn: string;
  name: string;
  gender: "L" | "P";
  classId: string;
  photo?: string;
  birthPlace?: string;
  birthDate?: string;
  room?: string;
  session?: string;
  examNumber?: string;
};

interface StudentFormProps {
  classes: ClassData[];
  defaultValues?: Partial<StudentFormValues>;
  onSubmit: (values: StudentFormValues) => Promise<void>;
  submitLabel?: string;
  onCancel?: () => void;
}

export const StudentForm = ({ 
  classes, 
  defaultValues, 
  onSubmit, 
  submitLabel = "Simpan",
  onCancel
}: StudentFormProps) => {
  const { terminology, school } = useTenant();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoValue, setPhotoValue] = useState<string>(defaultValues?.photo || "");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const studentSchema = useMemo(() => z.object({
    nisn: z.string().min(3, `${terminology.id} minimal 3 karakter`),
    name: z.string().min(1, `Nama ${terminology.student} wajib diisi`),
    gender: z.enum(["L", "P"], { required_error: "Gender wajib dipilih" }),
    classId: z.string().min(1, `${terminology.class} wajib dipilih`),
    photo: z.string().optional(),
    birthPlace: z.string().optional(),
    birthDate: z.string().optional(),
    room: z.string().optional(),
    session: z.string().optional(),
    examNumber: z.string().optional(),
  }), [terminology]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
    setValue,
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      nisn: "",
      name: "",
      gender: "L",
      classId: "",
      photo: "",
      birthPlace: "",
      birthDate: "",
      room: "",
      session: "",
      examNumber: "",
      ...defaultValues,
    },
  });

  useEffect(() => {
    if (defaultValues) {
      reset({
        nisn: defaultValues.nisn || "",
        name: defaultValues.name || "",
        gender: defaultValues.gender || "L",
        classId: defaultValues.classId || "",
        photo: defaultValues.photo || "",
        birthPlace: defaultValues.birthPlace || "",
        birthDate: defaultValues.birthDate || "",
        room: defaultValues.room || "",
        session: defaultValues.session || "",
        examNumber: defaultValues.examNumber || "",
      });
      setPhotoValue(defaultValues.photo || "");
    } else {
      reset({
        nisn: "",
        name: "",
        gender: "L",
        classId: "",
        photo: "",
        birthPlace: "",
        birthDate: "",
        room: "",
        session: "",
        examNumber: "",
      });
      setPhotoValue("");
    }
  }, [defaultValues, reset]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setPhotoError("Harap pilih file gambar (JPG, PNG, atau WebP).");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setPhotoError("Ukuran foto maksimal 8MB.");
      return;
    }

    setPhotoError(null);
    setIsUploadingPhoto(true);

    try {
      // Kompresi khusus rasio pas foto 3x4
      const compressed = await compressImage(file, { maxWidth: 600, maxHeight: 800, quality: 0.88 });
      const schoolFolder = school?.slug || "unknown";
      const res = await uploadInventoryImage(`schools/${schoolFolder}/students`, compressed);
      setPhotoValue(res.url);
      setValue("photo", res.url, { shouldDirty: true });
    } catch (err: any) {
      // Fallback: baca base64 langsung jika upload gagal
      try {
        const reader = new FileReader();
        reader.onload = (re) => {
          const dataUrl = re.target?.result as string;
          setPhotoValue(dataUrl);
          setValue("photo", dataUrl, { shouldDirty: true });
        };
        reader.readAsDataURL(file);
      } catch (fbErr) {
        setPhotoError("Gagal mengunggah foto. Silakan coba lagi.");
      }
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = () => {
    setPhotoValue("");
    setValue("photo", "", { shouldDirty: true });
    setPhotoError(null);
  };

  const submitHandler = async (values: StudentFormValues) => {
    await onSubmit({
      ...values,
      photo: photoValue,
    });
    if (!defaultValues || Object.keys(defaultValues).length === 0) {
      reset({
        nisn: "",
        name: "",
        gender: "L",
        classId: "",
        photo: "",
        birthPlace: "",
        birthDate: "",
        room: "",
        session: "",
        examNumber: "",
      });
      setPhotoValue("");
    }
  };

  const sortedClasses = Array.isArray(classes) ? [...classes].sort((a, b) => 
    (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: 'base' })
  ) : [];

  return (
    <form onSubmit={handleSubmit(submitHandler)} className="space-y-4">
      {/* Bagian Foto Profil Siswa (Pas Foto 3x4 untuk Kartu Ujian) */}
      <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800">
        <div className="relative w-24 h-32 flex-shrink-0 rounded-lg overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center shadow-inner">
          {photoValue ? (
            <img 
              src={photoValue} 
              alt="Pas Foto Siswa" 
              className="w-full h-full object-cover" 
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-center p-1">
              <User className="w-8 h-8 mb-1 opacity-60" />
              <span className="text-[10px] font-bold tracking-wider uppercase">Foto 3x4</span>
            </div>
          )}

          {isUploadingPhoto && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2 text-center sm:text-left">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
              Pas Foto {terminology.student}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Gunakan foto formal rasio 3:4. Foto akan langsung tampil di Kartu Ujian (ANBK / TKA).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              onChange={handlePhotoSelect} 
              className="hidden" 
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploadingPhoto}
              onClick={() => fileInputRef.current?.click()}
              className="h-8 text-xs font-medium gap-1.5 border-slate-300 dark:border-slate-700"
            >
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              {photoValue ? "Ganti Foto" : "Unggah Foto"}
            </Button>
            {photoValue && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemovePhoto}
                className="h-8 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus
              </Button>
            )}
          </div>
          {photoError && (
            <p className="text-[11px] text-rose-500 font-medium">{photoError}</p>
          )}
        </div>
      </div>

      {/* Identitas Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField id="nisn" label={terminology.id} error={errors.nisn}>
          <Input id="nisn" placeholder={`Masukkan ${terminology.id}`} {...register("nisn")} />
        </FormField>

        <FormField id="name" label={`Nama ${terminology.student}`} error={errors.name}>
          <Input id="name" placeholder={`Masukkan Nama ${terminology.student}`} {...register("name")} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField id="gender" label="Gender" error={errors.gender}>
          <Controller
            name="gender"
            control={control}
            render={({ field }) => (
              <div className="flex gap-4 p-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="radio" 
                    value="L" 
                    checked={field.value === "L"}
                    onChange={() => field.onChange("L")}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">Laki-laki (L)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="radio" 
                    value="P" 
                    checked={field.value === "P"}
                    onChange={() => field.onChange("P")}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">Perempuan (P)</span>
                </label>
              </div>
            )}
          />
        </FormField>

        <FormField id="classId" label={terminology.class} error={errors.classId}>
          <Select 
            id="classId"
            {...register("classId")}
            disabled={sortedClasses.length === 0}
          >
            <option value="">Pilih {terminology.class}</option>
            {sortedClasses.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </Select>
          {sortedClasses.length === 0 && (
            <p className="text-[10px] text-rose-500 mt-1 font-medium italic">
              * Data {terminology.class.toLowerCase()} belum ada. Daftarkan terlebih dahulu.
            </p>
          )}
        </FormField>
      </div>

      {/* Tempat & Tanggal Lahir (Khas Kartu Ujian ANBK/TKA) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField id="birthPlace" label="Tempat Lahir (Opsional)" error={errors.birthPlace}>
          <Input id="birthPlace" placeholder="Contoh: Jakarta" {...register("birthPlace")} />
        </FormField>

        <FormField id="birthDate" label="Tanggal Lahir (Opsional)" error={errors.birthDate}>
          <Input id="birthDate" type="date" {...register("birthDate")} />
        </FormField>
      </div>

      {/* Ruang & Sesi Ujian */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField id="room" label="Ruang Ujian (Opsional)" error={errors.room}>
          <Input id="room" placeholder="Contoh: Ruang 01 / Lab Komputer" {...register("room")} />
        </FormField>

        <FormField id="session" label="Sesi Ujian (Opsional)" error={errors.session}>
          <Input id="session" placeholder="Contoh: Sesi 1 / Sesi 2" {...register("session")} />
        </FormField>
      </div>

      {/* Nomor Peserta Khusus (Opsional) */}
      <FormField id="examNumber" label="Nomor Peserta Ujian (Opsional)" error={errors.examNumber}>
        <Input 
          id="examNumber" 
          placeholder={`Jika kosong, otomatis menggunakan ${terminology.id}`} 
          {...register("examNumber")} 
        />
      </FormField>
      
      <div className="flex justify-end gap-2 pt-4 border-t border-slate-200/60 dark:border-slate-800/40">
        {onCancel && (
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300"
          >
            Batal
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || isUploadingPhoto}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl px-5"
        >
          {isSubmitting ? "Menyimpan..." : submitLabel}
        </Button>
      </div>
    </form>
  );
};

export default StudentForm;
