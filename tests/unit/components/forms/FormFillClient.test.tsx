import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FormFillClient from "@/components/forms/FormFillClient";
import { FormComponentType } from "@/lib/schema";

const $post = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  default: { forms: { ":formId": { submissions: { $post } } } },
}));

const NAME_ID = "00000000-0000-4000-8000-000000000001";
const definition = {
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
  window.scrollTo = vi.fn();
});

afterEach(cleanup);

describe("FormFillClient", () => {
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
