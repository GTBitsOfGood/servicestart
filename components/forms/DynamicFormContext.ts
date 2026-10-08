"use client";

import { createContext, useContext } from "react";
import { uploadFormImage } from "@/components/forms/uploadFormImage";

export type DynamicFormContextValue = {
  formId: string;
  preview: boolean;
  uploadImage: typeof uploadFormImage;
  /** Tells the form an image question is uploading, to hold off submitting. */
  setUploading: (componentId: string, uploading: boolean) => void;
};

export const DynamicFormContext = createContext<DynamicFormContextValue>({
  formId: "",
  preview: false,
  uploadImage: uploadFormImage,
  setUploading: () => {},
});

export function useDynamicForm() {
  return useContext(DynamicFormContext);
}
