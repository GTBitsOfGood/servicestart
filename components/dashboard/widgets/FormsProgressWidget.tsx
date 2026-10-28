import {
  loadFormProgress,
  type FormProgressGauge,
} from "@/lib/dashboard/formProgress";
import type { WidgetProps } from "@/lib/dashboard/widgets";

const GAUGE_RADIUS = 80;
const GAUGE_STROKE = 12;
const GAUGE_VIEW_WIDTH = 200;
const GAUGE_VIEW_HEIGHT = 110;
const GAUGE_CENTER_X = GAUGE_VIEW_WIDTH / 2;
const GAUGE_CENTER_Y = GAUGE_VIEW_HEIGHT - 10;
const GAUGE_ARC_LENGTH = Math.PI * GAUGE_RADIUS;

const GAUGE_ARC_PATH = `M ${GAUGE_CENTER_X - GAUGE_RADIUS} ${GAUGE_CENTER_Y} A ${GAUGE_RADIUS} ${GAUGE_RADIUS} 0 0 1 ${GAUGE_CENTER_X + GAUGE_RADIUS} ${GAUGE_CENTER_Y}`;

function gaugeAriaLabel(gauge: FormProgressGauge): string {
  if (gauge.total === 0) {
    return "No required forms yet";
  }
  return `${gauge.done} of ${gauge.total} forms completed`;
}

function gaugeProgressLength(gauge: FormProgressGauge): number {
  if (gauge.total === 0) {
    return 0;
  }
  return (gauge.done / gauge.total) * GAUGE_ARC_LENGTH;
}

export function FormsProgressView({ gauge }: { gauge: FormProgressGauge }) {
  const ariaLabel = gaugeAriaLabel(gauge);
  const progressLength = gaugeProgressLength(gauge);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-solid-bg-base p-8">
      <h3 className="text-heading-3 font-semibold text-app-strong-text">
        Forms Progress
      </h3>
      <div className="mt-4 flex min-h-0 flex-1 flex-col items-center justify-center">
        <div
          role="img"
          aria-label={ariaLabel}
          className="relative w-full min-w-0 max-w-full"
        >
          <svg
            viewBox={`0 0 ${GAUGE_VIEW_WIDTH} ${GAUGE_VIEW_HEIGHT}`}
            className="h-auto w-full"
            aria-hidden
          >
            <defs>
              <linearGradient
                id="forms-progress-gauge-fill"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop
                  offset="0%"
                  stopColor="var(--color-forms-gauge-fill-start)"
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-forms-gauge-fill-end)"
                />
              </linearGradient>
            </defs>
            <path
              d={GAUGE_ARC_PATH}
              fill="none"
              stroke="var(--color-forms-gauge-track)"
              strokeWidth={GAUGE_STROKE}
              strokeLinecap="round"
            />
            {gauge.total > 0 ? (
              <path
                d={GAUGE_ARC_PATH}
                fill="none"
                stroke="url(#forms-progress-gauge-fill)"
                strokeWidth={GAUGE_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${progressLength} ${GAUGE_ARC_LENGTH}`}
              />
            ) : null}
          </svg>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center text-center">
            {gauge.total === 0 ? (
              <p className="text-paragraph-2 font-semibold text-grey-text-strong">
                No required forms yet
              </p>
            ) : (
              <>
                <p className="text-heading-2 font-semibold text-app-strong-text">
                  {gauge.done}/{gauge.total}
                </p>
                <p className="text-paragraph-2 text-grey-text-weak">
                  Forms Completed
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function FormsProgressWidget({
  organizationId,
  userId,
  audience,
}: WidgetProps) {
  const loaded = await loadFormProgress(organizationId, userId, audience);
  if (!loaded.formsEnabled) {
    return null;
  }

  return <FormsProgressView gauge={loaded.summary.gauge} />;
}
