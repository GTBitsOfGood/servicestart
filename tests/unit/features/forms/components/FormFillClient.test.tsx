import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FormFillClient from "@/features/forms/components/FormFillClient";
import type { FormDefinition } from "@/features/forms/lib/schema";
import { FormComponentType } from "@/core/db/schema";

const $post = vi.hoisted(() => vi.fn());
const $putDraft = vi.hoisted(() => vi.fn());
const $deleteDraft = vi.hoisted(() => vi.fn());

vi.mock("@/core/api/client", () => ({
  default: {
    forms: {
      ":formId": {
        draft: { $put: $putDraft, $delete: $deleteDraft },
        submissions: { $post },
      },
    },
  },
}));

const NAME_ID = "00000000-0000-4000-8000-000000000001";
const IMAGE_ID = "00000000-0000-4000-8000-000000000002";
const UPLOAD_ID = "00000000-0000-4000-8000-0000000000aa";
const definition: Pick<FormDefinition, "formId" | "components"> = {
  formId: "camp-application-2027",
  components: [
    {
      id: NAME_ID,
      type: FormComponentType.ShortText,
      label: "Student Name",
      helpText: null,
      required: true,
      position: 0,
      config: {},
    },
  ],
};

const definitionWithImage: Pick<FormDefinition, "formId" | "components"> = {
  ...definition,
  components: [
    ...definition.components,
    {
      id: IMAGE_ID,
      type: FormComponentType.Image,
      label: "Headshot",
      helpText: null,
      required: false,
      position: 1,
      config: {},
    },
  ],
};

