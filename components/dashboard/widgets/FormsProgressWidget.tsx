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
const GAUGE_COUNT_FONT_SIZE = 28;
const GAUGE_CAPTION_FONT_SIZE = 11;
const GAUGE_EMPTY_FONT_SIZE = 12;

const GAUGE_ARC_PATH = `M ${GAUGE_CENTER_X - GAUGE_RADIUS} ${GAUGE_CENTER_Y} A ${GAUGE_RADIUS} ${GAUGE_RADIUS} 0 0 1 ${GAUGE_CENTER_X + GAUGE_RADIUS} ${GAUGE_CENTER_Y}`;

function gaugeAriaLabel(gauge: FormProgressGauge): string {
  if (gauge.total === 0) {
    return "No required forms yet";
  }
  return `${gauge.done} of ${gauge.total} forms completed`;
}

export function FormsProgressView({ gauge }: { gauge: FormProgressGauge }) {
  const progressLength =
    gauge.total === 0 ? 0 : (gauge.done / gauge.total) * GAUGE_ARC_LENGTH;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-solid-bg-base p-8">
      <h3 className="text-heading-3 font-semibold text-app-strong-text">
        Forms Progress
      </h3>
      {/* The svg fills this box and scales to fit both axes, so the gauge
          never outgrows a short dashboard slot. */}
      <div className="relative mx-auto mt-4 aspect-20/11 min-h-0 w-full max-w-2xl flex-1 mobile:aspect-auto">
        <svg
          viewBox={`0 0 ${GAUGE_VIEW_WIDTH} ${GAUGE_VIEW_HEIGHT}`}
          role="img"
          aria-label={gaugeAriaLabel(gauge)}
          className="absolute inset-0 size-full"
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
          {/* A zero-length dash still draws a round cap, so skip the arc at 0. */}
          {gauge.done > 0 ? (
            <path
              d={GAUGE_ARC_PATH}
              fill="none"
              stroke="url(#forms-progress-gauge-fill)"
              strokeWidth={GAUGE_STROKE}
              strokeLinecap="round"
              strokeDasharray={`${progressLength} ${GAUGE_ARC_LENGTH}`}
            />
          ) : null}
          {gauge.total === 0 ? (
            <text
              x={GAUGE_CENTER_X}
              y={GAUGE_CENTER_Y - 10}
              textAnchor="middle"
              fontSize={GAUGE_EMPTY_FONT_SIZE}
              className="fill-grey-text-strong font-semibold"
            >
              No required forms yet
            </text>
          ) : (
            <>
              <text
                x={GAUGE_CENTER_X}
                y={GAUGE_CENTER_Y - 16}
                textAnchor="middle"
                fontSize={GAUGE_COUNT_FONT_SIZE}
                className="fill-app-strong-text font-semibold"
              >
                {gauge.done}/{gauge.total}
              </text>
              <text
                x={GAUGE_CENTER_X}
                y={GAUGE_CENTER_Y + 2}
                textAnchor="middle"
                fontSize={GAUGE_CAPTION_FONT_SIZE}
                className="fill-grey-text-weak"
              >
                Forms Completed
              </text>
            </>
          )}
        </svg>
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
