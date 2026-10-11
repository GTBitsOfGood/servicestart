"use client";

import AuthOrgTagline from "@/components/auth/AuthOrgTagline";
import AuthPageIntro from "@/components/auth/AuthPageIntro";
import SignupForm from "@/components/auth/SignupForm";
import { useRedirectIfSignedIn } from "@/lib/hooks/useRedirectIfSignedIn";

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
