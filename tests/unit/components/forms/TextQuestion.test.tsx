import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TextQuestion from "@/components/forms/questions/TextQuestion";
import { fieldId } from "@/components/forms/types";
import { FormComponentType } from "@/lib/schema";

const NAME_ID = "00000000-0000-4000-8000-000000000001";

function serverMarkup(
  overrides: {
    type?: FormComponentType.ShortText | FormComponentType.Email;
  } = {},
) {
  const html = renderToString(
    <TextQuestion
      component={{
        id: NAME_ID,
        type: overrides.type ?? FormComponentType.ShortText,
        label: "Student Name",
        helpText: "As on their ID.",
        required: true,
        position: 0,
        config: {},
      }}
      value="Ada"
      disabled={false}
      readOnly={false}
      onChange={() => {}}
      onBlur={() => {}}
    />,
  );
  const container = document.createElement("div");
  container.innerHTML = html;
  return container;
}

describe("TextQuestion", () => {
  // Firefox never links a label to an input whose id appears after the page
  // is parsed, so the server markup has to carry it.
  it("labels its input in the server-rendered markup", () => {
    const container = serverMarkup();

    const input = container.querySelector("input");
    const label = container.querySelector("label");
    expect(input?.id).toBe(fieldId(NAME_ID));
    expect(label?.htmlFor).toBe(input?.id);
    expect(input?.labels).toHaveLength(1);
    expect(input?.labels?.[0].textContent).toContain("Student Name");
  });

  it("describes its input with the help text", () => {
    const container = serverMarkup();

    const describedBy = container
      .querySelector("input")
      ?.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(container.querySelector(`[id="${describedBy}"]`)?.textContent).toBe(
      "As on their ID.",
    );
  });

  it("uses the email input type for email questions", () => {
    const container = serverMarkup({ type: FormComponentType.Email });

    expect(container.querySelector("input")?.type).toBe("email");
  });
});
