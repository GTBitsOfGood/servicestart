import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/lib/auth";
import { MembersService } from "@/lib/services/MemberService";

const mediaItems = Array.from({ length: 10 }, (_, index) => ({
  id: `media-${index + 1}`,
  name: "filename.jpg",
}));

const filterItems = ["Type", "Date"] as const;
const navItems = ["Menu Item", "Menu Item", "Menu Item"] as const;
const unreadNotifications = 5;

function DropdownArrow({
  color,
  className,
}: {
  color: "white" | "black";
  className?: string;
}) {
  return (
    <svg
      width="12"
      height="6"
      viewBox="0 0 12 6"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 6L12 0H0L6 6Z" fill={color} />
    </svg>
  );
}

function NotificationBell() {
  return (
    <svg
      width="23"
      height="24"
      viewBox="0 0 23 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-[2.4rem] w-[2.3rem]"
      aria-hidden="true"
    >
      <path
        d="M15.4323 22.8831C15.4323 23.1165 15.3396 23.3404 15.1745 23.5054C15.0095 23.6705 14.7857 23.7632 14.5523 23.7632H7.5119C7.2785 23.7632 7.05466 23.6705 6.88962 23.5054C6.72458 23.3404 6.63186 23.1165 6.63186 22.8831C6.63186 22.6497 6.72458 22.4259 6.88962 22.2608C7.05466 22.0958 7.2785 22.0031 7.5119 22.0031H14.5523C14.7857 22.0031 15.0095 22.0958 15.1745 22.2608C15.3396 22.4259 15.4323 22.6497 15.4323 22.8831ZM21.9655 4.87744C20.9764 2.94426 19.4913 1.30874 17.6621 0.138399C17.5644 0.0759695 17.4553 0.0334719 17.3411 0.0133493C17.2268 -0.00677331 17.1098 -0.00412396 16.9966 0.0211449C16.8834 0.0464137 16.7763 0.0938037 16.6815 0.160591C16.5867 0.227378 16.5061 0.312245 16.4442 0.410313C16.3823 0.508382 16.3404 0.617718 16.3208 0.732036C16.3013 0.846353 16.3046 0.963399 16.3305 1.07644C16.3564 1.18949 16.4044 1.2963 16.4717 1.39075C16.539 1.48519 16.6243 1.56541 16.7227 1.62677C18.292 2.62507 19.5634 4.02763 20.4034 5.68708C20.5144 5.88765 20.6993 6.037 20.9188 6.10334C21.1382 6.16968 21.3749 6.14777 21.5784 6.04228C21.7819 5.93678 21.9363 5.75603 22.0086 5.53849C22.0809 5.32094 22.0654 5.08377 21.9655 4.87744ZM0.879675 6.1623C1.0409 6.16223 1.19901 6.11787 1.33675 6.03407C1.47448 5.95026 1.58655 5.83023 1.66071 5.68708C2.50072 4.02763 3.77218 2.62507 5.3415 1.62677C5.4399 1.56541 5.5252 1.48519 5.5925 1.39075C5.6598 1.2963 5.70777 1.18949 5.73365 1.07644C5.75953 0.963399 5.76281 0.846353 5.74331 0.732036C5.72381 0.617718 5.6819 0.508382 5.62 0.410313C5.5581 0.312245 5.47743 0.227378 5.38262 0.160591C5.28781 0.0938037 5.18074 0.0464137 5.06756 0.0211449C4.95437 -0.00412396 4.83731 -0.00677331 4.7231 0.0133493C4.60889 0.0334719 4.49978 0.0759695 4.40205 0.138399C2.57291 1.30874 1.08772 2.94426 0.0986365 4.87744C0.0291546 5.01155 -0.00463777 5.1613 0.000511636 5.31226C0.00566104 5.46322 0.0495788 5.61031 0.128038 5.73938C0.206498 5.86845 0.316858 5.97516 0.448499 6.04923C0.580139 6.1233 0.728628 6.16224 0.879675 6.1623ZM19.8325 10.5625C19.8325 8.2285 18.9053 5.99007 17.2549 4.33967C15.6045 2.68927 13.3661 1.76208 11.0321 1.76208C8.69806 1.76208 6.45963 2.68927 4.80923 4.33967C3.15883 5.99007 2.23164 8.2285 2.23164 10.5625C2.23164 13.4535 1.70582 15.8857 0.712467 17.5963C0.556557 17.8636 0.473903 18.1674 0.47284 18.4769C0.471778 18.7864 0.552344 19.0907 0.706415 19.3591C0.860486 19.6275 1.08261 19.8506 1.35039 20.0058C1.61818 20.1609 1.92214 20.2428 2.23164 20.243H19.8325C20.1418 20.2424 20.4455 20.1603 20.713 20.0049C20.9805 19.8496 21.2023 19.6265 21.3561 19.3581C21.5099 19.0898 21.5903 18.7856 21.5891 18.4763C21.588 18.167 21.5053 17.8635 21.3495 17.5963C20.3583 15.8846 19.8325 13.4524 19.8325 10.5625Z"
        fill="#22070B"
      />
    </svg>
  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="inline-flex h-11 items-center gap-3 rounded-xl bg-[var(--color-grey-text-strong)] px-6 text-paragraph-2 text-[var(--color-media-inverse)]"
    >
      <span>{label}</span>
      <DropdownArrow color="white" />
    </button>
  );
}

