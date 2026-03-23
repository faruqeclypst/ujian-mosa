import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { usePiket } from "../../context/PiketContext";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import FormField from "../forms/FormField";

const guruSchema = z.object({
  name: z.string().min(1, "Nama guru wajib diisi"),
  code: z.string().optional(),
  subjects: z.array(z.string()).min(1, "Pilih minimal 1 mata pelajaran"),
});

export type GuruFormValues = z.infer<typeof guruSchema>;

export interface GuruSubmitPayload {
  name: string;
  code?: string;
  subjects: string[];
}

interface GuruFormProps {
  defaultValues?: Partial<GuruSubmitPayload>;
  onSubmit: (values: GuruSubmitPayload) => Promise<void>;
  submitLabel?: string;
}

const GuruForm = ({ defaultValues, onSubmit, submitLabel = "Simpan" }: GuruFormProps) => {
  const { mapels } = usePiket();
  
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<GuruFormValues>({
    resolver: zodResolver(guruSchema),
    defaultValues: {
      name: "",
      code: "",
      subjects: [],
    },
  });

  useEffect(() => {
    if (defaultValues) {
      reset({
        name: defaultValues.name || "",
        code: defaultValues.code || "",
        subjects: defaultValues.subjects || [],
      });
    }
  }, [defaultValues, reset]);

  const submitHandler = async (values: GuruFormValues) => {
    await onSubmit({
      name: values.name,
      code: values.code || "",
      subjects: values.subjects,
    });
    
    if (!defaultValues || Object.keys(defaultValues).length === 0) {
      reset({ name: "", code: "", subjects: [] });
    }
  };

  return (
    <form onSubmit={handleSubmit(submitHandler)} className="space-y-4">
      <FormField id="name" label="Nama Guru" error={errors.name}>
        <Input id="name" placeholder="Masukkan nama guru" {...register("name")} />
      </FormField>

      <FormField id="code" label="Kode Guru (Opsional)" error={errors.code}>
        <Input id="code" placeholder="Contoh: AA, BB, dll." {...register("code")} />
      </FormField>
      
      <FormField id="subjects" label="Mata Pelajaran (Bisa pilih lebih dari satu)" error={errors.subjects as any}>
        {mapels.length === 0 ? (
          <div className="p-3 bg-slate-50 border border-dashed rounded text-sm text-slate-500 text-center">
            Belum ada data Mapel. Silakan tambah di menu <strong>Data Mapel</strong>.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded bg-slate-50 dark:bg-slate-800/50">
            <Controller
              control={control}
              name="subjects"
              render={({ field }) => (
                <>
                  {mapels.map((mapel) => {
                    const isChecked = field.value.includes(mapel.name);
                    return (
                      <label 
                        key={mapel.id} 
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer border transition-colors ${
                          isChecked 
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" 
                            : "border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={isChecked}
                          onChange={(e) => {
                            const val = field.value || [];
                            if (e.target.checked) {
                              field.onChange([...val, mapel.name]);
                            } else {
                              field.onChange(val.filter((v: string) => v !== mapel.name));
                            }
                          }}
                        />
                        <span className="text-sm font-medium">{mapel.name}</span>
                      </label>
                    );
                  })}
                </>
              )}
            />
          </div>
        )}
      </FormField>
      
      <div className="pt-4 border-t">
        <Button
          type="submit"
          disabled={isSubmitting || mapels.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isSubmitting ? "Menyimpan..." : submitLabel}
        </Button>
      </div>
    </form>
  );
};

export default GuruForm;
