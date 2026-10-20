import Link from "next/link";
import { ArrowLeftIcon } from "@phosphor-icons/react/ssr";
import { AUTH_LINK_CLASS } from "@/components/auth/authStyles";

export default function BackToLoginLink() {
  return (
    <Link
      href="/login"
      className={`flex items-center justify-center gap-2 self-center ${AUTH_LINK_CLASS}`}
    >
      <ArrowLeftIcon aria-hidden />
      Back to Login
    </Link>
  );
}
