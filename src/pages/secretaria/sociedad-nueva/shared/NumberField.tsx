import { forwardRef } from "react";
import { Field } from "./Field";
import type { ValidationIssue } from "@/lib/secretaria/sociedad-onboarding/types";

interface NumberFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  issue?: ValidationIssue;
  min?: string;
  step?: string;
  type?: string;
  help?: string;
}

export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(
  ({ min = "0", step = "1", type = "number", ...props }, ref) => (
    <Field ref={ref} type={type} min={type === "number" ? min : undefined} step={type === "number" ? step : undefined} inputMode={type === "number" ? "decimal" : undefined} {...props} />
  ),
);

NumberField.displayName = "NumberField";
