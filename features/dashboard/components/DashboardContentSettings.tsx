"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/core/api/client";
import {
  DashboardHeaderConfigSchema,
  type DashboardHeaderConfig,
  type DashboardHeaderContent,
} from "@/features/dashboard/lib/header";
import {
  OrganizationFooterSchema,
  SOCIAL_PLATFORMS,
  type OrganizationFooter,
  type SocialPlatform,
} from "@/features/navigation";
import {
  PostDashboardAlertSchema,
  type PostDashboardAlert,
} from "@/features/communications";
import { MemberType } from "@/features/membership";
import { OrganizationConfigKey } from "@/core/config/schema";
import SaveBanner from "@/components/SaveBanner";
import BogButton from "@/components/theme/ThemedButton";

type EditableAudience = "member" | "applicant" | "attendee";
type HeaderField = keyof DashboardHeaderContent;
type FieldErrors = Record<string, string>;

const HEADER_FIELDS: ReadonlyArray<{
  key: HeaderField;
  label: string;
  maxLength: number;
  multiline?: boolean;
  placeholder?: string;
}> = [
  {
    key: "title",
    label: "Title",
    maxLength: 120,
    placeholder: "Hello, {firstName}!",
  },
  { key: "subtitle", label: "Subtitle", maxLength: 200 },
  { key: "location", label: "Location", maxLength: 200 },
  { key: "dates", label: "Dates", maxLength: 100 },
  { key: "schedule", label: "Schedule", maxLength: 100 },
  {
    key: "description",
    label: "Description",
    maxLength: 2_000,
    multiline: true,
  },
];

const ALL_HEADER_AUDIENCES = [
  "default",
  "admin",
  "member",
  "applicant",
  "attendee",
] as const;

const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
  tiktok: "TikTok",
  website: "Website",
};

type FooterForm = {
  email: string;
  phone: string;
  address: string;
  ein: string;
  socialUrls: Record<SocialPlatform, string>;
  preservedSocialLinks: NonNullable<OrganizationFooter["socialLinks"]>;
};

function footerToForm(footer: OrganizationFooter): FooterForm {
  const socialUrls = Object.fromEntries(
    SOCIAL_PLATFORMS.map((platform) => [platform, ""]),
  ) as Record<SocialPlatform, string>;
  const preservedSocialLinks: NonNullable<OrganizationFooter["socialLinks"]> =
    [];
  for (const link of footer.socialLinks ?? []) {
    if (!socialUrls[link.platform]) socialUrls[link.platform] = link.url;
    else preservedSocialLinks.push(link);
  }

  return {
    email: footer.email ?? "",
    phone: footer.phone ?? "",
    address: footer.address ?? "",
    ein: footer.ein ?? "",
    socialUrls,
    preservedSocialLinks,
  };
}

function cleanHeader(config: DashboardHeaderConfig): DashboardHeaderConfig {
  const result: DashboardHeaderConfig = {};
  for (const audience of ALL_HEADER_AUDIENCES) {
    const content = config[audience];
    if (!content) continue;

    const cleaned: DashboardHeaderContent = {};
    for (const { key } of HEADER_FIELDS) {
      const value = content[key]?.trim();
      if (value) cleaned[key] = value;
    }
    if (Object.keys(cleaned).length > 0) result[audience] = cleaned;
  }
  return result;
}

function cleanFooter(form: FooterForm): OrganizationFooter {
  const socialLinks = [
    ...SOCIAL_PLATFORMS.flatMap((platform) => {
      const url = form.socialUrls[platform].trim();
      return url ? [{ platform, url }] : [];
    }),
    ...form.preservedSocialLinks,
  ];

  return {
    ...(form.email.trim() && { email: form.email.trim() }),
    ...(form.phone.trim() && { phone: form.phone.trim() }),
    ...(form.address.trim() && { address: form.address.trim() }),
    ...(form.ein.trim() && { ein: form.ein.trim() }),
    ...(socialLinks.length > 0 && { socialLinks }),
  };
}

function snapshot(header: DashboardHeaderConfig, footer: FooterForm) {
  return JSON.stringify({
    header: cleanHeader(header),
    footer: cleanFooter(footer),
  });
}

async function errorFromResponse(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? fallback;
}

