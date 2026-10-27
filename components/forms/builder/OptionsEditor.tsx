"use client";

import { ArrowDown, ArrowUp, Plus, Trash } from "@phosphor-icons/react";
import {
  questionErrorId,
  questionFieldId,
  type QuestionErrors,
} from "@/components/forms/builder/draft";
import {
  builderInputClass,
  FieldError,
  fieldProps,
  inputBorder,
} from "@/components/forms/builder/fields";
import { CHOICE_OPTIONS_MAX } from "@/lib/forms/schema";
import { cn } from "@/lib/utils";

type OptionsEditorProps = {
  questionKey: string;
  options: string[];
  errors: QuestionErrors;
  onChange: (options: string[]) => void;
};

const iconButtonClass =
  "rounded-control p-1.5 text-grey-icon-strong hover:bg-grey-fill-weak hover:text-page-text disabled:cursor-not-allowed disabled:text-grey-off-state disabled:hover:bg-transparent";

function nextOptionName(options: string[]) {
  let n = options.length + 1;
  while (options.includes(`Option ${n}`)) n += 1;
  return `Option ${n}`;
}

/** Adds, renames, reorders, and removes a choice question's options. */
export default function OptionsEditor({
  questionKey,
  options,
  errors,
  onChange,
}: OptionsEditorProps) {
  const listError = errors["config.options"];

  function move(index: number, offset: number) {
    const next = [...options];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  }

  function add() {
    onChange([...options, nextOptionName(options)]);
    // Focus the new option once it renders.
    const index = options.length;
    requestAnimationFrame(() => {
      const input = document.getElementById(
        questionFieldId(questionKey, `config.options.${index}`),
      ) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-paragraph-2 font-semibold text-page-text">
        Options
      </legend>
      <ol className="flex flex-col gap-2">
        {options.map((option, index) => {
          const path = `config.options.${index}`;
          const { error, ...inputProps } = fieldProps(
            questionKey,
            path,
            errors,
          );
          return (
            // Options can repeat while being edited, so key by position.
            <li key={index} className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <input
                  {...inputProps}
                  aria-label={`Option ${index + 1}`}
                  aria-describedby={
                    [
                      inputProps["aria-describedby"],
                      listError
                        ? questionErrorId(questionKey, "config.options")
                        : undefined,
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  value={option}
                  onChange={(event) =>
                    onChange(
                      options.map((item, i) =>
                        i === index ? event.target.value : item,
                      ),
                    )
                  }
                  className={cn(builderInputClass, inputBorder(error))}
                />
                <button
                  type="button"
                  className={iconButtonClass}
                  aria-label={`Move option ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={18} aria-hidden />
                </button>
                <button
                  type="button"
                  className={iconButtonClass}
                  aria-label={`Move option ${index + 1} down`}
                  disabled={index === options.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={18} aria-hidden />
                </button>
                <button
                  type="button"
                  className={iconButtonClass}
                  aria-label={`Remove option ${index + 1}`}
                  onClick={() =>
                    onChange(options.filter((_, i) => i !== index))
                  }
                >
                  <Trash size={18} aria-hidden />
                </button>
              </div>
              <FieldError questionKey={questionKey} path={path} error={error} />
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        // Errors about the whole list focus this button.
        id={questionFieldId(questionKey, "config.options")}
        onClick={add}
        disabled={options.length >= CHOICE_OPTIONS_MAX}
        className="flex items-center gap-1 self-start rounded-control px-2 py-1 text-paragraph-2 font-semibold text-brand-text hover:bg-brand-fill disabled:cursor-not-allowed disabled:text-grey-off-state"
      >
        <Plus size={16} aria-hidden />
        Add option
      </button>
      <FieldError
        questionKey={questionKey}
        path="config.options"
        error={listError}
      />
    </fieldset>
  );
}
