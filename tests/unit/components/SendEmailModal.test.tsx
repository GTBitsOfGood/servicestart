// @vitest-environment happy-dom
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SendEmailModal from "@/components/SendEmailModal";

vi.mock("@/components/bog/BogIcon/BogIcon", () => ({
  default: ({ name }: { name: string }) => (
    <span data-testid={`icon-${name}`} />
  ),
}));

vi.mock("@/components/bog/BogModal/BogModal", () => ({
  default: ({
    title,
    description,
  }: {
    title: React.ReactNode;
    description: React.ReactNode;
  }) => (
    <div>
      {title}
      {description}
    </div>
  ),
}));

vi.mock("@/components/bog/BogButton/BogButton", () => ({
  default: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/bog/BogTextInput/BogTextInput", () => ({
  default: ({
    name,
    label,
    value,
    onChange,
    multiline,
  }: {
    name: string;
    label: string;
    value: string;
    onChange: (e: { target: { value: string } }) => void;
    multiline?: boolean;
  }) =>
    multiline ? (
      <textarea
        aria-label={label}
        name={name}
        value={value}
        onChange={onChange}
      />
    ) : (
      <input aria-label={label} name={name} value={value} onChange={onChange} />
    ),
}));

// The recipient picker is irrelevant here; recipients come from props.
vi.mock("react-select", () => ({ default: () => null }));

afterEach(cleanup);

function renderModal(
  overrides: Partial<{ onSend: unknown; onClose: unknown }>,
) {
  const onSend = (overrides.onSend ?? vi.fn()) as never;
  const onClose = (overrides.onClose ?? vi.fn()) as never;

  render(
    <SendEmailModal
      isOpen
      onClose={onClose as () => void}
      recipients={[{ id: "user-1", name: "Member One" }]}
      initialRecipientIds={["user-1"]}
      onSend={onSend as never}
    />,
  );

  return { onSend, onClose };
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function clickSend() {
  fireEvent.click(screen.getByRole("button", { name: "Send Email" }));
}

describe("SendEmailModal", () => {
  it("forwards every filled field to onSend", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderModal({ onSend });

    fill("Headline", "Spring Newsletter");
    fill("Subtitle", "A note from our director");
    fill("Text", "Thanks for volunteering.");
    fill("Footer", "Unsubscribe by replying.");
    clickSend();

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend).toHaveBeenCalledWith({
      subject: "Spring Newsletter",
      subtitle: "A note from our director",
      body: "Thanks for volunteering.",
      footer: "Unsubscribe by replying.",
      recipientIds: ["user-1"],
    });
  });

  it("omits blank optional fields instead of sending empty strings", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderModal({ onSend });

    fill("Headline", "Headline");
    fill("Text", "Body");
    clickSend();

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));

    const payload = onSend.mock.calls[0][0];
    expect(payload).toEqual({
      subject: "Headline",
      body: "Body",
      recipientIds: ["user-1"],
    });
    expect(payload).not.toHaveProperty("subtitle");
    expect(payload).not.toHaveProperty("footer");
  });

  it("trims whitespace from every field", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderModal({ onSend });

    fill("Headline", "  Headline  ");
    fill("Subtitle", "  Subtitle  ");
    fill("Text", "  Body  ");
    fill("Footer", "   ");
    clickSend();

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend).toHaveBeenCalledWith({
      subject: "Headline",
      subtitle: "Subtitle",
      body: "Body",
      recipientIds: ["user-1"],
    });
  });

  it("does not send when a required field is empty", () => {
    const onSend = vi.fn();
    renderModal({ onSend });

    fill("Headline", "Headline only");
    clickSend();

    expect(onSend).not.toHaveBeenCalled();
  });

  it("keeps the modal open and shows the error when the send fails", async () => {
    const onSend = vi.fn().mockRejectedValue(new Error("Failed to send email"));
    const onClose = vi.fn();
    renderModal({ onSend, onClose });

    fill("Headline", "Headline");
    fill("Text", "Body");
    clickSend();

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "Failed to send email",
      ),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes the modal after a successful send", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderModal({ onSend, onClose });

    fill("Headline", "Headline");
    fill("Text", "Body");
    clickSend();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not render the unwired send-message-to-recipient checkbox", () => {
    renderModal({});

    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