function TextField({
  id,
  label,
  value,
  onChange,
  maxLength,
  error,
  multiline = false,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  error?: string;
  multiline?: boolean;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "url";
}) {
  const inputClass =
    "theme-control w-full border border-grey-stroke-strong bg-solid-bg-base px-4 py-3 text-paragraph-2 text-page-text outline-none placeholder:text-grey-text-weak focus:border-brand-text focus:ring-1 focus:ring-brand-text";
  const describedBy = error ? `${id}-error` : undefined;
  const shared = {
    id,
    name: id,
    value,
    maxLength,
    placeholder,
    "aria-invalid": Boolean(error),
    "aria-describedby": describedBy,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(event.target.value),
  };

  return (
    <label htmlFor={id} className="flex flex-col gap-2 text-paragraph-2">
      <span className="font-medium">{label}</span>
      {multiline ? (
        <textarea {...shared} rows={4} className={inputClass} />
      ) : (
        <input {...shared} type={type} className={inputClass} />
      )}
      {error && (
        <span
          id={describedBy}
          role="alert"
          className="text-small text-status-red-text"
        >
          {error}
        </span>
      )}
    </label>
  );
}

export type DashboardContentSettingsProps = {
  initialHeader: DashboardHeaderConfig;
  initialFooter: OrganizationFooter;
  memberTypesEnabled: boolean;
};

