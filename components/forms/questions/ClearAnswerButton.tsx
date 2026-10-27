type ClearAnswerButtonProps = {
  label: string;
  onClear: () => void;
};

/** Unanswers an optional question whose controls can't be unselected. */
export default function ClearAnswerButton({
  label,
  onClear,
}: ClearAnswerButtonProps) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={`Clear the answer to ${label}`}
      className="self-start rounded-control px-1 text-paragraph-2 text-brand-text underline hover:opacity-80 focus-visible:outline-2 focus-visible:outline-brand-stroke-strong"
    >
      Clear answer
    </button>
  );
}
