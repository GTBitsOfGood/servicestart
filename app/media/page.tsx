import BogIcon from "@/components/bog/BogIcon/BogIcon";
import MediaCard from "@/components/MediaCard";
import MediaUploadCard from "@/components/MediaUploadCard";
import { MediaService } from "@/lib/services/MediaService";
import { redirectIfNotAdmin } from "@/lib/authUtils";

const typeOptions = ["Videos", "Images", "Documents", "All"] as const;
const dateOptions = ["Today", "Last Week", "Last Month", "All Time"] as const;
const sortOptions = ["Oldest to Newest", "Newest to Oldest", "A-Z"] as const;

function FilterSelect({
  label,
  options,
  variant = "dark",
}: {
  label: string;
  options: readonly string[];
  variant?: "dark" | "light";
}) {
  const isDark = variant === "dark";

  return (
    <div className="relative inline-flex">
      <select
        aria-label={label}
        defaultValue=""
        className={`h-11 min-w-52 appearance-none rounded-xl border px-4 pr-10 text-paragraph-2 ${
          isDark
            ? "border-grey-text-strong bg-grey-text-strong text-media-inverse"
            : "border-grey-stroke-strong bg-media-surface-soft text-grey-text-strong"
        }`}
      >
        <option value="" disabled>
          {label}
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
        <BogIcon
          name="caret-down"
          size={12}
          color={isDark ? "white" : "black"}
        />
      </span>
    </div>
  );
}

export default async function MediaPage() {
  const session = await redirectIfNotAdmin();
  const activeOrganizationId = session.session.activeOrganizationId;

  const mediaItems = await MediaService.listByOrganization(
    activeOrganizationId,
    {
      limit: 24,
      offset: 0,
    },
  );

  const hasMedia = mediaItems.length > 0;

  return (
    <div className="min-h-full bg-media-page-bg text-grey-text-strong">
      <section className="mx-auto max-w-[152rem] px-8 py-10 md:px-10 lg:px-12 lg:py-14">
        <div className="flex flex-col gap-8">
          <div className="mb-4 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <h1 className="text-heading-1 text-[4.8rem] leading-[1] text-grey-text-strong">
              Media Gallery
            </h1>

            <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-end md:gap-10">
              <div className="flex flex-wrap gap-10">
                <FilterSelect label="Type" options={typeOptions} />
                <FilterSelect label="Date" options={dateOptions} />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-paragraph-1 font-normal text-grey-text-strong">
                  Sort by
                </span>
                <FilterSelect
                  label="Date"
                  options={sortOptions}
                  variant="light"
                />
              </div>
            </div>
          </div>

          {hasMedia ? (
            <div className="lg:px-4">
              <div className="grid auto-rows-[19rem] grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-6">
                <div className="sm:col-span-2 lg:col-span-2">
                  <MediaUploadCard variant="grid" />
                </div>
                {mediaItems.map((item) => (
                  <MediaCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          ) : (
            <div className="pt-12 lg:pt-16">
              <MediaUploadCard variant="empty" />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
