import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RequiredFormsPanel, {
  type RequiredFormItem,
} from "@/features/forms/components/RequiredFormsPanel";
import ReviewStatusDropdown from "@/features/forms/components/ReviewStatusDropdown";
import SubmissionSections from "@/features/forms/components/SubmissionSections";
import type { FormComponent } from "@/features/forms/lib/schema";
import { FormComponentType, SubmissionReviewStatus } from "@/core/db/schema";

const { $patch, $post, refresh } = vi.hoisted(() => ({
  $patch: vi.fn(),
  $post: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/core/api/client", () => ({
  default: {
    formResponses: { ":submissionId": { status: { $patch } } },
    informationRequests: { $post },
  },
}));

function component(
  id: number,
  type: FormComponentType,
  label: string,
): FormComponent {
  return {
    id: `00000000-0000-4000-8000-00000000000${id}`,
    type,
    label,
    helpText: null,
    required: false,
    position: id,
    config: {},
  } as FormComponent;
}

const components = [
  component(1, FormComponentType.SectionHeader, "Contact Information"),
  component(2, FormComponentType.ShortText, "Student Name"),
  component(3, FormComponentType.SectionHeader, "Background"),
  component(4, FormComponentType.ShortText, "School"),
];

beforeEach(() => {
  $patch.mockReset();
  $post.mockReset();
  refresh.mockReset();
});

afterEach(cleanup);

describe("SubmissionSections", () => {
  it("groups the answers under their section headers", () => {
    render(
      <SubmissionSections
        definition={{ formId: "camp-application-2027", components }}
        answers={{ [components[1].id]: "Ada", [components[3].id]: "Tech High" }}
        uploadsPath="/api/forms/camp-application-2027/uploads"
      />,
    );

    const contact = screen.getByRole("region", {
      name: "Contact Information",
    });
    const background = screen.getByRole("region", { name: "Background" });
    expect(within(contact).getByDisplayValue("Ada")).toBeTruthy();
    expect(within(contact).queryByDisplayValue("Tech High")).toBeNull();
    expect(within(background).getByDisplayValue("Tech High")).toBeTruthy();
    expect(within(background).queryByDisplayValue("Ada")).toBeNull();
  });

  it("keeps questions before the first header in their own section", () => {
    render(
      <SubmissionSections
        definition={{
          formId: "camp-application-2027",
          components: [components[1], ...components.slice(2)],
        }}
        answers={{ [components[1].id]: "Ada" }}
        uploadsPath="/api/forms/camp-application-2027/uploads"
      />,
    );

    expect(
      within(
        screen.getByRole("region", { name: "Responses" }),
      ).getByDisplayValue("Ada"),
    ).toBeTruthy();
    expect(screen.getAllByRole("region")).toHaveLength(2);
  });
});

const requiredForms: RequiredFormItem[] = [
  {
    formId: "emergency-contact-2027",
    title: "Emergency Contact Information",
    dueAt: "2027-05-01T03:59:00.000Z",
    status: "completed",
    submissionId: "11111111-1111-4111-8111-111111111111",
    canRequest: false,
  },
  {
    formId: "medical-history-2027",
    title: "Medical History",
    dueAt: "2027-05-15T03:59:00.000Z",
    status: "not-submitted",
    submissionId: null,
    canRequest: true,
  },
  {
    formId: "consent-form-2026",
    title: "Consent Form",
    dueAt: "2026-05-08T03:59:00.000Z",
    status: "past-due",
    submissionId: null,
    canRequest: true,
  },
];

function renderPanel() {
  render(
    <RequiredFormsPanel
      member={{ id: "user-1", name: "Ada Lovelace" }}
      forms={requiredForms}
    />,
  );
  return screen.getAllByRole("listitem");
}

