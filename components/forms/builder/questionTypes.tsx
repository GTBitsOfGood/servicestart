"use client";

import type { ComponentType } from "react";
import type { QuestionErrors } from "@/components/forms/builder/draft";
import {
  CheckboxSetting,
  DateSetting,
  NumberSetting,
} from "@/components/forms/builder/fields";
import OptionsEditor from "@/components/forms/builder/OptionsEditor";
import type { FormComponentConfigFor } from "@/lib/forms/schema";
import { FormComponentType } from "@/lib/schema";

export type SettingsProps<T extends FormComponentType> = {
  questionKey: string;
  config: FormComponentConfigFor<T>;
  errors: QuestionErrors;
  onChange: (config: FormComponentConfigFor<T>) => void;
};

type QuestionTypeDefinition<T extends FormComponentType> = {
  /** Shown in the palette and on the question's card. */
  name: string;
  /** A new question's settings. */
  defaultConfig: FormComponentConfigFor<T>;
  /** Type-specific settings, or null when there are none. */
  Settings: ComponentType<SettingsProps<T>> | null;
};

// Sets one key, dropping it when unset so the saved config stays minimal.
function withValue<C extends object>(config: C, key: keyof C, value: unknown) {
  const next = { ...config } as Record<PropertyKey, unknown>;
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next as C;
}

function ShortTextSettings({
  questionKey,
  config,
  errors,
  onChange,
}: SettingsProps<FormComponentType.ShortText>) {
  return (
    <NumberSetting
      questionKey={questionKey}
      path="config.maxLength"
      label="Maximum characters"
      hint="Leave blank for no limit."
      value={config.maxLength}
      errors={errors}
      onChange={(value) => onChange(withValue(config, "maxLength", value))}
    />
  );
}

function LongTextSettings({
  questionKey,
  config,
  errors,
  onChange,
}: SettingsProps<FormComponentType.LongText>) {
  return (
    <div className="flex flex-wrap gap-4">
      <NumberSetting
        questionKey={questionKey}
        path="config.minWords"
        label="Minimum words"
        value={config.minWords}
        errors={errors}
        onChange={(value) => onChange(withValue(config, "minWords", value))}
      />
      <NumberSetting
        questionKey={questionKey}
        path="config.maxWords"
        label="Maximum words"
        value={config.maxWords}
        errors={errors}
        onChange={(value) => onChange(withValue(config, "maxWords", value))}
      />
    </div>
  );
}

function NumberSettings({
  questionKey,
  config,
  errors,
  onChange,
}: SettingsProps<FormComponentType.Number>) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4">
        <NumberSetting
          questionKey={questionKey}
          path="config.min"
          label="Minimum"
          value={config.min}
          errors={errors}
          onChange={(value) => onChange(withValue(config, "min", value))}
        />
        <NumberSetting
          questionKey={questionKey}
          path="config.max"
          label="Maximum"
          value={config.max}
          errors={errors}
          onChange={(value) => onChange(withValue(config, "max", value))}
        />
      </div>
      <CheckboxSetting
        questionKey={questionKey}
        path="config.integer"
        label="Whole numbers only"
        value={config.integer}
        onChange={(value) => onChange(withValue(config, "integer", value))}
      />
    </div>
  );
}

function ChoiceSettings({
  questionKey,
  config,
  errors,
  onChange,
}: SettingsProps<FormComponentType.SingleChoice | FormComponentType.Dropdown>) {
  return (
    <OptionsEditor
      questionKey={questionKey}
      options={config.options}
      errors={errors}
      onChange={(options) => onChange({ ...config, options })}
    />
  );
}

function CheckboxesSettings({
  questionKey,
  config,
  errors,
  onChange,
}: SettingsProps<FormComponentType.Checkboxes>) {
  return (
    <div className="flex flex-col gap-4">
      <OptionsEditor
        questionKey={questionKey}
        options={config.options}
        errors={errors}
        onChange={(options) => onChange({ ...config, options })}
      />
      <div className="flex flex-wrap gap-4">
        <NumberSetting
          questionKey={questionKey}
          path="config.minSelected"
          label="Minimum selected"
          value={config.minSelected}
          errors={errors}
          onChange={(value) =>
            onChange(withValue(config, "minSelected", value))
          }
        />
        <NumberSetting
          questionKey={questionKey}
          path="config.maxSelected"
          label="Maximum selected"
          value={config.maxSelected}
          errors={errors}
          onChange={(value) =>
            onChange(withValue(config, "maxSelected", value))
          }
        />
      </div>
    </div>
  );
}

function DateSettings({
  questionKey,
  config,
  errors,
  onChange,
}: SettingsProps<FormComponentType.Date>) {
  return (
    <div className="flex flex-wrap gap-4">
      <DateSetting
        questionKey={questionKey}
        path="config.min"
        label="Earliest date"
        value={config.min}
        errors={errors}
        onChange={(value) => onChange(withValue(config, "min", value))}
      />
      <DateSetting
        questionKey={questionKey}
        path="config.max"
        label="Latest date"
        value={config.max}
        errors={errors}
        onChange={(value) => onChange(withValue(config, "max", value))}
      />
    </div>
  );
}

const DEFAULT_OPTIONS = ["Option 1", "Option 2"];

/**
 * Every question type the builder offers, in palette order. A new type needs
 * an entry here (TypeScript errors until it has one) and a renderer in
 * components/forms/renderers.ts.
 */
export const QUESTION_TYPES: {
  [T in FormComponentType]: QuestionTypeDefinition<T>;
} = {
  [FormComponentType.SectionHeader]: {
    name: "Section header",
    defaultConfig: {},
    // Its title and description are the card's label and help text.
    Settings: null,
  },
  [FormComponentType.ShortText]: {
    name: "Short text",
    defaultConfig: {},
    Settings: ShortTextSettings,
  },
  [FormComponentType.LongText]: {
    name: "Long text",
    defaultConfig: {},
    Settings: LongTextSettings,
  },
  [FormComponentType.Email]: {
    name: "Email",
    defaultConfig: {},
    Settings: null,
  },
  [FormComponentType.Phone]: {
    name: "Phone",
    defaultConfig: {},
    Settings: null,
  },
  [FormComponentType.Number]: {
    name: "Number",
    defaultConfig: {},
    Settings: NumberSettings,
  },
  [FormComponentType.SingleChoice]: {
    name: "Single choice",
    defaultConfig: { options: DEFAULT_OPTIONS },
    Settings: ChoiceSettings,
  },
  [FormComponentType.Checkboxes]: {
    name: "Checkboxes",
    defaultConfig: { options: DEFAULT_OPTIONS },
    Settings: CheckboxesSettings,
  },
  [FormComponentType.Dropdown]: {
    name: "Dropdown",
    defaultConfig: { options: DEFAULT_OPTIONS },
    Settings: ChoiceSettings,
  },
  [FormComponentType.Date]: {
    name: "Date",
    defaultConfig: {},
    Settings: DateSettings,
  },
  [FormComponentType.YesNo]: {
    name: "Yes/No",
    defaultConfig: {},
    Settings: null,
  },
  [FormComponentType.Image]: {
    name: "Image upload",
    defaultConfig: {},
    Settings: null,
  },
};

export const QUESTION_TYPE_ORDER = Object.keys(
  QUESTION_TYPES,
) as FormComponentType[];
