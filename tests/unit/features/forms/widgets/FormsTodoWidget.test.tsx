// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import FormsTodoWidget, {
  FormsTodoWidgetView,
} from "@/features/forms/widgets/FormsTodoWidget";
import type { FormTodoCard } from "@/features/forms/widgets/formProgress";
import { FormStatus, OrganizationConfigKey } from "@/core/db/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import {
  addMember,
  buildTestUser,
  createForm,
  createOrganization,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";
import { MemberTypeKeySchema } from "@/features/membership/lib/memberTypeKey";

function todoCard(overrides: Partial<FormTodoCard> = {}): FormTodoCard {
  return {
    formUuid: "11111111-1111-4111-8111-111111111111",
    formId: "emergency-contact",
    title: "Emergency Contact",
    dueAt: "2027-04-01T00:00:00.000Z",
    pastDue: false,
    action: { kind: "open", href: "/forms/emergency-contact" },
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("FormsTodoWidgetView", () => {
  it("shows an open form with due date, Not Started, and a link", () => {
    render(<FormsTodoWidgetView cards={[todoCard()]} />);

    expect(screen.getByText("Emergency Contact")).toBeTruthy();
    expect(screen.getByText(/Due/i)).toBeTruthy();
    expect(screen.getByText("Not Started")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Open Emergency Contact" })
        .getAttribute("href"),
    ).toBe("/forms/emergency-contact");
  });

  it("shows Past due instead of Due when pastDue is true", () => {
    render(
      <FormsTodoWidgetView
        cards={[todoCard({ pastDue: true, dueAt: "2027-03-01T00:00:00.000Z" })]}
      />,
    );

    expect(screen.getByText("Past due")).toBeTruthy();
    expect(screen.queryByText(/^Due /)).toBeNull();
  });

  it("shows not-yet-open state without a link", () => {
    render(
      <FormsTodoWidgetView
        cards={[
          todoCard({
            title: "Future Form",
            action: { kind: "not_yet_open" },
          }),
        ]}
      />,
    );

    expect(screen.getByText("Future Form")).toBeTruthy();
    expect(screen.getByText("Not yet open")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows closed state without a link", () => {
    render(
      <FormsTodoWidgetView
        cards={[
          todoCard({
            title: "Closed Form",
            action: { kind: "closed" },
          }),
        ]}
      />,
    );

    expect(screen.getByText("Closed Form")).toBeTruthy();
    expect(screen.getByText("Closed")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows the empty copy when there are no cards", () => {
    render(<FormsTodoWidgetView cards={[]} />);

    expect(screen.getByText("You're all caught up!")).toBeTruthy();
    expect(
      screen.getByText(
        "Keep an eye on your inbox for updates on your next steps.",
      ),
    ).toBeTruthy();
  });

  it("scrolls the list body inside the fixed grid slot", () => {
    const { container } = render(
      <FormsTodoWidgetView
        cards={[todoCard(), todoCard({ formUuid: "222" })]}
      />,
    );

    const scrollBody = container.querySelector(".overflow-y-auto");
    expect(scrollBody?.className).toContain("min-h-0");
  });
});

describe("FormsTodoWidget", () => {
  it("renders nothing when FormsEnabled is off", async () => {
    const org = await createOrganization(`todo-off-${crypto.randomUUID()}`);
    const { user } = await signUpAndGetSession(buildTestUser());
    await addMember(user.id, org.id, "member", "attendee");
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.FormsEnabled,
      "false",
    );

    const tree = await FormsTodoWidget({
      organizationId: org.id,
      userId: user.id,
      audience: MemberTypeKeySchema.parse("attendee"),
    });

    const { container } = render(tree);
    expect(container.firstChild).toBeNull();
  });

  it("never shows another organization's form titles", async () => {
    const orgA = await createOrganization(`todo-a-${crypto.randomUUID()}`);
    const orgB = await createOrganization(`todo-b-${crypto.randomUUID()}`);
    const { user } = await signUpAndGetSession(buildTestUser());
    await addMember(user.id, orgA.id, "member", "attendee");
    await OrganizationConfigService.setConfig(
      orgA.id,
      OrganizationConfigKey.FormsEnabled,
      "true",
    );
    await OrganizationConfigService.setConfig(
      orgB.id,
      OrganizationConfigKey.FormsEnabled,
      "true",
    );
    await createForm(orgA.id, {
      title: "Org A Required Form",
      status: FormStatus.Published,
      settings: {
        assignedMemberTypes: [MemberTypeKeySchema.parse("attendee")],
      },
    });
    await createForm(orgB.id, {
      title: "Org B Secret Title",
      status: FormStatus.Published,
      settings: {
        assignedMemberTypes: [MemberTypeKeySchema.parse("attendee")],
      },
    });

    const tree = await FormsTodoWidget({
      organizationId: orgA.id,
      userId: user.id,
      audience: MemberTypeKeySchema.parse("attendee"),
    });
    render(tree);

    expect(screen.getByText("Org A Required Form")).toBeTruthy();
    expect(screen.queryByText("Org B Secret Title")).toBeNull();
  });
});