describe("RequiredFormsPanel", () => {
  it("shows each form's status", () => {
    const [completed, notSubmitted, pastDue] = renderPanel();

    expect(within(completed).getByText("Completed")).toBeTruthy();
    expect(within(notSubmitted).getByText("Not Submitted")).toBeTruthy();
    expect(within(pastDue).getByText("Past due")).toBeTruthy();
  });

  it("links a completed form to its submission", () => {
    const [completed] = renderPanel();

    expect(
      within(completed)
        .getByRole("link", { name: "Emergency Contact Information" })
        .getAttribute("href"),
    ).toBe(
      "/settings/forms/emergency-contact-2027/responses/11111111-1111-4111-8111-111111111111",
    );
    expect(within(completed).queryByRole("button")).toBeNull();
  });

  it("offers a request for forms that aren't submitted", () => {
    const [, notSubmitted, pastDue] = renderPanel();

    for (const [item, title] of [
      [notSubmitted, "Medical History"],
      [pastDue, "Consent Form"],
    ] as const) {
      expect(within(item).queryByRole("link")).toBeNull();
      expect(
        within(item).getByRole("button", {
          name: `Request Information for ${title}`,
        }),
      ).toBeTruthy();
    }
  });

  it("sends a request with the admin's message", async () => {
    $post.mockResolvedValueOnce({ ok: true, json: async () => ({ id: "n1" }) });
    renderPanel();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Request Information for Medical History",
      }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Medical History")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Message (optional)"), {
      target: { value: "Please send this soon." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }));

    expect(await within(dialog).findByText(/Request sent/)).toBeTruthy();
    expect($post).toHaveBeenCalledWith({
      json: {
        userId: "user-1",
        formId: "medical-history-2027",
        message: "Please send this soon.",
      },
    });
  });

  it("shows why a request failed", async () => {
    $post.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error:
          "This member was already asked for this form in the last 24 hours",
      }),
    });
    renderPanel();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Request Information for Medical History",
      }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }));

    expect((await within(dialog).findByRole("alert")).textContent).toContain(
      "already asked",
    );
    expect(within(dialog).getByRole("button", { name: "Send" })).toBeTruthy();
  });

  it("ignores a request that finishes after the modal was reopened", async () => {
    let finish!: (response: unknown) => void;
    $post.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderPanel();
    const trigger = screen.getByRole("button", {
      name: "Request Information for Medical History",
    });

    fireEvent.click(trigger);
    let dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(trigger);
    dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Message (optional)"), {
      target: { value: "A new message." },
    });
    finish({ ok: true, json: async () => ({ id: "n1" }) });

    await waitFor(() => expect($post).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(within(dialog).queryByText(/Request sent/)).toBeNull();
    expect(
      (
        within(dialog).getByLabelText(
          "Message (optional)",
        ) as HTMLTextAreaElement
      ).value,
    ).toBe("A new message.");
  });
});

function chooseStatus(label: string) {
  const group = screen.getByRole("group", { name: "Application status" });
  fireEvent.keyDown(within(group).getByRole("button"), { key: "Enter" });
  fireEvent.click(screen.getByRole("menuitem", { name: label }));
}

describe("ReviewStatusDropdown", () => {
  it("saves the chosen status", async () => {
    $patch.mockResolvedValueOnce({ ok: true });
    render(
      <ReviewStatusDropdown
        submissionId="s1"
        initialStatus={SubmissionReviewStatus.Pending}
      />,
    );

    chooseStatus("Accepted");

    expect($patch).toHaveBeenCalledWith({
      param: { submissionId: "s1" },
      json: { status: SubmissionReviewStatus.Accepted },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Accepted" })).toBeTruthy(),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    // Accepting can change the member type the required forms panel uses.
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("shows that it's saving", async () => {
    let resolve!: (value: { ok: boolean }) => void;
    $patch.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    render(
      <ReviewStatusDropdown
        submissionId="s1"
        initialStatus={SubmissionReviewStatus.Pending}
      />,
    );

    chooseStatus("Under Review");

    expect(screen.getByRole("status").textContent).toBe("Saving…");
    resolve({ ok: true });
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(""),
    );
  });

  it("rolls back when the save fails", async () => {
    $patch.mockResolvedValueOnce({ ok: false, status: 500 });
    render(
      <ReviewStatusDropdown
        submissionId="s1"
        initialStatus={SubmissionReviewStatus.Pending}
      />,
    );

    chooseStatus("Rejected");

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pending" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Rejected" })).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });
});
