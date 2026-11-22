import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { NeonButton } from "../ui/NeonButton";
import { Input } from "../ui/input";
import FormField from "./FormField";
import { useTenant } from "../../context/TenantContext";

const createSubjectSchema = (subjectTerm: string) => z.object({
  name: z.string().min(1, `Nama ${subjectTerm} wajib diisi`),
});

export type SubjectFormValues = {
  name: string;
};

interface SubjectFormProps {
  defaultValues?: Partial<SubjectFormValues>;
  onSubmit: (values: SubjectFormValues) => Promise<void>;
  submitLabel?: string;
  onCancel?: () => void;
}

export const SubjectForm = ({ defaultValues, onSubmit, submitLabel = "Simpan", onCancel }: SubjectFormProps) => {
  const { terminology } = useTenant();
  const subjectSchema = createSubjectSchema(terminology.subject);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
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
  const submitHandler = async (values: SubjectFormValues) => {
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
        <FormField id="name" label={terminology.subject} error={errors.name}>
          <Input id="name" placeholder="Contoh: Matematika, Bahasa Inggris" {...register("name")} />
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

export default SubjectForm;
