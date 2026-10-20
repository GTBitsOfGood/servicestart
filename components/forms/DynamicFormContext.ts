"use client";

import { createContext, useContext } from "react";
import { uploadFormImage } from "@/components/forms/uploadFormImage";

export type DynamicFormContextValue = {
  formId: string;
  preview: boolean;
  /** The form shows saved answers that can't change. */
  readOnly: boolean;
  uploadImage: typeof uploadFormImage;
  /** Where to load an already-uploaded image from, or null to not show it. */
  imageSrc: (uploadId: string) => string | null;
  /** Tells the form an image question is uploading, to hold off submitting. */
  setUploading: (componentId: string, uploading: boolean) => void;
};

export const DynamicFormContext = createContext<DynamicFormContextValue>({
  formId: "",
  preview: false,
  readOnly: false,
  uploadImage: uploadFormImage,
  imageSrc: () => null,
  setUploading: () => {},
});

export function useDynamicForm() {
  return useContext(DynamicFormContext);
}
