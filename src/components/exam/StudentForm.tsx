import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import FormField from "../forms/FormField";
import { Select } from "../ui/select";
import type { ClassData } from "../../types/exam";

const studentSchema = z.object({
  nisn: z.string().min(5, "NISN minimal 5 karakter"),
  name: z.string().min(1, "Nama Siswa wajib diisi"),
  gender: z.enum(["L", "P"], { required_error: "Gender wajib dipilih" }),
  classId: z.string().min(1, "Kelas wajib dipilih"),
});

export type StudentFormValues = z.infer<typeof studentSchema>;

interface StudentFormProps {
  classes: ClassData[];
  defaultValues?: Partial<StudentFormValues>;
  onSubmit: (values: StudentFormValues) => Promise<void>;
  submitLabel?: string;
  onCancel?: () => void;
}

const StudentForm = ({ 
  classes, 
  defaultValues, 
  onSubmit, 
  submitLabel = "Simpan",
  onCancel
}: StudentFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      nisn: "",
      name: "",
      gender: "L",
      classId: "",
      ...defaultValues,
    },
  });

  const classIdValue = watch("classId");

  // Reset form initialization when defaultValues changes (but only when it's first set or student changes)
  useEffect(() => {
    if (defaultValues) {
      reset({
        nisn: defaultValues.nisn || "",
        name: defaultValues.name || "",
        gender: defaultValues.gender || "L",
        classId: defaultValues.classId || "",
      });
    } else {
      reset({ nisn: "", name: "", gender: "L", classId: "" });
    }
  }, [defaultValues?.nisn, defaultValues?.name, defaultValues?.classId, reset]);

  const submitHandler = async (values: StudentFormValues) => {
    await onSubmit(values);
    if (!defaultValues || Object.keys(defaultValues).length === 0) {
      reset({ nisn: "", name: "", gender: "L", classId: "" });
    }
  };

  const sortedClasses = Array.isArray(classes) ? [...classes].sort((a, b) => 
    (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: 'base' })
  ) : [];

  return (
    <form onSubmit={handleSubmit(submitHandler)} className="space-y-4">
      <FormField id="nisn" label="NISN" error={errors.nisn}>
        <Input id="nisn" placeholder="Masukkan NISN" {...register("nisn")} />
      </FormField>

      <FormField id="name" label="Nama Siswa" error={errors.name}>
        <Input id="name" placeholder="Masukkan Nama Siswa" {...register("name")} />
      </FormField>

      <FormField id="gender" label="Gender" error={errors.gender}>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input 
              type="radio" 
              value="L" 
              {...register("gender")} 
              className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">Laki-laki (L)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input 
              type="radio" 
              value="P" 
              {...register("gender")} 
              className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">Perempuan (P)</span>
          </label>
        </div>
      </FormField>


      <FormField id="classId" label="Kelas" error={errors.classId}>
        <Select 
          id="classId"
          {...register("classId")}
          disabled={sortedClasses.length === 0}
        >
          <option value="">Pilih Kelas</option>
          {sortedClasses.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name}
            </option>
          ))}
        </Select>
        {sortedClasses.length === 0 && (
          <p className="text-[10px] text-rose-500 mt-1 font-medium italic">
            * Data kelas tidak ditemukan. Mohon daftarkan kelas terlebih dahulu.
          </p>
        )}
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
          disabled={isSubmitting}
          className="bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60 dark:border-blue-800/20 text-blue-700 font-semibold rounded-xl"
        >
          {isSubmitting ? "Menyimpan..." : submitLabel}
        </Button>
      </div>
    </form>
  );
};

export default StudentForm;

