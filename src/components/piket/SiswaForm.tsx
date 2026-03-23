import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import FormField from "../forms/FormField";
import { Select } from "../ui/select";
import type { ClassData } from "../../types/piket";

const siswaSchema = z.object({
  nisn: z.string().min(5, "NISN minimal 5 karakter"),
  name: z.string().min(1, "Nama siswa wajib diisi"),
  gender: z.enum(["L", "P"], { required_error: "Gender wajib dipilih" }),
  classId: z.string().min(1, "Kelas wajib dipilih"),
});

export type SiswaFormValues = z.infer<typeof siswaSchema>;

interface SiswaFormProps {
  classes: ClassData[];
  defaultValues?: Partial<SiswaFormValues>;
  onSubmit: (values: SiswaFormValues) => Promise<void>;
  submitLabel?: string;
}

const SiswaForm = ({ 
  classes, 
  defaultValues, 
  onSubmit, 
  submitLabel = "Simpan" 
}: SiswaFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch
  } = useForm<SiswaFormValues>({
    resolver: zodResolver(siswaSchema),
    defaultValues: {
      nisn: "",
      name: "",
      gender: "L",
      classId: "",
      ...defaultValues,
    },
  });

  const genderValue = watch("gender");
  const classIdValue = watch("classId");

  useEffect(() => {
    if (defaultValues) {
      // Set values directly due to custom Select inputs
      if (defaultValues.nisn) setValue("nisn", defaultValues.nisn);
      if (defaultValues.name) setValue("name", defaultValues.name);
      if (defaultValues.gender) setValue("gender", defaultValues.gender);
      if (defaultValues.classId) setValue("classId", defaultValues.classId);
    }
  }, [defaultValues, setValue]);

  const submitHandler = async (values: SiswaFormValues) => {
    await onSubmit(values);
    if (!defaultValues || Object.keys(defaultValues).length === 0) {
      reset({ nisn: "", name: "", gender: "L", classId: "" });
    }
  };

  const sortedClasses = [...classes].sort((a, b) => 
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );

  return (
    <form onSubmit={handleSubmit(submitHandler)} className="space-y-4">
      <FormField id="nisn" label="NISN" error={errors.nisn}>
        <Input id="nisn" placeholder="Masukkan NISN" {...register("nisn")} />
      </FormField>

      <FormField id="name" label="Nama Siswa" error={errors.name}>
        <Input id="name" placeholder="Masukkan Nama Siswa" {...register("name")} />
      </FormField>

      <FormField id="gender" label="Gender" error={errors.gender}>
        <Select 
          value={genderValue} 
          onChange={(e) => setValue("gender", e.target.value as "L" | "P", { shouldValidate: true })}
        >
          <option value="L">Laki-Laki</option>
          <option value="P">Perempuan</option>
        </Select>
      </FormField>

      <FormField id="classId" label="Kelas" error={errors.classId}>
        <Select 
          value={classIdValue} 
          onChange={(e) => setValue("classId", e.target.value, { shouldValidate: true })}
        >
          <option value="">Pilih Kelas</option>
          {sortedClasses.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name}
            </option>
          ))}
        </Select>
      </FormField>
      
      <div className="pt-4 border-t">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isSubmitting ? "Menyimpan..." : submitLabel}
        </Button>
      </div>
    </form>
  );
};

export default SiswaForm;
