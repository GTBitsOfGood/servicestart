import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FormBuilderClient from "@/components/forms/builder/FormBuilderClient";
import QuestionCard from "@/components/forms/builder/QuestionCard";
import {
  newKey,
  validateQuestion,
  type DraftQuestion,
} from "@/components/forms/builder/draft";
import { QUESTION_TYPES } from "@/components/forms/builder/questionTypes";
import type { FormComponent } from "@/lib/forms/schema";
import { FormComponentType, FormStatus } from "@/lib/schema";

const $put = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  default: { forms: { ":formId": { questions: { $put } } } },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const ID_1 = "00000000-0000-4000-8000-000000000001";
const ID_2 = "00000000-0000-4000-8000-000000000002";

const QUESTIONS: FormComponent[] = [
  {
    id: ID_1,
    type: FormComponentType.ShortText,
    label: "Camper name",
    helpText: null,
    required: true,
    position: 0,
    config: {},
  },
  {
    id: ID_2,
    type: FormComponentType.YesNo,
    label: "Any allergies?",
    helpText: "Food or medicine.",
    required: false,
    position: 1,
    config: {},
  },
];

function renderBuilder(
  status = FormStatus.Draft,
  questions: FormComponent[] = QUESTIONS,
) {
  return render(
    <FormBuilderClient
      formId="health-form"
      title="Health form"
      status={status}
      questions={questions}
    />,
  );
}

function questionLabels() {
  return (screen.getAllByLabelText("Question") as HTMLInputElement[]).map(
    (input) => input.value,
  );
}

