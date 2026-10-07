"use client";

import AuthLayout from "@/components/auth/AuthLayout";
import SignupForm from "@/components/auth/SignupForm";
import { useRedirectIfSignedIn } from "@/lib/hooks/useRedirectIfSignedIn";

function getHomePath() {
  return "/";
}

export default function SignupPage() {
  useRedirectIfSignedIn(getHomePath);

  return (
    <AuthLayout title="Sign Up" showTagline>
      <SignupForm />
    </AuthLayout>
  );
}
