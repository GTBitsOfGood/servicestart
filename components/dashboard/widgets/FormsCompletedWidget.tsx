import Link from "next/link";
import LocalDateTime from "@/components/forms/LocalDateTime";
import {
  loadFormProgress,
  type FormCompletedCard,
} from "@/lib/dashboard/formProgress";
import type { WidgetProps } from "@/lib/dashboard/widgets";

export function FormsCompletedWidgetView({
  cards,
}: {
  cards: FormCompletedCard[];
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-solid-bg-base p-8">
      <h3 className="text-heading-3 font-semibold text-app-strong-text">
        Completed Forms
      </h3>

      <div className="-mx-8 mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto">
        {cards.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-8 text-center text-paragraph-1 text-grey-text-weak">
            Submitted forms will appear here.
          </div>
        ) : (
          <ul className="flex flex-col">
            {cards.map((card) => (
              <li
                key={card.formUuid}
                className="flex items-start justify-between gap-4 border-t border-grey-stroke-weak px-8 py-4 first:border-t-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-paragraph-1 font-semibold text-app-strong-text">
                    {card.title}
                  </p>
                  <p className="mt-1 text-small text-grey-text-weak">
                    Submitted{" "}
                    <LocalDateTime
                      iso={card.submittedAt.toISOString()}
                      format="monthDay"
                    />
                    {card.closesAt ? (
                      <>
                        {" · Open until "}
                        <LocalDateTime iso={card.closesAt} format="monthDay" />
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Link
                    href={`/forms/${card.formId}/response`}
                    aria-label={`View ${card.title} response`}
                    className="text-paragraph-2 font-semibold text-brand-text hover:underline"
                  >
                    View
                  </Link>
                  {card.canEdit ? (
                    <Link
                      href={`/forms/${card.formId}/edit`}
                      aria-label={`Edit ${card.title} response`}
                      className="text-paragraph-2 font-semibold text-brand-text hover:underline"
                    >
                      Edit
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default async function FormsCompletedWidget({
  organizationId,
  userId,
  audience,
}: WidgetProps) {
  const loaded = await loadFormProgress(organizationId, userId, audience);
  if (!loaded.formsEnabled) {
    return null;
  }

  return <FormsCompletedWidgetView cards={loaded.summary.completed} />;
}
