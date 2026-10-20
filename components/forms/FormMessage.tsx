import type { AriaRole, ReactNode } from "react";

type FormMessageProps = {
  title: string;
  role?: AriaRole;
  children: ReactNode;
};

/** A form page's state in place of its questions, e.g. "closed". */
export default function FormMessage({
  title,
  role,
  children,
}: FormMessageProps) {
  return (
    <section
      role={role}
      className="flex flex-col gap-3 rounded-control border border-grey-stroke-weak bg-solid-bg-sunken p-8"
    >
      <h2 className="font-display text-heading-3 text-page-text">{title}</h2>
      <p className="whitespace-pre-line text-paragraph-1 text-page-text">
        {children}
      </p>
    </section>
  );
}
