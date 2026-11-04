"use client";

import { useEffect, useRef } from "react";
import QuestionField from "@/components/forms/questions/QuestionField";
import {
  describedBy,
  fieldId,
  type QuestionProps,
} from "@/components/forms/types";
import ThemedDropdown from "@/components/theme/ThemedDropdown";
import type { FormComponentOfType } from "@/lib/forms/schema";
import type { FormComponentType } from "@/lib/schema";
import { cn } from "@/lib/utils";

function setAttribute(element: Element, name: string, value?: string) {
  if (value === undefined) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

/** The themed dropdown; the answer is the chosen option's text. */
export default function DropdownQuestion({
  component,
  value,
  error,
  disabled,
  readOnly,
  onChange,
  onBlur,
}: QuestionProps<FormComponentOfType<FormComponentType.Dropdown>>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const descriptionIds = describedBy(component, error);
  const selected = typeof value === "string" ? value : "";

  // BogDropdown's trigger doesn't take an id or ARIA attributes.
  useEffect(() => {
    const trigger = containerRef.current?.querySelector("button");
    if (!trigger) return;
    trigger.id = fieldId(component.id);
    setAttribute(trigger, "aria-describedby", descriptionIds);
    setAttribute(trigger, "aria-invalid", error ? "true" : undefined);
  }, [component.id, descriptionIds, error, readOnly]);

  return (
    <QuestionField component={component} error={error}>
      {readOnly ? (
        // A read-only answer can't be changed, so show it as text.
        <input
          id={fieldId(component.id)}
          readOnly
          value={selected}
          aria-describedby={descriptionIds}
          className={cn(
            "w-full max-w-100 rounded-control border border-grey-stroke-weak bg-solid-bg-sunken px-4 py-3 text-paragraph-2 text-page-text focus:border-brand-stroke-strong focus:outline-none",
          )}
        />
      ) : (
        <div ref={containerRef} onBlur={onBlur} className="max-w-100">
          <ThemedDropdown
            name={component.id}
            options={component.config.options}
            placeholder="Choose an option"
            value={selected}
            disabled={disabled}
            onSelectionChange={(selection) =>
              onChange(
                typeof selection === "string" && selection
                  ? selection
                  : undefined,
              )
            }
            className="text-page-text"
          />
        </div>
      )}
    </QuestionField>
  );
}
