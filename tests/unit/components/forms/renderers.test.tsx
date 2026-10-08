import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DynamicFormContext,
  type DynamicFormContextValue,
} from "@/components/forms/DynamicFormContext";
import { FORM_RENDERERS } from "@/components/forms/renderers";
import ImageQuestion from "@/components/forms/questions/ImageQuestion";
import LongTextQuestion from "@/components/forms/questions/LongTextQuestion";
import SectionHeader from "@/components/forms/questions/SectionHeader";
import TextQuestion from "@/components/forms/questions/TextQuestion";
import type { FieldValue } from "@/components/forms/types";
import { FORM_UPLOAD_MAX_BYTES } from "@/lib/forms/constants";
import type { FormComponent, FormComponentOfType } from "@/lib/forms/schema";
import { FormComponentType } from "@/lib/schema";

const ID = "00000000-0000-4000-8000-000000000001";
const UPLOAD_ID = "3b0f6a52-8c1d-4e7a-9f20-6d5c4b3a2910";

function question<T extends FormComponentType>(
  type: T,
  overrides: Partial<FormComponent> = {},
) {
  return {
    id: ID,
    type,
    label: "Question",
    helpText: null,
    required: false,
    position: 0,
    config: {},
    ...overrides,
  } as FormComponentOfType<T>;
}

const handlers = () => ({ onChange: vi.fn(), onBlur: vi.fn() });

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(cleanup);

describe("FORM_RENDERERS", () => {
  it("has a renderer for every component type", () => {
    expect(Object.keys(FORM_RENDERERS).sort()).toEqual(
      Object.values(FormComponentType).sort(),
    );
  });
});

