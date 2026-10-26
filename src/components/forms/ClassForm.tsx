import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import FormField from "./FormField";

const classSchema = z.object({
  name: z.string().min(1, "Nama kelas wajib diisi"),
});

export type ClassFormValues = z.infer<typeof classSchema>;

interface ClassFormProps {
  defaultValues?: Partial<ClassFormValues>;
  onSubmit: (values: ClassFormValues) => Promise<void>;
  submitLabel?: string;
  onCancel?: () => void;
}

export const ClassForm = ({ defaultValues, onSubmit, submitLabel = "Simpan", onCancel }: ClassFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: "",
      ...defaultValues,
    },
  });

  useEffect(() => {
    if (defaultValues) {
      reset(defaultValues);
    }
  }, [defaultValues, reset]);

  const submitHandler = async (values: ClassFormValues) => {
    await onSubmit(values);
    if (!defaultValues || Object.keys(defaultValues).length === 0) {
      reset({ name: "" });
    }
  };

  return (
    <form onSubmit={handleSubmit(submitHandler)} className="space-y-4">
      <FormField id="name" label="Nama Kelas" error={errors.name}>
        <Input id="name" placeholder="Contoh: X RPL 1, XI TKJ 2" {...register("name")} />
      </FormField>
      
      <div className="flex justify-end gap-2 pt-4 border-t border-slate-200/60 dark:border-slate-800/40">
        {onCancel && (
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            className="border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-xs font-semibold text-neutral-700 dark:text-neutral-300 shadow-2xs transition-colors cursor-pointer"
          >
            Batal
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
        >
          {isSubmitting ? "Menyimpan..." : submitLabel}
        </Button>
      </div>
    </form>
  );
};

export default ClassForm;
