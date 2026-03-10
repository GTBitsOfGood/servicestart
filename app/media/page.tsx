import { headers } from "next/headers";
import { redirect } from "next/navigation";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import MediaUploadCard from "@/components/MediaUploadCard";
import { auth } from "@/lib/auth";
import { MembersService } from "@/lib/services/MemberService";
import { MediaService } from "@/lib/services/MediaService";

const navItems = ["Menu Item", "Menu Item", "Menu Item"] as const;
const unreadNotifications = 5;
const typeOptions = ["Videos", "Images", "Documents", "All"] as const;
const dateOptions = ["Today", "Last Week", "Last Month", "All Time"] as const;
const sortOptions = ["Oldest to Newest", "Newest to Oldest", "A-Z"] as const;
type MediaItem = Awaited<
  ReturnType<typeof MediaService.listByOrganization>
>[number];

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
        className={`h-11 min-w-[12.6rem] appearance-none rounded-xl border px-4 pr-10 text-paragraph-2 ${
          isDark
            ? "border-[var(--color-grey-text-strong)] bg-[var(--color-grey-text-strong)] text-[var(--color-media-inverse)]"
            : "border-[var(--color-grey-stroke-strong)] bg-[var(--color-media-surface-soft)] text-[var(--color-grey-text-strong)]"
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

function MediaCard({ item }: { item: MediaItem }) {
  const previewUrl = item.type === "image" ? `/images/${item.id}` : null;

  return (
    <article className="flex h-full flex-col rounded-2xl border border-[var(--color-media-border)] bg-[var(--color-media-surface)] p-3 shadow-[0_1px_0_0_var(--color-media-border)]">
      <div className="min-h-[13.3rem] overflow-hidden rounded-xl bg-[var(--color-media-surface-soft)]">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={item.altText}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <p className="mt-2 text-paragraph-2 font-semibold text-[var(--color-grey-text-strong)]">
        {item.title}
      </p>
    </article>
  );
}

export default async function MediaPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const activeOrganizationId = session.session.activeOrganizationId;
  if (!activeOrganizationId) {
    redirect("/");
  }

  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    activeOrganizationId,
  );

  if (!MembersService.isAdminOrOwner(membership?.role)) {
    redirect("/");
  }

  const mediaItems = await MediaService.listByOrganization(
    activeOrganizationId,
    {
      limit: 24,
      offset: 0,
    },
  );

  const hasMedia = mediaItems.length > 0;

  return (
    <main className="min-h-screen bg-[var(--color-media-page-bg)] text-[var(--color-grey-text-strong)]">
      <header className="border-b border-[var(--color-media-divider)] bg-[var(--color-media-page-bg)]">
        <div className="mx-auto flex max-w-[144rem] items-center justify-between gap-8 px-8 py-6 md:px-12 lg:px-16">
          <div className="flex items-center gap-4">
            <div className="h-15 w-15 rounded-full bg-[var(--color-brand-text)] shadow-[0_4px_14px_0_var(--color-media-shadow)]" />
            <div className="leading-none">
              <p className="text-small text-[var(--color-grey-text-weak)]">
                bits of good
              </p>
              <p className="text-heading-4 text-[var(--color-brand-text)]">
                sunset
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-12 lg:flex">
            {navItems.map((item, index) => (
              <a
                key={`${item}-${index}`}
                href="#"
                className={`text-paragraph-1 ${
                  index === 0
                    ? "font-semibold text-[var(--color-grey-text-strong)]"
                    : "text-[var(--color-grey-text-weak)]"
                }`}
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-6">
            <div className="hidden items-center gap-16 md:flex">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-[var(--color-media-avatar)]" />
                <div className="leading-tight">
                  <p className="text-paragraph-2 font-semibold">
                    Firstname Last
                  </p>
                  <p className="text-small text-[var(--color-grey-text-weak)]">
                    Admin
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <BogIcon name="caret-down" size={16} weight="bold" />
                <button
                  type="button"
                  className="relative flex h-12 w-12 items-center justify-center rounded-full"
                  aria-label={`${unreadNotifications} unread notifications`}
                >
                  <BogIcon
                    name="bell"
                    size={23}
                    className="h-[2.4rem] w-[2.3rem] text-[var(--color-grey-text-strong)]"
                  />
                  {unreadNotifications > 0 ? (
                    <span className="absolute right-[-0.1rem] top-[0.1rem] flex h-7 min-w-7 items-center justify-center rounded-full border border-[var(--color-media-notification-border)] bg-[var(--color-media-notification-bg)] px-1.5 text-[1.1rem] font-semibold leading-none text-[var(--color-media-inverse)]">
                      {unreadNotifications}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[152rem] px-8 py-10 md:px-10 lg:px-12 lg:py-14">
        <div className="flex flex-col gap-8">
          <div className="mb-4 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <h1 className="text-heading-1 text-[4.8rem] leading-[1] text-[var(--color-grey-text-strong)]">
              Media Gallery
            </h1>

            <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-end md:gap-10">
              <div className="flex flex-wrap gap-10">
                <FilterSelect label="Type" options={typeOptions} />
                <FilterSelect label="Date" options={dateOptions} />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-paragraph-1 font-normal text-[var(--color-grey-text-strong)]">
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
    </main>
  );
}
