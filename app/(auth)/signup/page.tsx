"use client";

import AuthOrgTagline from "@/core/auth/components/AuthOrgTagline";
import AuthPageIntro from "@/core/auth/components/AuthPageIntro";
import SignupForm from "@/core/auth/components/SignupForm";
import { useRedirectIfSignedIn } from "@/core/auth/hooks/useRedirectIfSignedIn";

export default function SignupPage() {
  useRedirectIfSignedIn();

  return (
    <>
      <AuthPageIntro title="Sign Up">
        <AuthOrgTagline />
      </AuthPageIntro>
      <SignupForm />
    </>
  );
}
