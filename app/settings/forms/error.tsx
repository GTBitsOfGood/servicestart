"use client";
import BogButton from "@/components/bog/BogButton/BogButton";

export default function FormsError({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-4 p-8">
      <p role="alert">Unable to load forms. Please try again.</p>
      <BogButton onClick={reset}>Try again</BogButton>
    </div>
  );
}
