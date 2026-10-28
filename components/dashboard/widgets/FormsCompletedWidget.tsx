import Link from "next/link";
import { EyeIcon, PencilSimpleIcon } from "@phosphor-icons/react/ssr";
import LocalDateTime from "@/components/forms/LocalDateTime";
import {
  loadFormProgress,
  type FormCompletedCard,
} from "@/lib/dashboard/formProgress";
import type { WidgetProps } from "@/lib/dashboard/widgets";

const ICON_LINK_CLASS =
  "inline-flex size-12 items-center justify-center rounded-full text-brand-text hover:bg-grey-fill-weak";

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
                  <h4 className="text-paragraph-1 font-semibold text-app-strong-text">
                    {card.title}
                  </h4>
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
                <div className="flex shrink-0 items-center gap-1">
                  <Link
                    href={`/forms/${card.formId}/response`}
                    aria-label={`View ${card.title} response`}
                    title="View response"
                    className={ICON_LINK_CLASS}
                  >
                    <EyeIcon size={20} aria-hidden />
                  </Link>
                  {card.canEdit ? (
                    <Link
                      href={`/forms/${card.formId}/edit`}
                      aria-label={`Edit ${card.title} response`}
                      title="Edit response"
                      className={ICON_LINK_CLASS}
                    >
                      <PencilSimpleIcon size={20} aria-hidden />
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
