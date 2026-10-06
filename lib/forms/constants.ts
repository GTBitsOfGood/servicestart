import type { FormSettings } from "./schema";

export const DEFAULT_FORM_SETTINGS: FormSettings = {
  requireLogin: true,
  allowMultipleSubmissions: false,
  opensAt: null,
  closesAt: null,
  confirmationMessage: "Thanks! Your response has been submitted.",
};

// Image answers (headshots).
export const FORM_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const FORM_UPLOAD_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type FormUploadContentType = (typeof FORM_UPLOAD_CONTENT_TYPES)[number];
