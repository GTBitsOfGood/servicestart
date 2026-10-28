import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FormFillClient from "@/components/forms/FormFillClient";
import FormEditView from "@/components/forms/FormEditView";
import type { FormDefinition } from "@/lib/forms/schema";
import {
  FormComponentType,
  FormStatus,
  SubmissionReviewStatus,
} from "@/lib/schema";

const $put = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  default: {
    forms: { ":formId": { submissions: { mine: { $put } } } },
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

function renderEdit() {
  return render(
    <FormFillClient
      mode="edit"
      definition={definition}
      initialValues={{ [NAME_ID]: "Ada", [IMAGE_ID]: { uploadId: UPLOAD_ID } }}
      uploadsPath="/api/forms/camp-application-2027/my-uploads"
    />,
  );
}

function respond(status: number, body: unknown) {
  $put.mockResolvedValueOnce({
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : ""),
  });
}

function changeNameAndSave() {
  fireEvent.change(screen.getByLabelText(/Student Name/), {
    target: { value: "Grace" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
}

beforeEach(() => {
  $put.mockReset();
  window.scrollTo = vi.fn();
});

afterEach(cleanup);

const settings: FormDefinition["settings"] = {
  requireLogin: true,
  allowMultipleSubmissions: false,
  opensAt: null,
  closesAt: null,
  confirmationMessage: "Thanks!",
};

function renderView(
  overrides: Partial<Pick<FormDefinition, "status" | "settings">> = {},
  reviewStatus = SubmissionReviewStatus.Pending,
) {
  return render(
    <FormEditView
      definition={{
        ...definition,
        status: FormStatus.Published,
        settings,
        ...overrides,
      }}
      answers={{ [NAME_ID]: "Ada" }}
      reviewStatus={reviewStatus}
    />,
  );
}

describe("FormEditView", () => {
  it("shows the prefilled form while the form is open", () => {
    renderView();

    expect(
      (screen.getByLabelText(/Student Name/) as HTMLInputElement).value,
    ).toBe("Ada");
  });

  it("shows the closed state instead of the form when it is closed", () => {
    renderView({ status: FormStatus.Closed });

    expect(screen.getByText("This form is closed")).toBeTruthy();
    expect(screen.queryByLabelText(/Student Name/)).toBeNull();
  });

  it("shows the closed state after the closing date", () => {
    renderView({ settings: { ...settings, closesAt: "2020-01-01T00:00:00Z" } });

    expect(screen.getByText("This form is closed")).toBeTruthy();
  });

  it("shows the not-yet-open state before the opening date", () => {
    renderView({ settings: { ...settings, opensAt: "2999-01-01T00:00:00Z" } });

    expect(screen.getByText("This form isn't open yet")).toBeTruthy();
    expect(screen.queryByLabelText(/Student Name/)).toBeNull();
  });

  it("hides the form once the response has been reviewed", () => {
    renderView({}, SubmissionReviewStatus.Accepted);

    expect(screen.getByText("This response can't be edited")).toBeTruthy();
    expect(screen.queryByLabelText(/Student Name/)).toBeNull();
  });
});

describe("FormFillClient in edit mode", () => {
  it("starts from the saved answers with a Save changes button", () => {
    renderEdit();

    expect(
      (screen.getByLabelText(/Student Name/) as HTMLInputElement).value,
    ).toBe("Ada");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
    expect(document.querySelector("img")?.getAttribute("src")).toContain(
      `/api/forms/camp-application-2027/my-uploads/${UPLOAD_ID}`,
    );
  });

  it("saves through the API and announces success with a link home", async () => {
    respond(200, { id: "s1" });
    renderEdit();

    changeNameAndSave();

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Your response has been updated.");
    expect(
      screen.getByRole("link", { name: "Back to home" }).getAttribute("href"),
    ).toBe("/");
    expect($put).toHaveBeenCalledWith({
      param: { formId: "camp-application-2027" },
      json: {
        answers: { [NAME_ID]: "Grace", [IMAGE_ID]: { uploadId: UPLOAD_ID } },
      },
    });
  });

  it("keeps the edits and shows the error when saving fails", async () => {
    respond(403, "This form isn't accepting responses");
    renderEdit();

    changeNameAndSave();

    expect(
      await screen.findByText("This form isn't accepting responses"),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText(/Student Name/) as HTMLInputElement).value,
    ).toBe("Grace");
  });

  it("keeps the edits when the request fails", async () => {
    $put.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderEdit();

    changeNameAndSave();

    expect(
      await screen.findByText(
        "Couldn't save your changes. Check your connection and try again.",
      ),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText(/Student Name/) as HTMLInputElement).value,
    ).toBe("Grace");
  });
});
