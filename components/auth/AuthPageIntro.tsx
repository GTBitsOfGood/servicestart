import type { ReactNode } from "react";

/** Title and optional description at the top of an auth card. */
export default function AuthPageIntro({
  title,
  description,
}: {
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 bg-page-bg">
      <h1 className="font-display">{title}</h1>
      {description && <p className="text-grey-text-weak">{description}</p>}
    </div>
  );
}
