import type { ComponentType } from "react";
import ImageQuestion from "@/components/forms/questions/ImageQuestion";
import LongTextQuestion from "@/components/forms/questions/LongTextQuestion";
import SectionHeader from "@/components/forms/questions/SectionHeader";
import TextQuestion from "@/components/forms/questions/TextQuestion";
import type { QuestionProps } from "@/components/forms/types";
import type { FormComponentOfType } from "@/lib/forms/schema";
import { FormComponentType } from "@/lib/schema";

/** How each component type renders. A new type needs an entry here. */
export const FORM_RENDERERS: {
  [T in FormComponentType]: ComponentType<
    QuestionProps<FormComponentOfType<T>>
  >;
} = {
  [FormComponentType.ShortText]: TextQuestion,
  [FormComponentType.LongText]: LongTextQuestion,
  [FormComponentType.Email]: TextQuestion,
  [FormComponentType.Phone]: TextQuestion,
  [FormComponentType.Number]: TextQuestion,
  [FormComponentType.Image]: ImageQuestion,
  [FormComponentType.SectionHeader]: SectionHeader,
};