function MediaCard({ name }: { name: string }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-[var(--color-media-border)] bg-[var(--color-media-surface)] p-3 shadow-[0_1px_0_0_var(--color-media-border)]">
      <div className="min-h-[13.3rem] rounded-xl bg-[var(--color-media-surface-soft)]" />
      <p className="mt-2 text-paragraph-2 font-semibold text-[var(--color-grey-text-strong)]">
        {name}
      </p>
    </article>
  );
}

function UploadCard() {
  return (
    <button
      type="button"
      className="flex h-full w-full flex-col items-center justify-center rounded-2xl border border-[var(--color-media-upload-border)] bg-[var(--color-media-upload-bg)] px-8 py-6 text-center text-[var(--color-media-inverse)] hover:border-[var(--color-media-upload-hover-border)] hover:bg-[var(--color-media-upload-hover-bg)]"
    >
      <div className="mb-4 flex items-center justify-center">
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
      </div>
      <p className="text-paragraph-1 font-semibold text-[var(--color-media-inverse)]">
        Choose a file to upload
      </p>
      <p className="text-paragraph-2 text-[var(--color-media-inverse-strong)]">
        or drag a file here
      </p>
      <p className="text-small text-[var(--color-media-inverse-weak)]">
        .png, .jpg, .pdf, .jpeg
      </p>
    </button>
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
                <CaretDown size={16} weight="bold" />
                <button
                  type="button"
                  className="relative flex h-12 w-12 items-center justify-center rounded-full"
                  aria-label={`${unreadNotifications} unread notifications`}
                >
                  <NotificationBell />
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
                {filterItems.map((item) => (
                  <FilterChip key={item} label={item} />
                ))}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-paragraph-1 font-normal text-[var(--color-grey-text-strong)]">
                  Sort by
                </span>
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-8 rounded-xl border border-[var(--color-grey-stroke-strong)] bg-[var(--color-media-surface-soft)] px-5 text-paragraph-2"
                >
                  <span>Date</span>
                  <DropdownArrow color="black" />
                </button>
              </div>
            </div>
          </div>

          <div className="lg:px-4">
            <div className="grid auto-rows-[19rem] grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-6">
              <div className="sm:col-span-2 lg:col-span-2">
                <UploadCard />
              </div>
              {mediaItems.map((item) => (
                <MediaCard key={item.id} name={item.name} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