function respond(status: number, body: unknown) {
  $put.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

function draft(
  type: FormComponentType,
  config: Record<string, unknown> = {},
): DraftQuestion {
  return {
    key: newKey(),
    type,
    label: "Question",
    helpText: "",
    required: false,
    config,
  };
}

beforeEach(() => {
  $put.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(cleanup);

describe("FormBuilderClient", () => {
  it("offers every question type in the palette", () => {
    renderBuilder();
    const palette = screen.getByRole("complementary", {
      name: "Add a question",
    });
    expect(within(palette).getAllByRole("button")).toHaveLength(
      Object.values(FormComponentType).length,
    );
  });

  it("reorders, duplicates, and removes questions", () => {
    renderBuilder();
    fireEvent.click(screen.getByRole("button", { name: "Move question 2 up" }));
    expect(questionLabels()).toEqual(["Any allergies?", "Camper name"]);
    expect(
      (
        screen.getByRole("button", {
          name: "Move question 1 up",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    fireEvent.click(
      screen.getByRole("button", { name: "Duplicate question 1" }),
    );
    expect(questionLabels()).toEqual([
      "Any allergies?",
      "Any allergies?",
      "Camper name",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Remove question 3" }));
    expect(questionLabels()).toEqual(["Any allergies?", "Any allergies?"]);
  });

  it("saves the ordered list and keeps existing IDs", async () => {
    respond(200, { questions: [QUESTIONS[1], QUESTIONS[0]] });
    renderBuilder();
    const save = screen.getByRole("button", { name: "Save questions" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Move question 2 up" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Date" }));
    fireEvent.change(screen.getAllByLabelText("Question")[2], {
      target: { value: "Arrival day" },
    });
    fireEvent.click(save);

    await waitFor(() => expect($put).toHaveBeenCalledTimes(1));
    expect($put.mock.calls[0][0]).toEqual({
      param: { formId: "health-form" },
      json: {
        questions: [
          {
            id: ID_2,
            type: FormComponentType.YesNo,
            label: "Any allergies?",
            helpText: "Food or medicine.",
            required: false,
            config: {},
          },
          {
            id: ID_1,
            type: FormComponentType.ShortText,
            label: "Camper name",
            helpText: null,
            required: true,
            config: {},
          },
          {
            id: undefined,
            type: FormComponentType.Date,
            label: "Arrival day",
            helpText: null,
            required: false,
            config: {},
          },
        ],
      },
    });
    expect(
      await screen.findByText("Changes were saved successfully!"),
    ).toBeTruthy();
  });

  it("shows inline errors instead of saving an invalid question", async () => {
    renderBuilder(FormStatus.Draft, []);
    fireEvent.click(screen.getByRole("button", { name: "Add Checkboxes" }));
    fireEvent.click(screen.getByRole("button", { name: "Save questions" }));

    expect(
      await screen.findByText(
        "Fix the highlighted questions, then save again.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Add a label")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Question"));
    expect($put).not.toHaveBeenCalled();
  });

  it("keeps the edits when a save fails", async () => {
    respond(409, { error: "Questions can't change once a form is published" });
    renderBuilder();
    fireEvent.change(screen.getAllByLabelText("Question")[0], {
      target: { value: "Full name" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save questions" }));

    expect(
      await screen.findByText(
        "Questions can't change once a form is published",
      ),
    ).toBeTruthy();
    expect(questionLabels()).toEqual(["Full name", "Any allergies?"]);
    expect(
      (
        screen.getByRole("button", {
          name: "Save questions",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("keeps the edits when the request fails", async () => {
    $put.mockRejectedValueOnce(new Error("offline"));
    renderBuilder();
    fireEvent.change(screen.getAllByLabelText("Question")[0], {
      target: { value: "Full name" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save questions" }));

    expect(
      await screen.findByText(
        "Changes were not saved, please try again later.",
      ),
    ).toBeTruthy();
    expect(questionLabels()[0]).toBe("Full name");
  });

  it("discards unsaved changes", () => {
    renderBuilder();
    fireEvent.click(screen.getByRole("button", { name: "Remove question 1" }));
    expect(screen.getByText(/You have unsaved changes/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(questionLabels()).toEqual(["Camper name", "Any allergies?"]);
    expect(screen.queryByText(/You have unsaved changes/)).toBeNull();
  });

  it("opens published forms read-only", () => {
    renderBuilder(FormStatus.Published);
    expect(screen.getByRole("note").textContent).toContain(
      "Questions lock once a form is published",
    );
    expect(screen.queryByRole("button", { name: "Save questions" })).toBeNull();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Remove question 1" }),
    ).toBeNull();
    // Disabled by the surrounding fieldset.
    expect(screen.getAllByLabelText("Question")[0].matches(":disabled")).toBe(
      true,
    );
  });

  it("links to the preview and back to the forms list", () => {
    renderBuilder();
    const preview = screen.getByRole("link", { name: /Preview/ });
    expect(preview.getAttribute("href")).toBe("/forms/health-form?preview=1");
    expect(preview.getAttribute("target")).toBe("_blank");
    expect(
      screen.getByRole("link", { name: "Back to forms" }).getAttribute("href"),
    ).toBe("/settings/forms");
  });
});

describe("question settings editors", () => {
  function renderCard(question: DraftQuestion, showErrors = true) {
    const onChange = vi.fn();
    render(
      <QuestionCard
        question={question}
        index={0}
        count={1}
        errors={showErrors ? validateQuestion(question) : {}}
        readOnly={false}
        onChange={onChange}
        onMove={vi.fn()}
        onDuplicate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    return onChange;
  }

  it("has an entry for every question type", () => {
    expect(Object.keys(QUESTION_TYPES).sort()).toEqual(
      Object.values(FormComponentType).sort(),
    );
  });

  it.each([
    FormComponentType.Email,
    FormComponentType.Phone,
    FormComponentType.Image,
    FormComponentType.YesNo,
  ])("has no extra settings for %s", (type) => {
    renderCard(draft(type));
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(screen.getByLabelText("Required")).toBeTruthy();
  });

  it("edits a section header's title and description", () => {
    const onChange = renderCard(draft(FormComponentType.SectionHeader));
    expect(screen.queryByLabelText("Required")).toBeNull();
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Medical" },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ label: "Medical" }),
    );
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: "About your health" },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ helpText: "About your health" }),
    );
  });

  it("sets and clears a short text question's max length", () => {
    const question = draft(FormComponentType.ShortText, { maxLength: 50 });
    const onChange = renderCard(question);
    const input = screen.getByLabelText("Maximum characters");
    fireEvent.change(input, { target: { value: "80" } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ config: { maxLength: 80 } }),
    );
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ config: {} }),
    );
  });

  it("shows a long text question's word count errors", () => {
    renderCard(
      draft(FormComponentType.LongText, { minWords: 50, maxWords: 10 }),
    );
    expect(
      screen.getByText("The minimum word count can't be more than the maximum"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Minimum words").getAttribute("aria-invalid"),
    ).toBe("true");
  });

  it("edits a number question's range and whole-number setting", () => {
    const onChange = renderCard(
      draft(FormComponentType.Number, { min: 5, max: 1 }),
    );
    expect(
      screen.getByText("The minimum can't be more than the maximum"),
    ).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Whole numbers only"));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ config: { min: 5, max: 1, integer: true } }),
    );
  });

  it("says when a number setting isn't a number", () => {
    renderCard(draft(FormComponentType.Number, { min: Number.NaN }));
    expect(screen.getByText("Enter a number")).toBeTruthy();
  });

  it.each([
    FormComponentType.SingleChoice,
    FormComponentType.Dropdown,
    FormComponentType.Checkboxes,
  ])("edits %s options", (type) => {
    const onChange = renderCard(draft(type, { options: ["A", "B"] }));
    fireEvent.click(screen.getByRole("button", { name: "Add option" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ options: ["A", "B", "Option 3"] }),
      }),
    );
    fireEvent.change(screen.getByLabelText("Option 1"), {
      target: { value: "Apple" },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ options: ["Apple", "B"] }),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Move option 2 up" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ options: ["B", "A"] }),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove option 1" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ options: ["B"] }),
      }),
    );
  });

  it("flags blank and duplicate options", () => {
    renderCard(
      draft(FormComponentType.SingleChoice, { options: ["A", "A", " "] }),
    );
    expect(screen.getByText("Options can't be blank")).toBeTruthy();
    expect(screen.getByText("Each option must be different")).toBeTruthy();
  });

  it("flags a choice question with no options", () => {
    renderCard(draft(FormComponentType.Dropdown, { options: [] }));
    expect(screen.getByText("Add at least one option")).toBeTruthy();
  });

  it("edits a checkboxes question's selection limits", () => {
    const onChange = renderCard(
      draft(FormComponentType.Checkboxes, { options: ["A"], minSelected: 2 }),
    );
    expect(
      screen.getByText(
        "The minimum selected can't be more than the number of options",
      ),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Maximum selected"), {
      target: { value: "1" },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        config: { options: ["A"], minSelected: 2, maxSelected: 1 },
      }),
    );
  });

  it("edits a date question's earliest and latest dates", () => {
    const onChange = renderCard(
      draft(FormComponentType.Date, { min: "2027-06-10", max: "2027-06-01" }),
    );
    expect(
      screen.getByText("The earliest date can't be after the latest"),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Latest date"), {
      target: { value: "2027-06-30" },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        config: { min: "2027-06-10", max: "2027-06-30" },
      }),
    );
  });
});