function respond(status: number, body: unknown) {
  $post.mockResolvedValueOnce({
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : ""),
  });
}

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText(/Student Name/), {
    target: { value: "Ada" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
}

beforeEach(() => {
  $post.mockReset();
  $putDraft.mockReset();
  $deleteDraft.mockReset();
  window.scrollTo = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});

describe("FormFillClient", () => {
  it("starts a new submission with saved draft answers", () => {
    render(
      <FormFillClient
        definition={definitionWithImage}
        enableDrafts
        initialValues={{
          [NAME_ID]: "Saved Ada",
          [IMAGE_ID]: { uploadId: UPLOAD_ID },
        }}
      />,
    );

    expect(
      (screen.getByLabelText(/Student Name/) as HTMLInputElement).value,
    ).toBe("Saved Ada");
    expect(
      screen
        .getByRole("img", { name: "Your uploaded image" })
        .getAttribute("src"),
    ).toBe(`/api/forms/${definition.formId}/my-uploads/${UPLOAD_ID}`);
    expect(screen.getByRole("status").textContent).toBe("Saved");
    expect(screen.getByRole("button", { name: "Discard draft" })).toBeTruthy();
  });

  it("deletes a saved draft and resets the form", async () => {
    let resolveDelete!: (response: { ok: boolean; status: number }) => void;
    $deleteDraft.mockReturnValueOnce(
      new Promise<{ ok: boolean; status: number }>((resolve) => {
        resolveDelete = resolve;
      }),
    );
    render(
      <FormFillClient
        definition={definition}
        enableDrafts
        initialValues={{ [NAME_ID]: "Saved Ada" }}
      />,
    );

    const input = screen.getByLabelText(/Student Name/) as HTMLInputElement;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
      await Promise.resolve();
    });
    expect($deleteDraft).toHaveBeenCalledWith({
      param: { formId: definition.formId },
    });
    expect(input.disabled).toBe(true);

    await act(async () => {
      resolveDelete({ ok: true, status: 200 });
      await Promise.resolve();
    });

    expect(
      (screen.getByLabelText(/Student Name/) as HTMLInputElement).value,
    ).toBe("");
    expect(screen.queryByRole("button", { name: "Discard draft" })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("waits for an active save before deleting the draft", async () => {
    vi.useFakeTimers();
    let resolveSave!: (response: { ok: boolean }) => void;
    const saveRequest = new Promise<{ ok: boolean }>((resolve) => {
      resolveSave = resolve;
    });
    $putDraft.mockReturnValueOnce(saveRequest);
    $deleteDraft.mockResolvedValueOnce({ ok: true, status: 200 });
    render(<FormFillClient definition={definition} enableDrafts />);
    fireEvent.change(screen.getByLabelText(/Student Name/), {
      target: { value: "Ada" },
    });
    await act(() => vi.advanceTimersByTimeAsync(2_000));

    // A successful autosave makes the discard option available. Resolve it,
    // then start another save to exercise the in-flight ordering.
    await act(async () => {
      resolveSave({ ok: true });
      await saveRequest;
    });
    fireEvent.change(screen.getByLabelText(/Student Name/), {
      target: { value: "Ada Lovelace" },
    });
    let resolveSecondSave!: (response: { ok: boolean }) => void;
    const secondSave = new Promise<{ ok: boolean }>((resolve) => {
      resolveSecondSave = resolve;
    });
    $putDraft.mockReturnValueOnce(secondSave);
    await act(() => vi.advanceTimersByTimeAsync(2_000));

    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
    expect($deleteDraft).not.toHaveBeenCalled();
    await act(async () => {
      resolveSecondSave({ ok: true });
      await secondSave;
    });

    expect($deleteDraft).toHaveBeenCalledTimes(1);
    expect(
      (screen.getByLabelText(/Student Name/) as HTMLInputElement).value,
    ).toBe("");
  });

  it("keeps the answers when discarding fails", async () => {
    $deleteDraft.mockResolvedValueOnce({ ok: false, status: 500 });
    render(
      <FormFillClient
        definition={definition}
        enableDrafts
        initialValues={{ [NAME_ID]: "Saved Ada" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));

    expect(
      await screen.findByText("Couldn't discard the draft. Try again."),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText(/Student Name/) as HTMLInputElement).value,
    ).toBe("Saved Ada");
    expect(
      (screen.getByLabelText(/Student Name/) as HTMLInputElement).disabled,
    ).toBe(false);
    expect(screen.getByRole("button", { name: "Discard draft" })).toBeTruthy();
  });

  it("debounces draft saves and shows the saving states", async () => {
    vi.useFakeTimers();
    let resolveSave!: (response: { ok: boolean }) => void;
    $putDraft.mockReturnValueOnce(
      new Promise<{ ok: boolean }>((resolve) => {
        resolveSave = resolve;
      }),
    );
    render(<FormFillClient definition={definition} enableDrafts />);

    const input = screen.getByLabelText(/Student Name/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "A" } });
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    fireEvent.change(input, { target: { value: "Ada" } });
    await act(() => vi.advanceTimersByTimeAsync(1_999));
    expect($putDraft).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect($putDraft).toHaveBeenCalledWith(
      {
        param: { formId: definition.formId },
        json: { answers: { [NAME_ID]: "Ada" } },
      },
      { init: { keepalive: false } },
    );
    expect(screen.getByRole("status").textContent).toBe("Saving…");
    expect(input.disabled).toBe(false);

    await act(async () => {
      resolveSave({ ok: true });
      await Promise.resolve();
    });
    expect(screen.getByRole("status").textContent).toBe("Saved");
  });

  it("saves immediately with keepalive when the page becomes hidden", async () => {
    vi.useFakeTimers();
    $putDraft.mockResolvedValueOnce({ ok: true });
    render(<FormFillClient definition={definition} enableDrafts />);
    fireEvent.change(screen.getByLabelText(/Student Name/), {
      target: { value: "Ada" },
    });

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });

    expect($putDraft).toHaveBeenCalledWith(
      {
        param: { formId: definition.formId },
        json: { answers: { [NAME_ID]: "Ada" } },
      },
      { init: { keepalive: true } },
    );
    expect(screen.getByRole("status").textContent).toBe("Saved");
  });

  it("shows a quiet failure and retries without disabling the form", async () => {
    vi.useFakeTimers();
    $putDraft
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });
    render(<FormFillClient definition={definition} enableDrafts />);
    const input = screen.getByLabelText(/Student Name/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Ada" } });

    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(screen.getByRole("status").textContent).toBe(
      "Couldn't save. Retrying…",
    );
    expect(input.disabled).toBe(false);

    await act(() => vi.advanceTimersByTimeAsync(4_999));
    expect($putDraft).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect($putDraft).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status").textContent).toBe("Saved");
  });

  it("does not autosave when drafts are disabled", async () => {
    vi.useFakeTimers();
    render(<FormFillClient definition={definition} />);
    fireEvent.change(screen.getByLabelText(/Student Name/), {
      target: { value: "Anonymous answer" },
    });

    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect($putDraft).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("finishes an in-flight draft save before submitting", async () => {
    vi.useFakeTimers();
    let resolveDraft!: (response: { ok: boolean }) => void;
    const draftRequest = new Promise<{ ok: boolean }>((resolve) => {
      resolveDraft = resolve;
    });
    $putDraft.mockReturnValueOnce(draftRequest);
    respond(201, { id: "s1", confirmationMessage: "Submitted safely" });
    render(<FormFillClient definition={definition} enableDrafts />);
    fireEvent.change(screen.getByLabelText(/Student Name/), {
      target: { value: "Ada" },
    });
    await act(() => vi.advanceTimersByTimeAsync(2_000));

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect($post).not.toHaveBeenCalled();

    await act(async () => {
      resolveDraft({ ok: true });
      await draftRequest;
    });
    expect($post).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Submitted safely")).toBeTruthy();
  });

  it("submits through the API and shows the confirmation message", async () => {
    respond(201, { id: "s1", confirmationMessage: "Thanks for applying!" });
    render(<FormFillClient definition={definition} />);

    fillAndSubmit();

    expect(await screen.findByText("Thanks for applying!")).toBeTruthy();
    expect($post).toHaveBeenCalledWith({
      param: { formId: "camp-application-2027" },
      json: { answers: { [NAME_ID]: "Ada" } },
    });
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
  });

  it("shows a duplicate submission's error and keeps the answers", async () => {
    respond(409, { error: "You've already responded to this form" });
    render(<FormFillClient definition={definition} />);

    fillAndSubmit();

    expect(
      await screen.findByText("You've already responded to this form"),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText(/Student Name/) as HTMLInputElement).value,
    ).toBe("Ada");
  });

  it("shows a plain-text error from the server", async () => {
    respond(403, "This form isn't accepting responses");
    render(<FormFillClient definition={definition} />);

    fillAndSubmit();

    expect(
      await screen.findByText("This form isn't accepting responses"),
    ).toBeTruthy();
  });

  it("shows an error when the request fails", async () => {
    $post.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<FormFillClient definition={definition} />);

    fillAndSubmit();

    expect(
      await screen.findByText(
        "Couldn't submit the form. Check your connection and try again.",
      ),
    ).toBeTruthy();
  });
});
