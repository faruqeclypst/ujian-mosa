import { ReactNode } from "react";
import { FieldError } from "react-hook-form";

import { Label } from "../ui/label";

interface FormFieldProps {
  id: string;
  label: string;
  error?: FieldError;
  children: ReactNode;
  description?: string;
}

const FormField = ({ id, label, error, description, children }: FormFieldProps) => {
  return (
    <div className="space-y-1.5 sm:space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
        <Label htmlFor={id} className="text-sm sm:text-base font-medium">{label}</Label>
        {description ? <span className="text-xs text-muted-foreground order-last sm:order-none">{description}</span> : null}
      </div>
      {children}
      {error ? (
        <div className="flex items-start gap-2">
          <div className="w-1 h-1 rounded-full bg-destructive mt-2 flex-shrink-0" />
          <p className="text-xs sm:text-sm font-medium text-destructive leading-tight">{error.message}</p>
        </div>
      ) : null}
    </div>
  );
};

export default FormField;
