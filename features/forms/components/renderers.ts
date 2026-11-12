import QuestionGroup from "@/features/forms/components/questions/QuestionGroup";
import type { ComponentType } from "react";
import CheckboxesQuestion from "@/features/forms/components/questions/CheckboxesQuestion";
import DateQuestion from "@/features/forms/components/questions/DateQuestion";
import DropdownQuestion from "@/features/forms/components/questions/DropdownQuestion";
import ImageQuestion from "@/features/forms/components/questions/ImageQuestion";
import LongTextQuestion from "@/features/forms/components/questions/LongTextQuestion";
import SectionHeader from "@/features/forms/components/questions/SectionHeader";
import SingleChoiceQuestion from "@/features/forms/components/questions/SingleChoiceQuestion";
import TextQuestion from "@/features/forms/components/questions/TextQuestion";
import YesNoQuestion from "@/features/forms/components/questions/YesNoQuestion";
import type { QuestionProps } from "@/features/forms/components/types";
import type { FormComponentOfType } from "@/features/forms/lib/schema";
import { FormComponentType } from "@/features/forms/schema";

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
  [FormComponentType.QuestionGroup]: QuestionGroup,
};
