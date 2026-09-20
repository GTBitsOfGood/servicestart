"use client";

import { useState } from "react";
import BogTextInput from "@/components/bog/BogTextInput/BogTextInput";
import BogButton from "@/components/bog/BogButton/BogButton";
import BogRadioGroup from "@/components/bog/BogRadioGroup/BogRadioGroup";
import BogRadioItem from "@/components/bog/BogRadioItem/BogRadioItem";
import WarningIcon from "@/components/WarningIcon";
import ExitIcon from "@/components/ExitIcon";
import PlusIcon from "@/components/PlusIcon";
import { TagInput } from "@/components/TagInput";
import { EventVisibility } from "@/lib/schema";
import {
  buildEventPayload,
  type EventFormField,
  type EventFormValues,
  type EventPayload,
} from "@/lib/eventFormUtils";

export type SubmitIntent = "draft" | "publish";

export type EventFormSubmitResult = { ok: boolean; error?: string };

type EventFormProps = {
  heading: string;
  initialValues: EventFormValues;
  isPublished: boolean;
  onSubmit: (
    payload: EventPayload,
    intent: SubmitIntent,
  ) => Promise<EventFormSubmitResult>;
  onCancel: () => void;
};

function MissingHint({
  missing,
  field,
}: {
  missing: EventFormField[];
  field: EventFormField;
}) {
  if (!missing.includes(field)) return null;

  return <div className="text-status-red-text text-small">Missing</div>;
}

