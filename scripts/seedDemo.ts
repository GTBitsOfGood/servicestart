import "dotenv/config";
import { and, eq } from "drizzle-orm";
import db, { getDbUrl } from "@/lib/db";
import { DEFAULT_FORM_SETTINGS } from "@/lib/forms/constants";
import type { FormComponent, FormDefinition } from "@/lib/forms/schema";
import {
  EventVisibility,
  events,
  FormComponentType,
  formComponents,
  forms,
  FormStatus,
  users,
  OrganizationConfigKey,
} from "@/lib/schema";
import { main as seed } from "./seed";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";

const demoFormId = (item: number) =>
  `0d3e0f00-5e7f-4c1d-8b2c-${item.toString(16).padStart(12, "0")}`;

/** A published ServiceStart form using every question type members can fill out. */
export const DEMO_FORM: FormDefinition = {
  id: demoFormId(0),
  formId: "volunteer-interest",
  title: "Volunteer Interest Form",
  description: "Tell us about yourself and how you'd like to help.",
  status: FormStatus.Published,
  settings: {
    ...DEFAULT_FORM_SETTINGS,
    confirmationMessage:
      "Thanks for signing up! We'll reach out about upcoming events.",
  },
  components: (
    [
      {
        type: FormComponentType.SectionHeader,
        label: "About You",
        helpText: null,
        required: false,
        config: {},
      },
      {
        type: FormComponentType.ShortText,
        label: "Full Name",
        helpText: null,
        required: true,
        config: {},
      },
      {
        type: FormComponentType.Email,
        label: "Email",
        helpText: null,
        required: true,
        config: {},
      },
      {
        type: FormComponentType.Phone,
        label: "Phone Number",
        helpText: null,
        required: false,
        config: {},
      },
      {
        type: FormComponentType.SectionHeader,
        label: "Volunteering",
        helpText: null,
        required: false,
        config: {},
      },
      {
        type: FormComponentType.Number,
        label: "How many hours a month can you volunteer?",
        helpText: "Between 1 and 40.",
        required: true,
        config: { min: 1, max: 40, integer: true },
      },
      {
        type: FormComponentType.LongText,
        label: "Why do you want to volunteer with us?",
        helpText: "50 words or fewer.",
        required: true,
        config: { maxWords: 50 },
      },
      {
        type: FormComponentType.Image,
        label: "Photo for your volunteer badge",
        helpText: "A JPEG, PNG, or WebP under 5 MB.",
        required: false,
        config: {},
      },
    ] satisfies Omit<FormComponent, "id" | "position">[]
  ).map(
    (question, position) =>
      ({
        ...question,
        id: demoFormId(position + 1),
        position,
      }) as FormComponent,
  ),
};

/** Recreates the demo form, clearing its responses and any status changes. */
async function seedDemoForm(createdBy: string) {
  const { components, ...form } = DEMO_FORM;
  await db.transaction(async (tx) => {
    // Questions, responses, and uploads cascade.
    await tx
      .delete(forms)
      .where(
        and(
          eq(forms.id, form.id),
          eq(forms.organizationId, "org_servicestart"),
        ),
      );
    await tx
      .insert(forms)
      .values({ ...form, organizationId: "org_servicestart", createdBy });
    await tx.insert(formComponents).values(
      components.map((component) => ({
        ...component,
        formId: form.id,
        organizationId: "org_servicestart",
      })),
    );
  });
}

/** Refresh only the dedicated demo fixtures; retain accounts and other events. */
export async function seedDemo(now = new Date()) {
  const url = new URL(getDbUrl());
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error(
      "Demo seeding requires a local DB_URL; never use production.",
    );
  }
  await seed();
  await OrganizationConfigService.setConfig(
    "org_horizontal_center",
    OrganizationConfigKey.LogoUrl,
    "/bog.svg",
  );
  await OrganizationConfigService.setConfig(
    "org_horizontal_center",
    OrganizationConfigKey.Tagline,
    "Together we serve our community.",
  );
  await OrganizationConfigService.setConfig(
    "org_horizontal_center",
    OrganizationConfigKey.PrimaryColor,
    "#5C218C",
  );
  await OrganizationConfigService.setConfig(
    "org_horizontal_center",
    OrganizationConfigKey.SecondaryColor,
    "#C29BDC",
  );
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.organizationId, "org_servicestart"),
        eq(users.email, "admin@example.com"),
      ),
    );
  if (!admin) throw new Error("Seeded administrator is missing.");

  for (let index = 0; index < 2; index++) {
    const published = index === 0;
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() + 14 + index * 7);
    start.setUTCHours(15, 0, 0, 0);
    const fixture = {
      id: `demo_event_${published ? "published" : "draft"}`,
      organizationId: "org_servicestart",
      name: published
        ? "Demo: Community park cleanup"
        : "Demo: Volunteer workshop",
      location: "123 Main St, Atlanta, GA 30332",
      description: "Help our community. Bring gloves and a water bottle.",
      startTimestamp: start,
      duration: "2 hours",
      rsvpLimit: 20,
      rsvpDeadline: new Date(start.getTime() - 86_400_000),
      visibility: EventVisibility.Public,
      publishedAt: published ? now : null,
      publishedById: published ? admin.id : null,
    };
    await db
      .insert(events)
      .values(fixture)
      .onConflictDoUpdate({ target: events.id, set: fixture });
  }

  await OrganizationConfigService.setConfig(
    "org_servicestart",
    OrganizationConfigKey.FormsEnabled,
    "true",
  );
  await seedDemoForm(admin.id);
}

if (require.main === module) {
  seedDemo()
    .then(() => {
      console.log(
        "Demo ready: one upcoming published event, one editable draft, and the volunteer interest form at localhost:3000/forms/volunteer-interest.",
      );
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