describe("TextQuestion", () => {
  it.each<
    [
      (
        | FormComponentType.ShortText
        | FormComponentType.Email
        | FormComponentType.Phone
        | FormComponentType.Number
      ),
      string,
      string | null,
    ]
  >([
    [FormComponentType.ShortText, "text", null],
    [FormComponentType.Email, "email", null],
    [FormComponentType.Phone, "tel", null],
    [FormComponentType.Number, "text", "decimal"],
  ])("renders %s as a %s input", (type, inputType, inputMode) => {
    render(
      <TextQuestion
        component={question(type, { label: "Answer" })}
        value=""
        disabled={false}
        {...handlers()}
      />,
    );

    const input = screen.getByLabelText("Answer");
    expect(input.getAttribute("type")).toBe(inputType);
    expect(input.getAttribute("inputmode")).toBe(inputMode);
  });

  it("uses a numeric keypad for whole numbers", () => {
    render(
      <TextQuestion
        component={question(FormComponentType.Number, {
          label: "Grade",
          config: { integer: true },
        } as Partial<FormComponent>)}
        value=""
        disabled={false}
        {...handlers()}
      />,
    );
    expect(screen.getByLabelText("Grade").getAttribute("inputmode")).toBe(
      "numeric",
    );
  });

  it("marks a required question", () => {
    render(
      <TextQuestion
        component={question(FormComponentType.ShortText, {
          label: "Name",
          required: true,
        })}
        value=""
        disabled={false}
        {...handlers()}
      />,
    );
    const input = screen.getByLabelText(/Name/);
    expect(input.hasAttribute("required")).toBe(true);
    expect(screen.getByText("*").getAttribute("aria-hidden")).toBe("true");
  });

  it("links its help text and error", () => {
    render(
      <TextQuestion
        component={question(FormComponentType.Email, {
          label: "Email",
          helpText: "We'll write to you here.",
        })}
        value="ada"
        error="Enter a valid email address"
        disabled={false}
        {...handlers()}
      />,
    );

    const input = screen.getByLabelText("Email");
    const describedBy = input.getAttribute("aria-describedby")!.split(" ");
    const descriptions = describedBy.map(
      (id) => document.getElementById(id)?.textContent,
    );
    expect(descriptions).toEqual([
      "We'll write to you here.",
      "Enter a valid email address",
    ]);
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("reports changes and blurs", () => {
    const { onChange, onBlur } = handlers();
    render(
      <TextQuestion
        component={question(FormComponentType.Phone, { label: "Phone" })}
        value=""
        disabled={false}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );

    const input = screen.getByLabelText("Phone");
    fireEvent.change(input, { target: { value: "404" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith("404");
    expect(onBlur).toHaveBeenCalled();
  });
});

describe("LongTextQuestion", () => {
  function Controlled() {
    const [value, setValue] = useState<FieldValue | undefined>("");
    return (
      <LongTextQuestion
        component={question(FormComponentType.LongText, {
          label: "Why?",
          config: { minWords: 100, maxWords: 150 },
        } as Partial<FormComponent>)}
        value={value}
        disabled={false}
        onChange={setValue}
        onBlur={() => {}}
      />
    );
  }

  it("counts words as they're typed", () => {
    render(<Controlled />);
    const textarea = screen.getByLabelText("Why?");
    expect(screen.getByText("0 words (100–150 words)")).toBeTruthy();

    fireEvent.change(textarea, { target: { value: "one" } });
    expect(screen.getByText("1 word (100–150 words)")).toBeTruthy();

    fireEvent.change(textarea, { target: { value: " one two\nthree " } });
    const count = screen.getByText("3 words (100–150 words)");
    expect(textarea.getAttribute("aria-describedby")).toContain(count.id);
  });
});

describe("SectionHeader", () => {
  it("renders a heading and its description", () => {
    render(
      <SectionHeader
        component={question(FormComponentType.SectionHeader, {
          label: "Contact Information",
          helpText: "How we'll reach you.",
        })}
        value={undefined}
        disabled={false}
        {...handlers()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Contact Information" }),
    ).toBeTruthy();
    expect(screen.getByText("How we'll reach you.")).toBeTruthy();
  });
});

describe("ImageQuestion", () => {
  function renderImage(
    context: Partial<DynamicFormContextValue> = {},
    initial?: FieldValue,
  ) {
    const onChange = vi.fn();
    const uploadImage = vi.fn(
      async (_formId: string, _file: File, onProgress: (n: number) => void) => {
        onProgress(50);
        return { id: UPLOAD_ID };
      },
    );
    const setUploading = vi.fn();
    function Controlled() {
      const [value, setValue] = useState(initial);
      return (
        <ImageQuestion
          component={question(FormComponentType.Image, {
            label: "Headshot",
            required: true,
          })}
          value={value}
          disabled={false}
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
          onBlur={() => {}}
        />
      );
    }
    render(
      <DynamicFormContext.Provider
        value={{
          formId: "camp-application-2027",
          preview: false,
          uploadImage,
          setUploading,
          ...context,
        }}
      >
        <Controlled />
      </DynamicFormContext.Provider>,
    );
    return { onChange, uploadImage, setUploading };
  }

  function selectFile(file: File) {
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [file] } });
  }

  const png = (size = 10) =>
    new File([new Uint8Array(size)], "me.png", { type: "image/png" });

  it("uploads the selected image and shows a preview", async () => {
    const { onChange, uploadImage, setUploading } = renderImage();
    const file = png();

    selectFile(file);

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ uploadId: UPLOAD_ID }),
    );
    expect(uploadImage).toHaveBeenCalledWith(
      "camp-application-2027",
      file,
      expect.any(Function),
    );
    expect(setUploading).toHaveBeenCalledWith(ID, true);
    expect(setUploading).toHaveBeenLastCalledWith(ID, false);
    expect(screen.getByRole("img").getAttribute("src")).toBe("blob:preview");
    expect(screen.getByRole("button", { name: "Replace image" })).toBeTruthy();
  });

  it("shows progress while uploading", async () => {
    let finish!: (value: { id: string }) => void;
    renderImage({
      uploadImage: (_formId, _file, onProgress) => {
        onProgress(40);
        return new Promise((resolve) => (finish = resolve));
      },
    });

    selectFile(png());

    const progress = await screen.findByRole("progressbar");
    expect(progress.getAttribute("aria-valuenow")).toBe("40");
    expect(
      (
        screen.getByRole("button", {
          name: "Upload image",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    await act(async () => finish({ id: UPLOAD_ID }));
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("removes the image", async () => {
    const { onChange } = renderImage({}, { uploadId: UPLOAD_ID });

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(onChange).toHaveBeenCalledWith(undefined);
    expect(screen.getByRole("button", { name: "Upload image" })).toBeTruthy();
  });

  it("keeps the current image when a replacement fails", async () => {
    const { onChange } = renderImage(
      {
        uploadImage: async () => {
          throw new Error("Couldn't upload the image. Try again.");
        },
      },
      { uploadId: UPLOAD_ID },
    );

    selectFile(png());

    expect(
      await screen.findByText("Couldn't upload the image. Try again."),
    ).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Replace image" })).toBeTruthy();
  });

  it.each([
    [
      "a file that isn't an image",
      new File(["hi"], "notes.txt", { type: "text/plain" }),
      "Upload a JPEG, PNG, or WebP image",
    ],
    [
      "an image over 5 MB",
      png(FORM_UPLOAD_MAX_BYTES + 1),
      "Images must be 5 MB or smaller",
    ],
  ])("rejects %s without uploading", async (_, file, message) => {
    const { uploadImage } = renderImage();

    selectFile(file);

    const error = await screen.findByText(message);
    expect(uploadImage).not.toHaveBeenCalled();
    const button = screen.getByRole("button", { name: "Upload image" });
    expect(button.getAttribute("aria-describedby")).toContain(error.id);
    expect(button.getAttribute("aria-invalid")).toBe("true");
  });

  it("turns off uploads in preview", () => {
    renderImage({ preview: true });
    expect(
      (
        screen.getByRole("button", {
          name: "Upload image",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText("Uploads are off in preview")).toBeTruthy();
  });
});
