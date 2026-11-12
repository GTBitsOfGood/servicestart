// @vitest-environment jsdom
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemberTypeKeySchema } from "@/features/membership/lib/memberTypeKey";
import { memberTypeInUseMessage } from "@/features/membership/lib/memberTypeErrors";

const mocks = vi.hoisted(() => ({
  orderPut: vi.fn(),
  deleteType: vi.fn(),
  patchType: vi.fn(),
  postType: vi.fn(),
  signupDefaultPut: vi.fn(),
}));

vi.mock("@/core/api/client", () => ({
  default: {
    memberTypes: {
      $post: mocks.postType,
      order: { $put: mocks.orderPut },
      signupDefault: { $put: mocks.signupDefaultPut },
      ":key": {
        $patch: mocks.patchType,
        $delete: mocks.deleteType,
      },
    },
  },
}));

vi.mock("@phosphor-icons/react", () => ({
  ArrowUp: () => <span aria-hidden>up</span>,
  ArrowDown: () => <span aria-hidden>down</span>,
  Trash: () => <span aria-hidden>trash</span>,
}));

vi.mock("@/components/theme/ThemedButton", () => ({
  default: ({
    children,
    disabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/bog/BogModal/BogModal", () => ({
  default: ({
    trigger,
    description,
    onPrimary,
    primaryLabel,
    openState,
  }: {
    trigger?: React.ReactElement<{
      onClick?: (event: React.MouseEvent) => void;
    }>;
    description?: React.ReactNode;
    onPrimary?: () => void;
    primaryLabel?: string;
    openState?: { open: boolean; setOpen: (value: boolean) => void };
  }) => (
    <div>
      {trigger
        ? React.cloneElement(trigger, {
            onClick: (event: React.MouseEvent) => {
              trigger.props.onClick?.(event);
              openState?.setOpen(true);
            },
          })
        : null}
      {openState?.open ? (
        <div role="dialog">
          {description}
          {primaryLabel ? (
            <button type="button" onClick={onPrimary}>
              {primaryLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  ),
}));

import MemberTypesClient from "@/features/membership/components/MemberTypesClient";

const alpha = {
  key: MemberTypeKeySchema.parse("alpha"),
  label: "Alpha",
  pluralLabel: "Alphas",
  position: 0,
  isSignupDefault: false,
};

const beta = {
  key: MemberTypeKeySchema.parse("beta"),
  label: "Beta",
  pluralLabel: "Betas",
  position: 1,
  isSignupDefault: true,
};

const gamma = {
  key: MemberTypeKeySchema.parse("gamma"),
  label: "Gamma",
  pluralLabel: "Gammas",
  position: 2,
  isSignupDefault: false,
};

const labelOrder = () =>
  (
    screen.getAllByLabelText("Label", { exact: true }) as HTMLInputElement[]
  ).map((input) => input.value);

describe("MemberTypesClient", () => {
  beforeEach(() => {
    mocks.orderPut.mockReset();
    mocks.deleteType.mockReset();
    mocks.patchType.mockReset();
    mocks.postType.mockReset();
    mocks.signupDefaultPut.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders types in position order", () => {
    render(<MemberTypesClient initialTypes={[gamma, alpha, beta]} />);
    expect(labelOrder()).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(screen.getByText("Key: beta")).toBeTruthy();
  });

  it("rolls back optimistic reorder when the API rejects the request", async () => {
    mocks.orderPut.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Reorder failed" }),
    });

    render(<MemberTypesClient initialTypes={[alpha, beta]} />);
    expect(labelOrder()).toEqual(["Alpha", "Beta"]);

    fireEvent.click(
      screen.getByRole("button", { name: "Move member type 2 up" }),
    );

    await waitFor(() => {
      expect(labelOrder()).toEqual(["Beta", "Alpha"]);
    });

    await waitFor(() => {
      expect(labelOrder()).toEqual(["Alpha", "Beta"]);
    });
    expect(screen.getByRole("alert").textContent).toContain("Reorder failed");
    expect(mocks.orderPut).toHaveBeenCalledWith({
      json: [beta.key, alpha.key],
    });
  });

  it("shows the server 409 message in the delete confirm", async () => {
    const message = memberTypeInUseMessage(2, 0, "Beta");
    mocks.deleteType.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: message, members: 2, forms: 0 }),
    });

    render(<MemberTypesClient initialTypes={[alpha, beta]} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Delete member type Beta" }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(within(dialog).getByRole("alert").textContent).toContain(message);
    });
    expect(labelOrder()).toEqual(["Alpha", "Beta"]);
  });
});
