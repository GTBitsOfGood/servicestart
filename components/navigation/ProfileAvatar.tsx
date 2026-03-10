interface ProfileAvatarProps {
  size?: "md" | "lg";
  className?: string;
}

export function ProfileAvatar({ size = "md", className }: ProfileAvatarProps) {
  const baseSizeClass = size === "lg" ? "h-14 w-14" : "h-10 w-10";

  return (
    <div
      className={`${baseSizeClass} rounded-full bg-grey-off-state ${
        className ?? ""
      }`}
    />
  );
}
