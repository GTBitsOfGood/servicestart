import type { FormSettings } from "./schema";

export const DEFAULT_FORM_SETTINGS: FormSettings = {
  requireLogin: true,
  allowMultipleSubmissions: false,
  opensAt: null,
  closesAt: null,
  confirmationMessage: "Thanks! Your response has been submitted.",
};
