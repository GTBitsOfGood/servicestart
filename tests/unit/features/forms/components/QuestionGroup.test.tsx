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
import type { FormComponentOfType } from "@/features/forms/lib/schema";

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
afterEach(cleanup);

describe("question group renderer", () => {
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
