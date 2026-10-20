import type { QuestionProps } from "@/components/forms/types";
import type { FormComponentOfType } from "@/lib/forms/schema";
import type { FormComponentType } from "@/lib/schema";

/** A section's title and description. It takes no answer. */
export default function SectionHeader({
  component,
}: QuestionProps<FormComponentOfType<FormComponentType.SectionHeader>>) {
  return (
    <div className="flex flex-col gap-2 border-b border-grey-stroke-weak pb-3 pt-4">
      <h2 className="font-display text-heading-3 text-page-text">
        {component.label}
      </h2>
      {component.helpText && (
        <p className="text-paragraph-2 text-grey-text-weak">
          {component.helpText}
        </p>
      )}
    </div>
  );
}
