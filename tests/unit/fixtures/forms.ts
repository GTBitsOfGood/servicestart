import { FormComponentType, FormStatus, MemberType } from "@/lib/schema";
import { DEFAULT_FORM_SETTINGS } from "@/lib/forms/constants";
import type {
  FormAnswerValue,
  FormComponent,
  FormDefinition,
} from "@/lib/forms/schema";

/**
 * Fixed IDs for Visionaries fixtures and seed data, so the seed can insert
 * them idempotently and tests and demos can link to them. Group 0 is the camp
 * application, 1–4 the attendee forms, 5–6 the demo forms, and higher groups
 * seeded submissions and uploads (see scripts/visionariesSeed.ts).
 */
export function visionariesId(group: number, item: number) {
  return `5f1d0c3e-7a2b-4c1d-9e8f-${(group * 0x1000 + item)
    .toString(16)
    .padStart(12, "0")}`;
}

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
    assignedMemberTypes: [MemberType.Applicant],
    dueAt: "2027-04-01T03:59:00.000Z",
    acceptedMemberType: MemberType.Attendee,
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

type FixtureQuestion = Omit<FormComponent, "id" | "position">;

const sectionHeader = (label: string, helpText: string | null = null) =>
  ({
    type: FormComponentType.SectionHeader,
    label,
    helpText,
    required: false,
    config: {},
  }) satisfies FixtureQuestion;

const shortText = (
  label: string,
  required = true,
  helpText: string | null = null,
) =>
  ({
    type: FormComponentType.ShortText,
    label,
    helpText,
    required,
    config: {},
  }) satisfies FixtureQuestion;

// A Visionaries form whose IDs come from `group`.
function visionariesForm(
  group: number,
  form: Omit<FormDefinition, "id" | "components">,
  questions: FixtureQuestion[],
): FormDefinition {
  return {
    ...form,
    id: visionariesId(group, 0),
    components: questions.map(
      (question, position) =>
        ({
          ...question,
          id: visionariesId(group, position + 1),
          position,
        }) as FormComponent,
    ),
  };
}

// One of the forms accepted campers fill out before camp. Built from the
// Sprint 3 question types, so they work before #321 adds more.
function attendeeForm(
  group: number,
  formId: string,
  title: string,
  description: string,
  dueAt: string,
  questions: FixtureQuestion[],
): FormDefinition {
  return visionariesForm(
    group,
    {
      formId,
      title,
      description,
      status: FormStatus.Published,
      settings: {
        ...DEFAULT_FORM_SETTINGS,
        closesAt: "2027-06-01T03:59:00.000Z",
        confirmationMessage: "Thanks! We've saved this form.",
        assignedMemberTypes: [MemberType.Attendee],
        dueAt,
        acceptedMemberType: null,
      },
    },
    questions,
  );
}

