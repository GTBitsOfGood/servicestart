"use client";

import { useState } from "react";
import {
  QUESTION_TYPES,
  type SettingsProps,
} from "@/features/forms/components/builder/questionTypes";
import QuestionCard from "@/features/forms/components/builder/QuestionCard";
import {
  builderInputClass,
  CheckboxSetting,
  FieldError,
  fieldProps,
  NumberSetting,
} from "@/features/forms/components/builder/fields";
import { questionFieldId } from "@/features/forms/components/builder/draft";
import {
  SUB_QUESTION_TYPES,
  type SubQuestionInput,
  type SubQuestionType,
} from "@/features/forms/lib/schema";
import { FormComponentType } from "@/features/forms/schema";
import ThemedButton from "@/components/theme/ThemedButton";

export default function QuestionGroupSettings({
  questionKey,
  config,
  errors,
  onChange,
}: SettingsProps<FormComponentType.QuestionGroup>) {
  const [type, setType] = useState<SubQuestionType>(
    FormComponentType.ShortText,
  );
  const questionsField = fieldProps(questionKey, "config.questions", errors);
  function changeQuestions(questions: SubQuestionInput[]) {
    onChange({ ...config, questions });
  }
  function setting(
    key: "minEntries" | "maxEntries" | "addLabel",
    value: unknown,
  ) {
    const next = { ...config, [key]: value };
    if (value === undefined) delete next[key];
    onChange(next);
  }
  return (
    <>
      <CheckboxSetting
        questionKey={questionKey}
        path="config.repeatable"
        label="Allow multiple entries"
        value={config.repeatable}
        onChange={(value) =>
          onChange({
            ...config,
            repeatable: !!value,
            minEntries: undefined,
            maxEntries: undefined,
          })
        }
      />
      {config.repeatable && (
        <>
          <div className="flex flex-wrap gap-4">
            <NumberSetting
              questionKey={questionKey}
              path="config.minEntries"
              label="Minimum entries"
              value={config.minEntries}
              errors={errors}
              onChange={(value) => setting("minEntries", value)}
            />
            <NumberSetting
              questionKey={questionKey}
              path="config.maxEntries"
              label="Maximum entries"
              value={config.maxEntries}
              errors={errors}
              onChange={(value) => setting("maxEntries", value)}
            />
          </div>
          <label
            className="flex flex-col gap-1 text-paragraph-2"
            htmlFor={questionFieldId(questionKey, "config.addLabel")}
          >
            Add button label
            <input
              id={questionFieldId(questionKey, "config.addLabel")}
              className={builderInputClass}
              value={config.addLabel ?? ""}
              placeholder="Add another"
              onChange={(event) =>
                setting("addLabel", event.target.value || undefined)
              }
            />
          </label>
          <FieldError
            questionKey={questionKey}
            path="config.addLabel"
            error={errors["config.addLabel"]}
          />
        </>
      )}
      {config.questions.map((sub, index) => {
        const prefix = `config.questions.${index}.`;
        const subErrors = Object.fromEntries(
          Object.entries(errors)
            .filter(([path]) => path.startsWith(prefix))
            .map(([path, error]) => [path.slice(prefix.length), error]),
        );
        return (
          <QuestionCard
            key={sub.id ?? `${questionKey}-${index}`}
            question={{
              ...sub,
              key: `${questionKey}-config-questions-${index}`,
              helpText: "",
            }}
            index={index}
            count={config.questions.length}
            errors={subErrors}
            readOnly={false}
            canDuplicate={false}
            subQuestion
            onDuplicate={() => {}}
            onChange={(draft) =>
              changeQuestions(
                config.questions.map((previous, i) =>
                  i === index
                    ? ({
                        id: sub.id,
                        type: draft.type,
                        label: draft.label,
                        required: draft.required,
                        config: draft.config,
                      } as SubQuestionInput)
                    : previous,
                ),
              )
            }
            onRemove={() =>
              changeQuestions(config.questions.filter((_, i) => i !== index))
            }
            onMove={(offset) => {
              const next = [...config.questions];
              [next[index], next[index + offset]] = [
                next[index + offset],
                next[index],
              ];
              changeQuestions(next);
            }}
          />
        );
      })}
      <FieldError
        questionKey={questionKey}
        path="config.questions"
        error={questionsField.error}
      />
      <div className="flex flex-wrap items-end gap-3">
        <label
          className="flex flex-col gap-1 text-paragraph-2"
          htmlFor={questionFieldId(questionKey, "subType")}
        >
          Sub-question type
          <select
            id={questionFieldId(questionKey, "subType")}
            className={builderInputClass}
            value={type}
            onChange={(event) => setType(event.target.value as SubQuestionType)}
          >
            {SUB_QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {QUESTION_TYPES[type].name}
              </option>
            ))}
          </select>
        </label>
        <ThemedButton
          id={questionsField.id}
          aria-invalid={questionsField["aria-invalid"]}
          aria-describedby={questionsField["aria-describedby"]}
          type="button"
          variant="secondary"
          disabled={config.questions.length >= 10}
          onClick={() =>
            changeQuestions([
              ...config.questions,
              {
                type,
                label: "",
                required: false,
                config: structuredClone(QUESTION_TYPES[type].defaultConfig),
              } as SubQuestionInput,
            ])
          }
        >
          Add sub-question
        </ThemedButton>
      </div>
    </>
  );
}
