import { render, fireEvent } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AuthInput from "@/components/auth/AuthInput";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";

describe("auth control hydration", () => {
  it("prevents editing before hydration and enables working handlers afterward", () => {
    const onChange = vi.fn();
    const onClick = vi.fn();
    const controls = (
      <div>
        <AuthInput name="email" label="Email" onChange={onChange} />
        <AuthSubmitButton type="button" onClick={onClick}>
          Login
        </AuthSubmitButton>
      </div>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(controls);
    document.body.append(container);
    expect(container.querySelector("input")!.disabled).toBe(true);
    expect(container.querySelector("button")!.disabled).toBe(true);

    const view = render(controls, { container, hydrate: true });
    const input = view.getByLabelText("Email") as HTMLInputElement;
    const button = view.getByRole("button", {
      name: "Login",
    }) as HTMLButtonElement;
    expect(input.disabled).toBe(false);
    expect(button.disabled).toBe(false);
    fireEvent.change(input, { target: { value: "person@example.com" } });
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledOnce();
    expect(onClick).toHaveBeenCalledOnce();
    view.unmount();
    container.remove();
  });

  it("keeps pending actions disabled after hydration", () => {
    const view = render(<AuthSubmitButton pending>Login</AuthSubmitButton>);
    expect((view.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    view.unmount();
  });
});
