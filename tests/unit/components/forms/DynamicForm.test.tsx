import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DynamicForm, {
  type DynamicFormSubmitResult,
} from "@/components/forms/DynamicForm";
import { VISIONARIES_APPLICATION_FORM } from "@/tests/unit/fixtures/forms";

const UPLOAD_ID = "3b0f6a52-8c1d-4e7a-9f20-6d5c4b3a2910";
const form = VISIONARIES_APPLICATION_FORM;
const [, nameId, , studentEmailId, , phoneId, , , gradeId, , , headshotId] =
  form.components.map(({ id }) => id);

const uploadImage = vi.fn(async () => ({ id: UPLOAD_ID }));

function field(label: RegExp) {
  return screen.getByLabelText(label) as HTMLInputElement;
}

function type(label: RegExp, value: string) {
  fireEvent.change(field(label), { target: { value } });
}

async function fillOut() {
  type(/^Student Name/, " Ada Lovelace ");
  type(/^Student Number/, "00123");
  type(/^Student Email/, "ada@example.com");
  type(/^Parent Name/, "Anne Byron");
  type(/^Parent Phone Number/, "(404) 555-0123");
  type(/^Parent Email/, "anne@example.com");
  type(/^What grade/, "9");
  type(/^Does the camper/, "N/A");
  type(/^Why would you like/, Array(120).fill("word").join(" "));
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, {
    target: { files: [new File(["png"], "me.png", { type: "image/png" })] },
  });
  await screen.findByRole("button", { name: "Replace image" });
}

function renderForm(
  onSubmit = vi.fn(
    async (): Promise<DynamicFormSubmitResult> => ({ ok: true }),
  ),
  preview = false,
) {
  render(
    <DynamicForm
      definition={form}
      onSubmit={onSubmit}
      preview={preview}
      uploadImage={uploadImage}
    />,
  );
  return onSubmit;
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(cleanup);

describe("DynamicForm", () => {
  it("renders every question in order", () => {
    renderForm();

    const text = document.body.textContent!;
    const positions = form.components.map(({ label }) => text.indexOf(label));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(
      screen.getAllByRole("heading").map(({ textContent }) => textContent),
    ).toEqual(["Contact Information", "Eligibility & Background"]);
  });

  it("shows an error when an edited question loses focus", () => {
    renderForm();

    type(/^Student Email/, "ada");
    expect(screen.queryByText("Enter a valid email address")).toBeNull();
    fireEvent.blur(field(/^Student Email/));

    expect(screen.getByText("Enter a valid email address")).toBeTruthy();
    expect(field(/^Student Email/).getAttribute("aria-invalid")).toBe("true");
  });

  it("doesn't flag a question that was only tabbed through", () => {
    renderForm();
    fireEvent.blur(field(/^Student Name/));
    expect(screen.queryByText("This question is required")).toBeNull();
  });

  it("clears an error once the answer is fixed", () => {
    renderForm();
    type(/^Student Email/, "ada");
    fireEvent.blur(field(/^Student Email/));

    type(/^Student Email/, "ada@example.com");

    expect(screen.queryByText("Enter a valid email address")).toBeNull();
  });

  it("flags every invalid answer on submit and focuses the first", async () => {
    const onSubmit = renderForm();
    type(/^Student Email/, "ada");

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() =>
      expect(document.activeElement).toBe(field(/^Student Name/)),
    );
    expect(onSubmit).not.toHaveBeenCalled();
    // Every required question but the email, which has a format error.
    expect(screen.getAllByText("This question is required")).toHaveLength(8);
    expect(screen.getByText("Enter a valid email address")).toBeTruthy();
  });

  it("submits the parsed answers", async () => {
    const onSubmit = renderForm();
    await fillOut();

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]).toEqual([
      expect.objectContaining({
        [nameId]: "Ada Lovelace",
        [phoneId]: "4045550123",
        [gradeId]: 9,
        [headshotId]: { uploadId: UPLOAD_ID },
      }),
    ]);
  });

  it("doesn't submit twice while a submission is in flight", async () => {
    let finish!: (result: DynamicFormSubmitResult) => void;
    const onSubmit = renderForm(
      vi.fn(() => new Promise<DynamicFormSubmitResult>((r) => (finish = r))),
    );
    await fillOut();

    const button = screen.getByRole("button", { name: "Submit" });
    fireEvent.click(button);
    await screen.findByRole("button", { name: "Submitting…" });
    fireEvent.click(button);
    fireEvent.submit(button.closest("form")!);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await act(async () => finish({ ok: true }));
  });

  it("keeps the answers and shows the server's errors when submitting fails", async () => {
    renderForm(
      vi.fn(
        async (): Promise<DynamicFormSubmitResult> => ({
          ok: false,
          error: "Some answers need attention",
          fieldErrors: { [studentEmailId]: "Use your school email" },
        }),
      ),
    );
    await fillOut();

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Some answers need attention")).toBeTruthy();
    expect(screen.getByText("Use your school email")).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(field(/^Student Email/)),
    );
    expect(field(/^Student Name/).value).toBe(" Ada Lovelace ");
    expect(field(/^Why would you like/).value.split(" ")).toHaveLength(120);
    expect(screen.getByRole("button", { name: "Replace image" })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Submit" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("focuses the error banner when no question is to blame", async () => {
    renderForm(
      vi.fn(
        async (): Promise<DynamicFormSubmitResult> => ({
          ok: false,
          error: "This form isn't accepting responses",
        }),
      ),
    );
    await fillOut();

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    const alert = await screen.findByRole("alert");
    await waitFor(() =>
      expect(document.activeElement?.contains(alert)).toBe(true),
    );
  });

  it("holds off submitting while an image uploads", async () => {
    let finish!: (value: { id: string }) => void;
    render(
      <DynamicForm
        definition={form}
        onSubmit={vi.fn()}
        uploadImage={() => new Promise((resolve) => (finish = resolve))}
      />,
    );
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, {
      target: { files: [new File(["png"], "me.png", { type: "image/png" })] },
    });

    const submit = screen.getByRole("button", { name: "Submit" });
    await waitFor(() =>
      expect((submit as HTMLButtonElement).disabled).toBe(true),
    );
    await act(async () => finish({ id: UPLOAD_ID }));
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });

  it("links each question's error with aria-describedby", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    const essay = field(/^Why would you like/);
    await waitFor(() =>
      expect(essay.getAttribute("aria-invalid")).toBe("true"),
    );
    const ids = essay.getAttribute("aria-describedby")!.split(" ");
    expect(ids.map((id) => document.getElementById(id)?.textContent)).toEqual([
      "This question is required",
      "0 words (100–150 words)",
    ]);
  });

  describe("in preview", () => {
    it("has no submit button and turns off uploads", () => {
      renderForm(undefined, true);

      expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
      expect(
        (
          screen.getByRole("button", {
            name: "Upload image",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
    });

    it("still validates answers", () => {
      renderForm(undefined, true);
      type(/^What grade/, "13");
      fireEvent.blur(field(/^What grade/));
      expect(screen.getByText("Enter a number from 1 to 12")).toBeTruthy();
    });

    it("doesn't submit", () => {
      const onSubmit = renderForm(undefined, true);
      fireEvent.submit(document.querySelector("form")!);
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