/** The four forms Visionaries' accepted campers fill out, in due order. */
export const VISIONARIES_ATTENDEE_FORMS: FormDefinition[] = [
  attendeeForm(
    1,
    "emergency-contact-2027",
    "Emergency Contact Information",
    "Who we should call if something happens at camp.",
    "2027-05-01T03:59:00.000Z",
    [
      sectionHeader("Emergency Contact"),
      shortText("Contact Name"),
      shortText("Relationship to Camper"),
      {
        type: FormComponentType.Phone,
        label: "Contact Phone Number",
        helpText: null,
        required: true,
        config: {},
      },
      {
        type: FormComponentType.Email,
        label: "Contact Email",
        helpText: null,
        required: false,
        config: {},
      },
      sectionHeader("Second Emergency Contact", "Optional, but recommended."),
      shortText("Second Contact Name", false),
      {
        type: FormComponentType.Phone,
        label: "Second Contact Phone Number",
        helpText: null,
        required: false,
        config: {},
      },
    ],
  ),
  attendeeForm(
    2,
    "consent-form-2027",
    "Consent Form",
    "A parent or guardian's consent for the camper to attend.",
    "2027-05-08T03:59:00.000Z",
    [
      sectionHeader(
        "Consent",
        "I consent that the camper named below will take part in the Building Your Throne Summer 2027 camp in Atlanta, Georgia.",
      ),
      shortText("Camper's Full Name"),
      shortText(
        "Parent or Guardian's Full Name",
        true,
        "Typing your full name counts as your signature.",
      ),
    ],
  ),
  attendeeForm(
    3,
    "medical-history-2027",
    "Medical History",
    "What our staff should know to keep the camper safe and healthy.",
    "2027-05-15T03:59:00.000Z",
    [
      sectionHeader("Medication & Allergies"),
      shortText(
        "Does the camper currently take any medication? (Write N/A if none.)",
      ),
      shortText("Does the camper have any allergies? (Write N/A if none.)"),
      {
        type: FormComponentType.LongText,
        label: "Anything else our staff should know about the camper's health?",
        helpText: null,
        required: false,
        config: { maxWords: 300 },
      },
      sectionHeader("Doctor"),
      shortText("Doctor's Name", false),
      {
        type: FormComponentType.Phone,
        label: "Doctor's Phone Number",
        helpText: null,
        required: false,
        config: {},
      },
    ],
  ),
  attendeeForm(
    4,
    "liability-release-2027",
    "Liability Release Form",
    "The camp's liability release, signed by a parent or guardian.",
    "2027-05-22T03:59:00.000Z",
    [
      sectionHeader(
        "Release",
        "By signing, you agree to the camp's liability release. Ask camp staff for a copy of the full release.",
      ),
      shortText(
        "Parent or Guardian's Full Name",
        true,
        "Typing your full name counts as your signature.",
      ),
      shortText("Today's Date", true, "MM/DD/YYYY"),
    ],
  ),
];

/**
 * Two optional Visionaries forms for showing form management: a draft to
 * preview and publish, and a closed form to reopen. They aren't assigned to a
 * member type, so they never count toward a student's required forms.
 */
export const VISIONARIES_DEMO_FORMS: FormDefinition[] = [
  visionariesForm(
    5,
    {
      formId: "family-showcase-rsvp",
      title: "Family Showcase RSVP",
      description:
        "Let us know who's coming to the Family Showcase on the last camp day.",
      status: FormStatus.Draft,
      settings: {
        ...DEFAULT_FORM_SETTINGS,
        confirmationMessage: "Thanks! We'll save seats for your family.",
      },
    },
    [
      sectionHeader("Your Family"),
      shortText("Camper's Full Name"),
      {
        type: FormComponentType.Number,
        label: "How many guests are coming, including the camper?",
        helpText: "Up to 6 per camper.",
        required: true,
        config: { min: 1, max: 6, integer: true },
      },
      {
        type: FormComponentType.Email,
        label: "Email for showcase updates",
        helpText: null,
        required: false,
        config: {},
      },
      {
        type: FormComponentType.LongText,
        label:
          "Anything we can do to make the showcase easier for your family?",
        helpText: null,
        required: false,
        config: { maxWords: 100 },
      },
    ],
  ),
  visionariesForm(
    6,
    {
      formId: "open-house-rsvp-2026",
      title: "Fall 2026 Open House RSVP",
      description: "RSVP for our fall open house for new families.",
      status: FormStatus.Closed,
      settings: DEFAULT_FORM_SETTINGS,
    },
    [
      shortText("Student Name"),
      {
        type: FormComponentType.Email,
        label: "Parent Email",
        helpText: null,
        required: true,
        config: {},
      },
      {
        type: FormComponentType.Number,
        label: "How many people are coming?",
        helpText: null,
        required: true,
        config: { min: 1, max: 8, integer: true },
      },
    ],
  ),
];

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
      case FormComponentType.SingleChoice:
      case FormComponentType.Dropdown:
        answers[component.id] = component.config.options[0];
        break;
      case FormComponentType.Checkboxes:
        answers[component.id] = component.config.options.slice(
          0,
          Math.max(component.config.minSelected ?? 1, 1),
        );
        break;
      case FormComponentType.Date:
        answers[component.id] = component.config.min ?? "2027-06-02";
        break;
      case FormComponentType.YesNo:
        answers[component.id] = true;
        break;
    }
  }
  return answers;
}
