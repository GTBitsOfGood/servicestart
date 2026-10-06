import type { ReactNode } from "react";
import type { FormComponent } from "@/lib/forms/schema";
import { errorId, fieldId, helpTextId } from "@/components/forms/types";

type QuestionFieldProps = {
  component: FormComponent;
  error?: string;
  /** A fieldset with a legend, for questions whose control isn't one input. */
  group?: boolean;
  children: ReactNode;
};

/** A question's label, help text, and error around its control. */
export default function QuestionField({
  component,
  error,
  group = false,
  children,
}: QuestionFieldProps) {
  const label = (
    <>
      {component.label}
      {component.required && (
        <span aria-hidden="true" className="text-status-red-text">
          {" "}
          *
        </span>
      )}
    </>
  );
  const labelClassName = "text-paragraph-1 font-semibold text-page-text";
  const content = (
    <>
      {component.helpText && (
        <p
          id={helpTextId(component.id)}
          className="text-paragraph-2 text-grey-text-weak"
        >
          {component.helpText}
        </p>
      )}
      {children}
      {error && (
        <p
          id={errorId(component.id)}
          className="text-paragraph-2 text-status-red-text"
        >
          {error}
        </p>
      )}
    </>
  );

  return group ? (
    <fieldset className="flex flex-col gap-2">
      <legend className={`${labelClassName} mb-2`}>{label}</legend>
      {content}
    </fieldset>
  ) : (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId(component.id)} className={labelClassName}>
        {label}
      </label>
      {content}
    </div>
  );
}