export default function DashboardContentSettings({
  initialHeader,
  initialFooter,
  memberTypesEnabled,
}: DashboardContentSettingsProps) {
  const audiences: ReadonlyArray<{ value: EditableAudience; label: string }> =
    memberTypesEnabled
      ? [
          { value: "applicant", label: "Applicants" },
          { value: "attendee", label: "Current Attendees" },
        ]
      : [{ value: "member", label: "All Members" }];

  const [activeAudience, setActiveAudience] = useState<EditableAudience>(
    audiences[0].value,
  );
  const [header, setHeader] = useState(initialHeader);
  const [footer, setFooter] = useState(() => footerToForm(initialFooter));
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    snapshot(initialHeader, footerToForm(initialFooter)),
  );
  const [saveStatus, setSaveStatus] = useState<"success" | "error" | null>(
    null,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertMemberTypes, setAlertMemberTypes] = useState<MemberType[]>([]);
  const [alertErrors, setAlertErrors] = useState<FieldErrors>({});
  const [alertStatus, setAlertStatus] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [isPostingAlert, setIsPostingAlert] = useState(false);

  const currentSnapshot = useMemo(
    () => snapshot(header, footer),
    [footer, header],
  );
  const isDirty = currentSnapshot !== savedSnapshot;

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [isDirty]);

  function clearSaveFeedback() {
    setSaveStatus(null);
    setSaveError(null);
  }

  function updateHeader(field: HeaderField, value: string) {
    setHeader((current) => ({
      ...current,
      [activeAudience]: {
        ...(current[activeAudience] ??
          (!memberTypesEnabled && activeAudience === "member"
            ? current.default
            : undefined)),
        [field]: value,
      },
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[`header.${activeAudience}.${field}`];
      return next;
    });
    clearSaveFeedback();
  }

  function updateFooter(
    field: keyof Omit<FooterForm, "socialUrls" | "preservedSocialLinks">,
    value: string,
  ) {
    setFooter((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[`footer.${field}`];
      return next;
    });
    clearSaveFeedback();
  }

  function updateSocial(platform: SocialPlatform, value: string) {
    setFooter((current) => ({
      ...current,
      socialUrls: { ...current.socialUrls, [platform]: value },
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[`footer.social.${platform}`];
      return next;
    });
    clearSaveFeedback();
  }

  function validateContent(
    cleanedHeader: DashboardHeaderConfig,
    cleanedFooter: OrganizationFooter,
  ) {
    const errors: FieldErrors = {};
    const headerResult = DashboardHeaderConfigSchema.safeParse(cleanedHeader);
    if (!headerResult.success) {
      for (const issue of headerResult.error.issues) {
        errors[`header.${issue.path.join(".")}`] ??= issue.message;
      }
    }

    const footerResult = OrganizationFooterSchema.safeParse(cleanedFooter);
    if (!footerResult.success) {
      const configuredPlatforms = SOCIAL_PLATFORMS.filter(
        (platform) => footer.socialUrls[platform].trim().length > 0,
      );
      for (const issue of footerResult.error.issues) {
        if (issue.path[0] === "socialLinks") {
          const platform = configuredPlatforms[Number(issue.path[1])];
          if (platform) {
            errors[`footer.social.${platform}`] ??= issue.message;
            continue;
          }
        }
        errors[`footer.${String(issue.path[0])}`] ??= issue.message;
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function saveContent() {
    const cleanedHeader = cleanHeader(header);
    const cleanedFooter = cleanFooter(footer);
    if (!validateContent(cleanedHeader, cleanedFooter)) {
      setSaveStatus("error");
      setSaveError("Fix the highlighted fields before saving.");
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);
    setSaveError(null);
    try {
      const [headerResponse, footerResponse] = await Promise.all([
        api.organizationConfig.$put({
          json: {
            key: OrganizationConfigKey.DashboardHeader,
            value: JSON.stringify(cleanedHeader),
          },
        }),
        api.organizationConfig.$put({
          json: {
            key: OrganizationConfigKey.OrganizationFooter,
            value: JSON.stringify(cleanedFooter),
          },
        }),
      ]);

      if (!headerResponse.ok) {
        throw new Error(
          await errorFromResponse(headerResponse, "Could not save the header."),
        );
      }
      if (!footerResponse.ok) {
        throw new Error(
          await errorFromResponse(footerResponse, "Could not save the footer."),
        );
      }

      setSavedSnapshot(snapshot(header, footer));
      setSaveStatus("success");
    } catch (error) {
      setSaveStatus("error");
      setSaveError(
        error instanceof Error ? error.message : "Could not save the changes.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function toggleAlertMemberType(memberType: MemberType) {
    setAlertMemberTypes((current) =>
      current.includes(memberType)
        ? current.filter((value) => value !== memberType)
        : [...current, memberType],
    );
  }

  async function postAlert() {
    const payload: PostDashboardAlert = {
      title: alertTitle.trim(),
      message: alertMessage.trim(),
      ...(memberTypesEnabled && alertMemberTypes.length > 0
        ? { memberTypes: alertMemberTypes }
        : {}),
    };
    const result = PostDashboardAlertSchema.safeParse(payload);
    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        errors[String(issue.path[0])] ??= issue.message;
      }
      setAlertErrors(errors);
      setAlertError("Fix the highlighted fields before posting.");
      setAlertStatus(null);
      return;
    }

    setIsPostingAlert(true);
    setAlertErrors({});
    setAlertError(null);
    setAlertStatus(null);
    try {
      const response = await api.alerts.$post({ json: result.data });
      if (!response.ok) {
        throw new Error(
          await errorFromResponse(response, "Could not post the alert."),
        );
      }
      const body = await response.json();
      setAlertStatus(
        `Alert posted successfully to ${body.sent} member${body.sent === 1 ? "" : "s"}.`,
      );
      setAlertTitle("");
      setAlertMessage("");
      setAlertMemberTypes([]);
    } catch (error) {
      setAlertError(
        error instanceof Error ? error.message : "Could not post the alert.",
      );
    } finally {
      setIsPostingAlert(false);
    }
  }

  const activeContent =
    header[activeAudience] ??
    (!memberTypesEnabled && activeAudience === "member"
      ? (header.default ?? {})
      : {});

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8 text-page-text mobile:px-10 mobile:py-12">
      <div>
        <h1 className="text-heading-1 font-semibold">Dashboard Content</h1>
        <p className="mt-2 text-paragraph-1 text-grey-text-weak">
          Update the dashboard header and footer, or send an announcement to
          members.
        </p>
      </div>

      <SaveBanner status={saveStatus ?? (isDirty ? "unsaved" : null)} />
      {saveError && (
        <p role="alert" className="text-paragraph-2 text-status-red-text">
          {saveError}
        </p>
      )}

      <section className="rounded-xl border border-grey-stroke-weak bg-solid-bg-base p-6 mobile:p-8">
        <h2 className="text-heading-2 font-semibold">Dashboard header</h2>
        <p className="mt-2 text-paragraph-2 text-grey-text-weak">
          Use {"{firstName}"} in a title to personalize it for each member.
        </p>

        <div
          role="tablist"
          aria-label="Header audience"
          className="mt-6 flex flex-wrap gap-3"
        >
          {audiences.map((audience) => (
            <button
              key={audience.value}
              type="button"
              role="tab"
              aria-selected={activeAudience === audience.value}
              onClick={() => setActiveAudience(audience.value)}
              className={`theme-control border px-4 py-2 text-paragraph-2 font-medium ${
                activeAudience === audience.value
                  ? "border-brand-text bg-brand-fill text-brand-text"
                  : "border-grey-stroke-strong bg-solid-bg-base text-page-text"
              }`}
            >
              {audience.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" className="mt-6 grid gap-5 mobile:grid-cols-2">
          {HEADER_FIELDS.map((field) => (
            <div
              key={field.key}
              className={field.multiline ? "mobile:col-span-2" : undefined}
            >
              <TextField
                id={`header-${activeAudience}-${field.key}`}
                label={field.label}
                value={activeContent[field.key] ?? ""}
                onChange={(value) => updateHeader(field.key, value)}
                maxLength={field.maxLength}
                multiline={field.multiline}
                placeholder={field.placeholder}
                error={fieldErrors[`header.${activeAudience}.${field.key}`]}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-grey-stroke-weak bg-solid-bg-base p-6 mobile:p-8">
        <h2 className="text-heading-2 font-semibold">Footer</h2>
        <p className="mt-2 text-paragraph-2 text-grey-text-weak">
          The footer stays hidden when all of these fields are empty.
        </p>

        <div className="mt-6 grid gap-5 mobile:grid-cols-2">
          <TextField
            id="footer-email"
            label="Contact email"
            value={footer.email}
            onChange={(value) => updateFooter("email", value)}
            maxLength={254}
            type="email"
            error={fieldErrors["footer.email"]}
          />
          <TextField
            id="footer-phone"
            label="Phone"
            value={footer.phone}
            onChange={(value) => updateFooter("phone", value)}
            maxLength={30}
            type="tel"
            error={fieldErrors["footer.phone"]}
          />
          <TextField
            id="footer-address"
            label="Address"
            value={footer.address}
            onChange={(value) => updateFooter("address", value)}
            maxLength={200}
            error={fieldErrors["footer.address"]}
          />
          <TextField
            id="footer-ein"
            label="EIN"
            value={footer.ein}
            onChange={(value) => updateFooter("ein", value)}
            maxLength={10}
            placeholder="12-3456789"
            error={fieldErrors["footer.ein"]}
          />
        </div>

        <h3 className="mt-8 text-heading-4 font-semibold">Social links</h3>
        <div className="mt-5 grid gap-5 mobile:grid-cols-2">
          {SOCIAL_PLATFORMS.map((platform) => (
            <TextField
              key={platform}
              id={`footer-${platform}`}
              label={`${SOCIAL_LABELS[platform]} URL`}
              value={footer.socialUrls[platform]}
              onChange={(value) => updateSocial(platform, value)}
              maxLength={2_048}
              type="url"
              placeholder="https://"
              error={fieldErrors[`footer.social.${platform}`]}
            />
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <BogButton
          type="button"
          onClick={() => void saveContent()}
          disabled={isSaving || !isDirty}
        >
          {isSaving ? "Saving…" : "Save dashboard content"}
        </BogButton>
      </div>

      <section className="rounded-xl border border-grey-stroke-weak bg-solid-bg-base p-6 mobile:p-8">
        <h2 className="text-heading-2 font-semibold">Post an alert</h2>
        <p className="mt-2 text-paragraph-2 text-grey-text-weak">
          Alerts appear above the dashboard until a member dismisses them.
        </p>

        <div className="mt-6 flex flex-col gap-5">
          <TextField
            id="alert-title"
            label="Alert title"
            value={alertTitle}
            onChange={(value) => {
              setAlertTitle(value);
              setAlertErrors((current) => ({ ...current, title: "" }));
            }}
            maxLength={120}
            error={alertErrors.title}
          />
          <TextField
            id="alert-message"
            label="Alert message"
            value={alertMessage}
            onChange={(value) => {
              setAlertMessage(value);
              setAlertErrors((current) => ({ ...current, message: "" }));
            }}
            maxLength={2_000}
            multiline
            error={alertErrors.message}
          />

          {memberTypesEnabled && (
            <fieldset>
              <legend className="text-paragraph-2 font-medium">
                Recipients
              </legend>
              <div className="mt-3 flex flex-wrap gap-6">
                {[
                  { value: MemberType.Applicant, label: "Applicants" },
                  { value: MemberType.Attendee, label: "Current attendees" },
                ].map(({ value, label }) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 text-paragraph-2"
                  >
                    <input
                      type="checkbox"
                      checked={alertMemberTypes.includes(value)}
                      onChange={() => toggleAlertMemberType(value)}
                      className="size-5 accent-brand-text"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-small text-grey-text-weak">
                Leave both unchecked to send the alert to all members.
              </p>
            </fieldset>
          )}

          {alertStatus && (
            <p
              role="status"
              className="text-paragraph-2 text-status-green-text"
            >
              {alertStatus}
            </p>
          )}
          {alertError && (
            <p role="alert" className="text-paragraph-2 text-status-red-text">
              {alertError}
            </p>
          )}

          <div>
            <BogButton
              type="button"
              onClick={() => void postAlert()}
              disabled={isPostingAlert}
            >
              {isPostingAlert ? "Posting…" : "Post alert"}
            </BogButton>
          </div>
        </div>
      </section>
    </main>
  );
}
