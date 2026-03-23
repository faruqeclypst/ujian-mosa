import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import FormField from "../forms/FormField";

const mapelSchema = z.object({
  name: z.string().min(1, "Nama mapel wajib diisi"),
});

export type MapelFormValues = z.infer<typeof mapelSchema>;

interface MapelFormProps {
  defaultValues?: Partial<MapelFormValues>;
  onSubmit: (values: MapelFormValues) => Promise<void>;
  submitLabel?: string;
}

const MapelForm = ({ defaultValues, onSubmit, submitLabel = "Simpan" }: MapelFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<MapelFormValues>({
    resolver: zodResolver(mapelSchema),
    defaultValues: {
      name: "",
      ...defaultValues,
    },
  });

  useEffect(() => {
    reset((prev) => ({ ...prev, ...defaultValues }));
  }, [defaultValues, reset]);

  const submitHandler = async (values: MapelFormValues) => {
    await onSubmit(values);
    if (!defaultValues || Object.keys(defaultValues).length === 0) {
      reset({ name: "" });
    }
  };

  return (
    <form onSubmit={handleSubmit(submitHandler)} className="space-y-4">
      <FormField id="name" label="Mata Pelajaran" error={errors.name}>
        <Input id="name" placeholder="Contoh: Matematika, Bahasa Inggris" {...register("name")} />
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

export default MapelForm;