export default function EventForm({
  heading,
  initialValues,
  isPublished,
  onSubmit,
  onCancel,
}: EventFormProps) {
  const [values, setValues] = useState<EventFormValues>(initialValues);
  const [missing, setMissing] = useState<EventFormField[]>([]);
  const [formError, setFormError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [pendingIntent, setPendingIntent] = useState<SubmitIntent | null>(null);
  const [showDiscard, setShowDiscard] = useState(false);

  const isSubmitting = pendingIntent !== null;

  function setField<K extends keyof EventFormValues>(
    field: K,
    value: EventFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(intent: SubmitIntent) {
    // A second click in flight would create a duplicate event.
    if (isSubmitting) return;

    const built = buildEventPayload(values, intent);
    if (!built.ok) {
      setMissing(built.missing);
      setFormError(built.message);
      setSubmitError("");
      return;
    }

    setMissing([]);
    setFormError("");
    setSubmitError("");
    setPendingIntent(intent);

    try {
      const result = await onSubmit(built.payload, intent);
      if (!result.ok) {
        setSubmitError(result.error ?? "Something went wrong. Please retry.");
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred. Please try again.",
      );
    } finally {
      setPendingIntent(null);
    }
  }

  return (
    <div className="flex w-full px-14 py-12 flex-col items-center gap-12 rounded bg-white">
      <div className="h-[68.717px] w-[90%] flex flex-col justify-between">
        <div className="flex w-full justify-between items-center">
          <h3>{heading}</h3>
          <BogButton
            onClick={() => setShowDiscard(true)}
            className="bg-transparent"
            aria-label="Close form"
          >
            <ExitIcon />
          </BogButton>
        </div>
        <div className="w-full">
          <hr className="w-full border-media-divider" />
        </div>
      </div>
      <div className="flex flex-col items-end gap-15 w-[90%]">
        <div className="flex flex-col items-start gap-9 self-stretch w-full">
          <h4>Basic Information</h4>
          <div>
            <BogTextInput
              name="title"
              label="Title"
              required={true}
              placeholder="Title of the event"
              value={values.title}
              onChange={(e) => setField("title", e.target.value)}
              error={missing.includes("title")}
              className="self-start gap-2"
            />
            <MissingHint missing={missing} field="title" />
          </div>
          <div className="flex items-start gap-6 self-stretch">
            <div className="w-1/5">
              <BogTextInput
                name="date"
                label="Date"
                type="date"
                required={true}
                value={values.date}
                error={missing.includes("date")}
                onChange={(e) => setField("date", e.target.value)}
              />
              <MissingHint missing={missing} field="date" />
            </div>
            <div className="w-1/5">
              <BogTextInput
                name="start"
                label="Start Time"
                type="time"
                required={true}
                value={values.startTime}
                error={missing.includes("startTime")}
                onChange={(e) => setField("startTime", e.target.value)}
              />
              <MissingHint missing={missing} field="startTime" />
            </div>
            <div className="w-1/5">
              <BogTextInput
                name="end"
                label="End Time"
                type="time"
                required={true}
                value={values.endTime}
                error={missing.includes("endTime")}
                onChange={(e) => setField("endTime", e.target.value)}
              />
              <MissingHint missing={missing} field="endTime" />
            </div>
          </div>
          <div className="self-stretch">
            <BogTextInput
              name="description"
              label="Description"
              required={true}
              multiline={true}
              value={values.description}
              onChange={(e) => setField("description", e.target.value)}
              error={missing.includes("description")}
              placeholder="Write your description here"
            />
            <MissingHint missing={missing} field="description" />
          </div>
        </div>
        <div className="flex flex-col items-start gap-6 self-stretch">
          <h4>Event Location</h4>
          <div className="flex items-start gap-10 self-stretch">
            <div className="w-1/3">
              <BogTextInput
                name="address"
                label="Address"
                placeholder="Detailed address"
                required={true}
                value={values.address}
                error={missing.includes("address")}
                onChange={(e) => setField("address", e.target.value)}
              />
              <MissingHint missing={missing} field="address" />
            </div>
            <div className="w-1/5">
              <BogTextInput
                name="city"
                label="City"
                placeholder="City"
                required={true}
                value={values.city}
                error={missing.includes("city")}
                onChange={(e) => setField("city", e.target.value)}
              />
              <MissingHint missing={missing} field="city" />
            </div>
            <div className="w-1/5">
              <BogTextInput
                name="state"
                label="State"
                placeholder="State"
                required={true}
                value={values.state}
                error={missing.includes("state")}
                onChange={(e) => setField("state", e.target.value)}
              />
              <MissingHint missing={missing} field="state" />
            </div>
            <div className="w-1/5">
              <BogTextInput
                name="zip"
                label="Zip Code"
                placeholder="00000"
                required={true}
                value={values.zipCode}
                error={missing.includes("zipCode")}
                onChange={(e) => setField("zipCode", e.target.value)}
              />
              <MissingHint missing={missing} field="zipCode" />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start gap-9 self-stretch">
          <h4>Additional Information</h4>
          <div className="flex items-center gap-10 self-stretch">
            <div className="w-1/5">
              <BogTextInput
                name="capacity"
                label="Event Capacity"
                placeholder="Enter a number"
                value={values.eventCapacity}
                error={missing.includes("eventCapacity")}
                onChange={(e) => setField("eventCapacity", e.target.value)}
              />
              <MissingHint missing={missing} field="eventCapacity" />
            </div>
            <div className="w-1/5">
              <BogTextInput
                name="deadline"
                label="Registration Deadline"
                type="date"
                placeholder="Enter a date"
                value={values.deadline}
                error={missing.includes("deadline")}
                onChange={(e) => setField("deadline", e.target.value)}
              />
              <MissingHint missing={missing} field="deadline" />
            </div>
          </div>
          <div className="w-full flex flex-col gap-2 items-start">
            {values.links.map((link, index) => (
              <BogTextInput
                key={index}
                name={`link${index}`}
                label={index === 0 ? "External Links" : ""}
                value={link}
                error={missing.includes("links")}
                onChange={(e) => {
                  const updated = [...values.links];
                  updated[index] = e.target.value;
                  setField("links", updated);
                }}
                placeholder="URL must be in the form https://www.example.[com, org, net, etc.]"
                className="w-full"
              />
            ))}
            <BogButton
              className="bg-solid-bg-base text-brand-text"
              onClick={() => setField("links", [...values.links, ""])}
            >
              <PlusIcon />
              Add another
            </BogButton>
          </div>
          <BogTextInput
            name="accessibility"
            label="Accessibility Notes"
            placeholder="Write your notes here"
            value={values.notes}
            onChange={(e) => setField("notes", e.target.value)}
            className="self-stretch"
          />
          <div className="self-stretch flex flex-col gap-2">
            <label className="text-paragraph-2 font-semibold text-grey-text-strong">
              Tags
            </label>
            <TagInput
              tagIds={values.tagIds}
              setTagIds={(ids) => setField("tagIds", ids)}
              placeholder="Add tags"
            />
          </div>
        </div>
        <div className="flex flex-col items-start gap-9 self-stretch w-full">
          <h4>Ownerships</h4>
          <div className="w-full flex flex-col gap-2 items-start">
            {values.hosts.map((host, index) => (
              <BogTextInput
                key={`${index}host`}
                name={`${index}cohost`}
                label={index === 0 ? "Add a co-host" : ""}
                value={host}
                onChange={(e) => {
                  const updated = [...values.hosts];
                  updated[index] = e.target.value;
                  setField("hosts", updated);
                }}
                placeholder="Enter co-host email"
                className="self-stretch"
              />
            ))}
            <BogButton
              className="bg-solid-bg-base text-brand-text"
              onClick={() => setField("hosts", [...values.hosts, ""])}
            >
              <PlusIcon />
              Add another
            </BogButton>
          </div>
        </div>
        <div className="flex flex-col items-start gap-9 self-stretch w-full">
          <h4>Visibility</h4>
          <BogRadioGroup
            value={values.visibility}
            onValueChange={(value) =>
              setField(
                "visibility",
                value === EventVisibility.Member
                  ? EventVisibility.Member
                  : EventVisibility.Public,
              )
            }
            className="flex flex-col justify-center items-start self-stretch gap-2"
          >
            <BogRadioItem
              value={EventVisibility.Public}
              label="Public"
              className="flex h-[44px] px-2 py-3 items-center gap-2 self-stretch rounded border border-media-divider bg-media-page-bg"
            />
            <BogRadioItem
              value={EventVisibility.Member}
              label="Member only"
              className="flex h-[44px] px-2 py-3 items-center gap-2 self-stretch rounded border border-media-divider bg-media-page-bg"
            />
          </BogRadioGroup>
        </div>
        {formError && (
          <div
            role="alert"
            className="w-full flex flex-row items-center p-4 gap-2 self-stretch rounded bg-brand-stroke-weak min-h-[40px]"
          >
            <WarningIcon />
            <p>{formError}</p>
          </div>
        )}
        {submitError && (
          <div
            role="alert"
            className="w-full flex flex-row items-center p-4 gap-2 self-stretch rounded bg-status-red-bg min-h-[40px]"
          >
            <WarningIcon />
            <p>{submitError}</p>
          </div>
        )}
        <div className="flex flex-end items-start gap-5">
          <BogButton
            onClick={() => setShowDiscard(true)}
            disabled={isSubmitting}
            className="flex py-3 px-4 items-center -space-x-1 rounded bg-transparent text-brand-text"
          >
            Cancel
          </BogButton>
          {isPublished ? (
            <BogButton
              onClick={() => handleSubmit("publish")}
              disabled={isSubmitting}
              className="flex py-3 px-4 items-center -space-x-1 rounded"
            >
              {pendingIntent === "publish" ? "Saving…" : "Save changes"}
            </BogButton>
          ) : (
            <>
              <BogButton
                onClick={() => handleSubmit("draft")}
                disabled={isSubmitting}
                className="flex py-3 px-4 items-center -space-x-1 rounded bg-solid-bg-base text-brand-text"
              >
                {pendingIntent === "draft" ? "Saving…" : "Save draft"}
              </BogButton>
              <BogButton
                onClick={() => handleSubmit("publish")}
                disabled={isSubmitting}
                className="flex py-3 px-4 items-center -space-x-1 rounded"
              >
                {pendingIntent === "publish" ? "Publishing…" : "Publish"}
              </BogButton>
            </>
          )}
        </div>
      </div>
      {showDiscard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="flex w-1/3 p-8 flex-col items-center gap-4 bg-solid-bg-base rounded">
            <div className="h-[68.717px] self-stretch">
              <div className="w-full">
                <div className="inline-flex w-full justify-between items-center">
                  <h4>Discard changes</h4>
                  <BogButton
                    onClick={() => setShowDiscard(false)}
                    className="bg-transparent"
                    aria-label="Close dialog"
                  >
                    <ExitIcon />
                  </BogButton>
                </div>
                <hr className="w-full border-media-divider" />
              </div>
            </div>
            <div className="flex flex-col items-end gap-12 self-stretch">
              <div className="flex flex-col items-start gap-12 self-stretch">
                <p className="self-stretch">
                  Are you sure you want to discard the changes you made?
                </p>
              </div>
              <div className="flex items-start gap-5">
                <BogButton
                  onClick={() => setShowDiscard(false)}
                  className="bg-transparent text-brand-text"
                >
                  Cancel
                </BogButton>
                <BogButton
                  onClick={onCancel}
                  className="flex py-2 px-3 items-center -gap-1"
                >
                  Discard
                </BogButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
