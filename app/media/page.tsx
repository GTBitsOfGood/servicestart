import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BellSimple, CaretDown } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/lib/auth";
import { MembersService } from "@/lib/services/MemberService";

const mediaItems = Array.from({ length: 10 }, (_, index) => ({
  id: `media-${index + 1}`,
  name: "filename.jpg",
}));

const filterItems = ["Type", "Tags", "Date"] as const;
const navItems = ["Menu Item", "Menu Item", "Menu Item"] as const;

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
    <article className="flex min-h-[18.1rem] flex-col rounded-2xl border border-[var(--color-media-border)] bg-[var(--color-media-surface)] p-3 shadow-[0_1px_0_0_var(--color-media-border)]">
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
      className="flex min-h-[18.1rem] w-full flex-col items-center justify-center rounded-2xl border border-[var(--color-media-upload-border)] bg-[var(--color-media-upload-bg)] px-8 text-center text-[var(--color-media-inverse)] hover:border-[var(--color-media-upload-hover-border)] hover:bg-[var(--color-media-upload-hover-bg)]"
    >
      <div className="mb-4 flex items-center justify-center">
        <svg
          width="119"
          height="148"
          viewBox="0 0 119 148"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-[10.4rem] w-[8.4rem]"
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
            <div className="hidden items-center gap-3 md:flex">
              <div className="h-12 w-12 rounded-full bg-[var(--color-media-avatar)]" />
              <div className="leading-tight">
                <p className="text-paragraph-2 font-semibold">Firstname Last</p>
                <p className="text-small text-[var(--color-grey-text-weak)]">
                  Admin
                </p>
              </div>
              <CaretDown size={16} weight="bold" />
            </div>

            <button
              type="button"
              className="relative flex h-12 w-12 items-center justify-center rounded-full"
              aria-label="Notifications"
            >
              <BellSimple size={20} weight="fill" />
              <span className="absolute right-[0.2rem] top-[0.4rem] flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--color-brand-text)] px-1 text-[1.1rem] font-semibold leading-none text-[var(--color-media-inverse)]">
                4
              </span>
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[144rem] px-8 py-10 md:px-12 lg:px-16 lg:py-14">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <h1 className="text-heading-1 text-[4.8rem] leading-[1] text-[var(--color-grey-text-strong)]">
              Media Gallery
            </h1>

            <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-end">
              <div className="flex flex-wrap gap-3">
                {filterItems.map((item) => (
                  <FilterChip key={item} label={item} />
                ))}
              </div>

              <div className="flex items-center gap-4">
                <span className="text-heading-4 font-normal">Sort by</span>
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

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-[minmax(0,2.1fr)_repeat(4,minmax(0,1fr))]">
            <div className="lg:col-span-1">
              <UploadCard />
            </div>
            {mediaItems.slice(0, 4).map((item) => (
              <MediaCard key={item.id} name={item.name} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {mediaItems.slice(4).map((item) => (
              <MediaCard key={item.id} name={item.name} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
