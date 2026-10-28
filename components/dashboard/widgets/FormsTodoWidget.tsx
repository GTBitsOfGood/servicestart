import Link from "next/link";
import LocalDateTime from "@/components/forms/LocalDateTime";
import {
  loadFormProgress,
  type FormTodoAction,
  type FormTodoCard,
} from "@/lib/dashboard/formProgress";
import type { WidgetProps } from "@/lib/dashboard/widgets";

function availabilityLabel(action: FormTodoAction): string {
  switch (action.kind) {
    case "open":
      return "";
    case "not_yet_open":
      return "Not yet open";
    case "closed":
      return "Closed";
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

function TodoCard({ card }: { card: FormTodoCard }) {
  const statusLabel = availabilityLabel(card.action);

  return (
    <article className="border-b border-grey-stroke-weak px-1 py-4 first:pt-0 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-paragraph-1 font-semibold text-app-strong-text">
            {card.title}
          </h4>
          <p className="mt-1 text-paragraph-2 text-grey-text-weak">
            {card.pastDue ? (
              "Past due"
            ) : card.dueAt ? (
              <>
                Due <LocalDateTime iso={card.dueAt} format="monthDay" />
              </>
            ) : null}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full bg-status-amber-fill px-3 py-1 text-small font-semibold text-status-amber-text">
          Not Started
        </span>
      </div>
      {card.action.kind === "open" ? (
        <Link
          href={card.action.href}
          className="mt-3 inline-flex text-paragraph-2 font-semibold text-brand-text hover:underline"
          aria-label={`Open ${card.title}`}
        >
          Open form
        </Link>
      ) : (
        <p className="mt-3 text-paragraph-2 font-medium text-grey-text-weak">
          {statusLabel}
        </p>
      )}
    </article>
  );
}

export function FormsTodoWidgetView({ cards }: { cards: FormTodoCard[] }) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-solid-bg-base p-8">
      <h3 className="text-heading-3 font-semibold text-app-strong-text">
        To-Do List
      </h3>
      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto">
        {cards.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-2 text-center">
            <p className="text-paragraph-1 font-semibold text-app-strong-text">
              You&apos;re all caught up!
            </p>
            <p className="text-paragraph-2 text-grey-text-weak">
              Keep an eye on your inbox for updates on your next steps.
            </p>
          </div>
        ) : (
          cards.map((card) => <TodoCard key={card.formUuid} card={card} />)
        )}
      </div>
    </div>
  );
}

export default async function FormsTodoWidget({
  organizationId,
  userId,
  audience,
}: WidgetProps) {
  const result = await loadFormProgress(organizationId, userId, audience);
  if (!result.formsEnabled) {
    return null;
  }
  return <FormsTodoWidgetView cards={result.summary.todo} />;
}
