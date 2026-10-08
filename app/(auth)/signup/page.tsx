"use client";

import AuthOrgTagline from "@/components/auth/AuthOrgTagline";
import AuthPageIntro from "@/components/auth/AuthPageIntro";
import SignupForm from "@/components/auth/SignupForm";
import { useRedirectIfSignedIn } from "@/lib/hooks/useRedirectIfSignedIn";

export default function SignupPage() {
  useRedirectIfSignedIn(() => "/");

  return (
    <>
      <div className="flex flex-col gap-3 bg-page-bg">
        <AuthPageIntro title="Sign Up" />
        <AuthOrgTagline />
      </div>
      <SignupForm />
    </>
  );
}
