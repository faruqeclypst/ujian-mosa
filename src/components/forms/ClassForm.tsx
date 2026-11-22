import { useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { NeonButton } from "../ui/NeonButton";
import { Input } from "../ui/input";
import FormField from "./FormField";
import { useTenant } from "../../context/TenantContext";

export type ClassFormValues = {
  name: string;
};

interface ClassFormProps {
  defaultValues?: Partial<ClassFormValues>;
  onSubmit: (values: ClassFormValues) => Promise<void>;
  submitLabel?: string;
  onCancel?: () => void;
}

export const ClassForm = ({ defaultValues, onSubmit, submitLabel = "Simpan", onCancel }: ClassFormProps) => {
  const { terminology, school } = useTenant();
  const isCampus = school?.type === "campus" || (terminology.class || "").toLowerCase().includes("prodi");

  const classSchema = useMemo(() => z.object({
    name: z.string().min(1, `Nama ${terminology.class.toLowerCase()} wajib diisi`),
  }), [terminology.class]);

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

  const isSubmittingRef = useRef(false);
  const submitHandler = async (values: ClassFormValues) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await onSubmit(values);
      if (!defaultValues || Object.keys(defaultValues).length === 0) {
        reset({ name: "" });
      }
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return (
    <form onSubmit={handleSubmit(submitHandler)} className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="p-5 sm:p-6 space-y-4 flex-1 min-h-0 overflow-y-auto">
        <FormField id="name" label={`Nama ${terminology.class}`} error={errors.name}>
          <Input 
            id="name" 
            placeholder={isCampus ? "Contoh: S1 Teknik Informatika - Semester 3" : "Contoh: X RPL 1, XI TKJ 2"} 
            {...register("name")} 
          />
        </FormField>
      </div>
      
      <div className="px-5 sm:px-6 py-3 sm:py-3.5 border-t border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-[#111214]/80 flex items-center justify-end gap-2.5 shrink-0 z-10">
        {onCancel && (
          <NeonButton 
            type="button" 
            variant="secondary" 
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Batal
          </NeonButton>
        )}
        <NeonButton
          type="submit"
          variant="primary"
          color="brand"
          size="sm"
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {submitLabel}
        </NeonButton>
      </div>
    </form>
  );
};

export default ClassForm;
