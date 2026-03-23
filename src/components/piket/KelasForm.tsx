import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import FormField from "../forms/FormField";

const kelasSchema = z.object({
  name: z.string().min(1, "Nama kelas wajib diisi"),
});

export type KelasFormValues = z.infer<typeof kelasSchema>;

interface KelasFormProps {
  defaultValues?: Partial<KelasFormValues>;
  onSubmit: (values: KelasFormValues) => Promise<void>;
  submitLabel?: string;
}

const KelasForm = ({ defaultValues, onSubmit, submitLabel = "Simpan" }: KelasFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<KelasFormValues>({
    resolver: zodResolver(kelasSchema),
    defaultValues: {
      name: "",
      ...defaultValues,
    },
  });

  useEffect(() => {
    reset((prev) => ({ ...prev, ...defaultValues }));
  }, [defaultValues, reset]);

  const submitHandler = async (values: KelasFormValues) => {
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

export default KelasForm;
