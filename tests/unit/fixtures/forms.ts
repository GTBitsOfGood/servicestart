import { FormComponentType, FormStatus } from "@/lib/schema";
import { DEFAULT_FORM_SETTINGS } from "@/lib/forms/constants";
import type { FormAnswerValue, FormDefinition } from "@/lib/forms/schema";

/**
 * Visionaries to the Throne's camp application, the first real form. The IDs
 * are fixed so the seed can insert it idempotently; `createForm` in testUtils
 * inserts copies with new IDs.
 */
export const VISIONARIES_APPLICATION_FORM: FormDefinition = {
  id: "5f1d0c3e-7a2b-4c1d-9e8f-000000000000",
  formId: "camp-application-2027",
  title: "Summer Camp 2027 Application",
  description: "Apply for a spot at the Visionaries to the Throne summer camp.",
  status: FormStatus.Published,
  settings: {
    ...DEFAULT_FORM_SETTINGS,
    confirmationMessage:
      "Thanks for applying! Your application has been submitted.",
  },
  components: [
    {
      id: "5f1d0c3e-7a2b-4c1d-9e8f-000000000001",
      type: FormComponentType.SectionHeader,
      label: "Contact Information",
      helpText: null,
      required: false,
      position: 0,
      config: {},
    },
    {
      id: "5f1d0c3e-7a2b-4c1d-9e8f-000000000002",
      type: FormComponentType.ShortText,
      label: "Student Name",
      helpText: null,
      required: true,
      position: 1,
      config: {},
    },
    {
      // Short text rather than a number, so leading zeros survive.
      id: "5f1d0c3e-7a2b-4c1d-9e8f-000000000003",
      type: FormComponentType.ShortText,
      label: "Student Number",
      helpText: "Include any leading zeros.",
      required: false,
      position: 2,
      config: {},
    },
    {
      id: "5f1d0c3e-7a2b-4c1d-9e8f-000000000004",
      type: FormComponentType.Email,
      label: "Student Email",
      helpText: null,
      required: true,
      position: 3,
      config: {},
    },
    {
      id: "5f1d0c3e-7a2b-4c1d-9e8f-000000000005",
      type: FormComponentType.ShortText,
      label: "Parent Name",
      helpText: null,
      required: true,
      position: 4,
      config: {},
    },
    {
      id: "5f1d0c3e-7a2b-4c1d-9e8f-000000000006",
      type: FormComponentType.Phone,
      label: "Parent Phone Number",
      helpText: null,
      required: true,
      position: 5,
      config: {},
    },
    {
      id: "5f1d0c3e-7a2b-4c1d-9e8f-000000000007",
      type: FormComponentType.Email,
      label: "Parent Email",
      helpText: null,
      required: true,
      position: 6,
      config: {},
    },
    {
      id: "5f1d0c3e-7a2b-4c1d-9e8f-000000000008",
      type: FormComponentType.SectionHeader,
      label: "Eligibility & Background",
      helpText: null,
      required: false,
      position: 7,
      config: {},
    },
    {
      id: "5f1d0c3e-7a2b-4c1d-9e8f-000000000009",
      type: FormComponentType.Number,
      label: "What grade will the student be headed to during Summer 2027?",
      helpText: null,
      required: true,
      position: 8,
      config: { min: 1, max: 12, integer: true },
    },
    {
      id: "5f1d0c3e-7a2b-4c1d-9e8f-00000000000a",
      type: FormComponentType.ShortText,
      label:
        "Does the camper currently take any medication? (Write N/A if none.)",
      helpText: null,
      required: true,
      position: 9,
      config: {},
    },
    {
      id: "5f1d0c3e-7a2b-4c1d-9e8f-00000000000b",
      type: FormComponentType.LongText,
      label: "Why would you like to be a part of this camp?",
      helpText: null,
      required: true,
      position: 10,
      config: { minWords: 100, maxWords: 150 },
    },
    {
      id: "5f1d0c3e-7a2b-4c1d-9e8f-00000000000c",
      type: FormComponentType.Image,
      label: "Headshot",
      helpText: "A clear, recent photo of the student.",
      required: true,
      position: 11,
      config: {},
    },
  ],
};

/**
 * Builds a valid answer for every question in a form, keyed by component ID.
 * Pass `uploadId` (a form_uploads row) when the form has an image question.
 */
export function buildSampleAnswers(
  definition: Pick<FormDefinition, "components">,
  opts: { uploadId?: string } = {},
) {
  const answers: Record<string, FormAnswerValue> = {};
  for (const component of definition.components) {
    switch (component.type) {
      case FormComponentType.ShortText:
        answers[component.id] = "Sample answer".slice(
          0,
          component.config.maxLength,
        );
        break;
      case FormComponentType.LongText:
        answers[component.id] = Array(
          Math.max(component.config.minWords ?? 1, 1),
        )
          .fill("word")
          .join(" ");
        break;
      case FormComponentType.Email:
        answers[component.id] = "applicant@example.com";
        break;
      case FormComponentType.Phone:
        answers[component.id] = "4045550123";
        break;
      case FormComponentType.Number:
        answers[component.id] =
          component.config.min ?? Math.min(1, component.config.max ?? 1);
        break;
      case FormComponentType.Image:
        if (!opts.uploadId) {
          throw new Error(
            `"${component.label}" is an image question; pass an uploadId`,
          );
        }
        answers[component.id] = { uploadId: opts.uploadId };
        break;
      case FormComponentType.SectionHeader:
        break;
    }
  }
  return answers;
}
