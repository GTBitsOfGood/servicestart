import type { ComponentType } from "react";
import CheckboxesQuestion from "@/components/forms/questions/CheckboxesQuestion";
import DateQuestion from "@/components/forms/questions/DateQuestion";
import DropdownQuestion from "@/components/forms/questions/DropdownQuestion";
import ImageQuestion from "@/components/forms/questions/ImageQuestion";
import LongTextQuestion from "@/components/forms/questions/LongTextQuestion";
import SectionHeader from "@/components/forms/questions/SectionHeader";
import SingleChoiceQuestion from "@/components/forms/questions/SingleChoiceQuestion";
import TextQuestion from "@/components/forms/questions/TextQuestion";
import YesNoQuestion from "@/components/forms/questions/YesNoQuestion";
import type { QuestionProps } from "@/components/forms/types";
import type { FormComponentOfType } from "@/lib/forms/schema";
import { FormComponentType } from "@/lib/schema";

/**
 * How each component type renders. A new type needs an entry here, and its
 * renderer must honor `readOnly` and show `value` when one is passed in.
 */
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
  [FormComponentType.SingleChoice]: SingleChoiceQuestion,
  [FormComponentType.Checkboxes]: CheckboxesQuestion,
  [FormComponentType.Dropdown]: DropdownQuestion,
  [FormComponentType.Date]: DateQuestion,
  [FormComponentType.YesNo]: YesNoQuestion,
};
