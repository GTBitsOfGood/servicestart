"use client";

import { startTransition, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type MediaUploadCardProps = {
  variant: "grid" | "empty";
};

const ACCEPTED_IMAGE_TYPES =
  "image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml";

function GridUploadArrow() {
  return (
    <svg
      width="119"
      height="148"
      viewBox="0 0 119 148"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-[10.4rem] w-[8.4rem]"
      aria-hidden="true"
    >
      <path
        d="M59.0571 111.201V26.0332M81.6611 47.132L59.0571 24.606L36.4531 47.132M35.6602 123.393H82.454"
        stroke="white"
        strokeWidth="5.19932"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EmptyUploadArrow() {
  return (
    <svg
      width="119"
      height="148"
      viewBox="0 0 119 148"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-[15rem] w-[12rem]"
      aria-hidden="true"
    >
      <path
        d="M59.0571 111.201V26.0332M81.6611 47.132L59.0571 24.606L36.4531 47.132M35.6602 123.393H82.454"
        className="stroke-[var(--color-media-empty-upload-text)] group-hover:stroke-[var(--color-media-empty-upload-hover-text)]"
        strokeWidth="5.19932"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function MediaUploadCard({ variant }: MediaUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadFile(file: File) {
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/media", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Upload failed");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  }

  async function handleDrop(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await uploadFile(file);
  }

  function openPicker() {
    if (!isUploading) {
      inputRef.current?.click();
    }
  }

  if (variant === "empty") {
    return (
      <div className="mx-auto w-full max-w-[80rem]">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          className="hidden"
          onChange={handleInputChange}
        />
        <button
          type="button"
          onClick={openPicker}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          disabled={isUploading}
          className="group flex min-h-[63rem] w-full flex-col items-center justify-center rounded-[3rem] border-2 border-[var(--color-media-empty-upload-border)] bg-[var(--color-media-empty-upload-bg)] px-10 py-12 text-center text-[var(--color-media-empty-upload-text)] hover:bg-[var(--color-media-empty-upload-hover-bg)] hover:text-[var(--color-media-empty-upload-hover-text)] disabled:cursor-wait"
        >
          <p className="mb-12 text-heading-1 text-[6.4rem] leading-[1] text-[var(--color-media-empty-upload-text)] group-hover:text-[var(--color-media-empty-upload-hover-text)]">
            Let&apos;s get started!
          </p>
          <div className="mb-10 flex items-center justify-center">
            <EmptyUploadArrow />
          </div>
          <p className="text-heading-3 font-semibold text-[var(--color-media-empty-upload-text)] group-hover:text-[var(--color-media-empty-upload-hover-text)]">
            {isUploading ? "Uploading image..." : "Choose a file to upload"}
          </p>
          <p className="text-heading-4 font-normal text-[var(--color-media-empty-upload-text)] group-hover:text-[var(--color-media-empty-upload-hover-text)]">
            or drag a file here
          </p>
          <p className="mt-4 text-paragraph-2 text-[var(--color-media-empty-upload-text)] group-hover:text-[var(--color-media-empty-upload-hover-text)]">
            .png, .jpg, .pdf, .jpeg
          </p>
        </button>
        {error ? (
          <p className="mt-4 text-center text-paragraph-2 text-[var(--color-status-red-text)]">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        className="hidden"
        onChange={handleInputChange}
      />
      <button
        type="button"
        onClick={openPicker}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        disabled={isUploading}
        className="flex h-full w-full flex-col items-center justify-center rounded-2xl border border-[var(--color-media-upload-border)] bg-[var(--color-media-upload-bg)] px-8 py-6 text-center text-[var(--color-media-inverse)] hover:border-[var(--color-media-upload-hover-border)] hover:bg-[var(--color-media-upload-hover-bg)] disabled:cursor-wait"
      >
        <div className="mb-4 flex items-center justify-center">
          <GridUploadArrow />
        </div>
        <p className="text-paragraph-1 font-semibold text-[var(--color-media-inverse)]">
          {isUploading ? "Uploading image..." : "Choose a file to upload"}
        </p>
        <p className="text-paragraph-2 text-[var(--color-media-inverse-strong)]">
          or drag a file here
        </p>
        <p className="text-small text-[var(--color-media-inverse-weak)]">
          .png, .jpg, .pdf, .jpeg
        </p>
      </button>
      {error ? (
        <p className="mt-3 text-center text-small text-[var(--color-status-red-text)]">
          {error}
        </p>
      ) : null}
    </>
  );
}
