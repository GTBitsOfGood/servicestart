import QuestionField from "@/components/forms/questions/QuestionField";
import type { FieldValue, QuestionProps } from "@/components/forms/types";
import { isImageAnswer, type FormComponent } from "@/lib/forms/schema";

function formatAnswer(value: FieldValue | undefined) {
  if (value === undefined) return "No answer";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ") || "No answer";
  if (isImageAnswer(value)) return "Image uploaded";
  return value;
}

/**
 * Stands in for question types without a renderer yet (#321 builds them).
 * Shows a saved answer as text, so responses still read correctly.
 */
export default function UnsupportedQuestion({
  component,
  value,
  readOnly,
}: QuestionProps<FormComponent>) {
  return (
    <QuestionField component={component} group>
      <p className="text-paragraph-2 text-grey-text-weak">
        {readOnly
          ? formatAnswer(value)
          : "This question can't be answered here yet."}
      </p>
    </QuestionField>
  );
}
