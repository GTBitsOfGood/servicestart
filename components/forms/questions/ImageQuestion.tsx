"use client";

import { useEffect, useRef, useState } from "react";
import BogButton from "@/components/bog/BogButton/BogButton";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import { useDynamicForm } from "@/components/forms/DynamicFormContext";
import QuestionField from "@/components/forms/questions/QuestionField";
import {
  describedBy,
  fieldId,
  type QuestionProps,
} from "@/components/forms/types";
import {
  FORM_UPLOAD_CONTENT_TYPES,
  FORM_UPLOAD_MAX_BYTES,
} from "@/lib/forms/constants";
import type { FormComponentOfType } from "@/lib/forms/schema";
import type { FormComponentType } from "@/lib/schema";

const ACCEPTED_TYPES: readonly string[] = FORM_UPLOAD_CONTENT_TYPES;

/** A circular preview with upload, replace, and remove buttons. */
export default function ImageQuestion({
  component,
  value,
  error,
  disabled,
  onChange,
}: QuestionProps<FormComponentOfType<FormComponentType.Image>>) {
  const { formId, preview, uploadImage, setUploading } = useDynamicForm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploading = progress !== null;
  const hasImage = Boolean(value && typeof value === "object");
  const shownError = uploadError ?? error;
  const statusId = `${fieldId(component.id)}-status`;

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  async function handleFile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError("Upload a JPEG, PNG, or WebP image");
      return;
    }
    if (file.size > FORM_UPLOAD_MAX_BYTES) {
      setUploadError("Images must be 5 MB or smaller");
      return;
    }

    setUploadError(null);
    setProgress(0);
    setUploading(component.id, true);
    try {
      const { id } = await uploadImage(formId, file, setProgress);
      setPreviewUrl(URL.createObjectURL(file));
      onChange({ uploadId: id });
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Couldn't upload the image",
      );
    } finally {
      setProgress(null);
      setUploading(component.id, false);
    }
  }

  function handleRemove() {
    setPreviewUrl(null);
    setUploadError(null);
    onChange(undefined);
  }

  return (
    <QuestionField component={component} error={shownError ?? undefined} group>
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-full bg-grey-fill-weak text-grey-icon-strong">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Your uploaded image"
              className="size-full object-cover"
            />
          ) : (
            <BogIcon name="user" size={48} />
          )}
        </div>
        <div className="flex flex-col items-start gap-3">
          <div className="flex flex-wrap gap-3">
            <BogButton
              id={fieldId(component.id)}
              type="button"
              variant="secondary"
              disabled={disabled || uploading || preview}
              aria-invalid={shownError ? true : undefined}
              aria-describedby={describedBy(
                component,
                shownError ?? undefined,
                statusId,
              )}
              onClick={() => inputRef.current?.click()}
            >
              {hasImage ? "Replace image" : "Upload image"}
            </BogButton>
            {hasImage && !uploading && (
              <BogButton
                type="button"
                variant="tertiary"
                disabled={disabled}
                onClick={handleRemove}
              >
                Remove
              </BogButton>
            )}
          </div>
          <p id={statusId} className="text-paragraph-2 text-grey-text-weak">
            {preview
              ? "Uploads are off in preview"
              : "JPEG, PNG, or WebP, up to 5 MB"}
          </p>
          {uploading && (
            <div
              role="progressbar"
              aria-label="Upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="h-2 w-48 overflow-hidden rounded-full bg-grey-fill-weak"
            >
              <div
                className="h-full bg-brand-text"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleFile(file);
        }}
      />
    </QuestionField>
  );
}
