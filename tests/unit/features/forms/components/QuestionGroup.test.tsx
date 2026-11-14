import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DynamicForm from "@/features/forms/components/DynamicForm";
import { FormComponentType } from "@/features/forms/schema";
import type {
  FormComponentOfType,
  SubQuestion,
} from "@/features/forms/lib/schema";

const id = "00000000-0000-4000-8000-000000000001";
const subId = "00000000-0000-4000-8000-000000000002";
const group: FormComponentOfType<FormComponentType.QuestionGroup> = {
  id,
  type: FormComponentType.QuestionGroup,
  label: "Doses",
  helpText: null,
  required: true,
  position: 0,
  config: {
    repeatable: true,
    minEntries: 1,
    maxEntries: 2,
    questions: [
      {
        id: subId,
        type: FormComponentType.Number,
        label: "Dose",
        required: true,
        config: { integer: true, min: 1 },
      },
    ],
  },
};
const definition = { formId: "health", components: [group] };
const notesId = "00000000-0000-4000-8000-000000000003";
const optionalSingle: FormComponentOfType<FormComponentType.QuestionGroup> = {
  ...group,
  required: false,
  config: {
    repeatable: false,
    questions: [
      ...group.config.questions,
      {
        id: notesId,
        type: FormComponentType.ShortText,
        label: "Instructions",
        required: false,
        config: {},
      },
    ],
  },
};
const optionalDefinition = { formId: "health", components: [optionalSingle] };
afterEach(cleanup);

describe("question group renderer", () => {
  it("reports a group's answers for a draft, with numbers parsed", () => {
    const onAnswersChange = vi.fn();
    render(
      <DynamicForm
        definition={optionalDefinition}
        onSubmit={vi.fn()}
        onAnswersChange={onAnswersChange}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Instructions/), {
      target: { value: "Morning" },
    });
    expect(onAnswersChange).toHaveBeenLastCalledWith({
      [id]: [{ [notesId]: "Morning" }],
    });
    fireEvent.change(screen.getByLabelText(/^Dose /), {
      target: { value: "2" },
    });
    expect(onAnswersChange).toHaveBeenLastCalledWith({
      [id]: [{ [notesId]: "Morning", [subId]: 2 }],
    });
    // A half-typed number is left out rather than failing the whole draft.
    fireEvent.change(screen.getByLabelText(/^Dose /), {
      target: { value: "-" },
    });
    expect(onAnswersChange).toHaveBeenLastCalledWith({
      [id]: [{ [notesId]: "Morning" }],
    });
  });

  it("omits an untouched optional single-entry group with required children", async () => {
    const onSubmit = vi.fn(async () => ({ ok: true as const }));
    render(<DynamicForm definition={optionalDefinition} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({}));
  });

  it("omits an optional single-entry group after its answers are cleared", async () => {
    const onSubmit = vi.fn(async () => ({ ok: true as const }));
    render(
      <DynamicForm
        definition={optionalDefinition}
        initialValues={{ [id]: [{ [subId]: 2, [notesId]: "Morning" }] }}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByLabelText(/^Dose /), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Instructions"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({}));
  });

  it("validates required children when an optional single-entry group is partially filled", async () => {
    const onSubmit = vi.fn(async () => ({ ok: true as const }));
    render(<DynamicForm definition={optionalDefinition} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Instructions"), {
      target: { value: "Morning" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    const dose = screen.getByLabelText(/^Dose /);
    await waitFor(() => expect(document.activeElement).toBe(dose));
    expect(dose.getAttribute("aria-invalid")).toBe("true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each<{ question: SubQuestion; value: number | boolean }>([
    {
      question: {
        id: subId,
        type: FormComponentType.Number,
        label: "Answer",
        required: true,
        config: { min: 0 },
      },
      value: 0,
    },
    {
      question: {
        id: subId,
        type: FormComponentType.YesNo,
        label: "Answer",
        required: true,
        config: {},
      },
      value: false,
    },
  ])(
    "keeps $value as a supplied answer in an optional single-entry group",
    async ({ question, value }) => {
      const onSubmit = vi.fn(async () => ({ ok: true as const }));
      const component: typeof optionalSingle = {
        ...optionalSingle,
        config: {
          repeatable: false,
          questions: [question],
        },
      };
      render(
        <DynamicForm
          definition={{ formId: "health", components: [component] }}
          initialValues={{ [id]: [{ [subId]: value }] }}
          onSubmit={onSubmit}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith({ [id]: [{ [subId]: value }] }),
      );
    },
  );

  it("adds and removes entries within bounds and submits numbers as numbers", async () => {
    const onSubmit = vi.fn(async () => ({ ok: true as const }));
    render(<DynamicForm definition={definition} onSubmit={onSubmit} />);
    expect(
      (
        screen.getByRole("button", {
          name: "Remove entry 1",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.change(screen.getByLabelText(/^Dose /), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add another" }));
    expect(
      (screen.getByRole("button", { name: "Add another" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.change(screen.getAllByLabelText(/^Dose /)[1], {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        [id]: [{ [subId]: 2 }, { [subId]: 3 }],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove entry 1" }));
    expect((screen.getByLabelText(/^Dose /) as HTMLInputElement).value).toBe(
      "3",
    );
  });
  it("shows nested errors, focuses the invalid input, and clears them when fixed", async () => {
    const onSubmit = vi.fn(async () => ({ ok: true as const }));
    render(<DynamicForm definition={definition} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    const input = screen.getByLabelText(/^Dose /);
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(input.getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(input, { target: { value: "2" } });
    expect(input.getAttribute("aria-invalid")).toBeNull();
  });
  it("prefills editable entries and preserves their values", () => {
    render(
      <DynamicForm
        definition={definition}
        initialValues={{ [id]: [{ [subId]: 4 }] }}
      />,
    );
    expect((screen.getByLabelText(/^Dose /) as HTMLInputElement).value).toBe(
      "4",
    );
  });
  it("shows every prefilled entry read-only without add/remove controls", () => {
    render(
      <DynamicForm
        definition={definition}
        readOnly
        initialValues={{ [id]: [{ [subId]: 4 }, { [subId]: 5 }] }}
      />,
    );
    expect(
      screen
        .getAllByLabelText(/^Dose /)
        .map((input) => (input as HTMLInputElement).value),
    ).toEqual(["4", "5"]);
    expect(
      screen
        .getAllByLabelText(/^Dose /)
        .every((input) => (input as HTMLInputElement).readOnly),
    ).toBe(true);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
  it("submits an empty optional medication schedule", async () => {
    const onSubmit = vi.fn(async () => ({ ok: true as const }));
    render(
      <DynamicForm
        definition={{
          ...definition,
          components: [
            {
              ...group,
              required: false,
              config: { ...group.config, minEntries: 0 },
            },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ [id]: [] }));
  });
});
