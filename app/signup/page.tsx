"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BogTextInput from "@/components/bog/BogTextInput/BogTextInput";
import BogButton from "@/components/bog/BogButton/BogButton";
import authClient from "@/lib/authClient";
import useOrganizationConfig from "@/lib/hooks/useOrganizationConfig";
import { OrganizationConfigKey } from "@/lib/schema";
import { getSlugFromHost } from "@/lib/clientAuthUtils";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    primary_color = "#FFFFFF",
    secondary_color = "#FFFFFF",
    tagline = "Welcome",
  } = useOrganizationConfig([
    OrganizationConfigKey.PrimaryColor,
    OrganizationConfigKey.SecondaryColor,
    OrganizationConfigKey.Tagline,
  ]);
  const org = useActiveOrganization();
  const logo = org?.organization.data?.logo;

  const handleSignup = async () => {
    setLoading(true);

    if (!firstName || !lastName) {
      alert("Please enter your name.");
      setLoading(false);
      return;
    }

    if (!email) {
      alert("Please enter your email.");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      alert("Password should be at least 8 characters.");
      setLoading(false);
      return;
    }
    try {
      let organizationId = org?.organization?.data?.id;
      let orgPrefix = org?.slug || getSlugFromHost(window.location.host);
      if (!organizationId) {
        // Fallback: try to resolve from slug (subdomain)
        const slug = orgPrefix;
        if (slug) {
          // Call an API endpoint to resolve org id from slug
          const res = await fetch(
            `/api/organization/resolve-id?slug=${encodeURIComponent(slug)}`,
          );
          if (res.ok) {
            const data = await res.json();
            organizationId = data.organizationId;
          }
        }
      }
      if (!organizationId) {
        alert("No active organization context. Please try again.");
        setLoading(false);
        return;
      }
      // Use the actual email for signup (no plus addressing)
      await authClient.signUp.email(
        {
          email,
          password,
          name: `${firstName} ${lastName}`,
          callbackURL: "/",
          organizationId,
        },
        {
          fetchOptions: {
            headers: {
              "x-organization-id": organizationId,
            },
          },
          onSuccess: () => {
            router.push("/");
          },
          onError: (ctx) => {
            alert(ctx.error.message || "Invalid email or password");
          },
        },
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkLoggedIn = async () => {
      const session = await authClient.getSession();
      if (!session?.data?.user) {
        return;
      }

      if (org?.slug === getSlugFromHost(window.location.host)) {
        router.replace("/");
      }
    };

    void checkLoggedIn();
  }, [org?.slug, router]);

  return (
    <div
      className="flex h-screen w-screen items-center"
      style={{
        background: `linear-gradient(75deg, ${primary_color} 0%, ${secondary_color} 100%)`,
      }}
    >
      <div className="flex h-full w-[53%] shrink-0 items-center justify-between px-7.5">
        <div
          className="flex h-[94%] w-full flex-col justify-end rounded-[20px] pt-[90%] pb-5 pl-5 pr-[60%]"
          style={{
            background: `linear-gradient(180deg, ${primary_color} 0%, #FFF 100%)`,
          }}
        >
          <div className="h-32.5 w-84.75">
            {logo && (
              <img
                src={`/images/${logo}`}
                alt="Organization Logo"
                className="h-26.75 w-26.75"
              />
            )}
          </div>
        </div>
      </div>
      <div className="flex h-full flex-1 flex-col items-center justify-between pt-[5%]">
        <div className="flex h-full w-[78%] bg-white flex-col items-center gap-[23px] rounded-[30px] border-[2px] border-[#FFF] p-[35px] pt-[12%] shadow-[0_4px_7px_0_rgba(0,0,0,0.4)]">
          <h1 className="self-stretch">Sign Up</h1>
          <p className="self-stretch text-[20px] text-white">{tagline}</p>
          <BogTextInput
            name="first_name"
            type="text"
            label="First Name"
            placeholder="John"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="self-stretch rounded-sm px-3 text-[18px] font-semibold leading-6 text-[#22070B]"
          />
          <BogTextInput
            name="last_name"
            type="text"
            label="Last Name"
            placeholder="Smith"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="self-stretch rounded-sm px-3 text-[18px] font-semibold leading-6 text-[#22070B]"
          />
          <BogTextInput
            name="email"
            type="email"
            label="Email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="self-stretch rounded-sm px-3 text-[18px] font-semibold leading-6 text-[#22070B]"
          />
          <BogTextInput
            name="password"
            type="password"
            label="Password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="self-stretch rounded-[4px] px-[12px] text-[18px] font-semibold leading-[24px] text-[#22070B]"
          />
          <BogButton
            onClick={handleSignup}
            disabled={loading}
            className="flex h-[10%] items-center justify-center rounded-[4px] bg-[#22070B] px-[25px] py-[8px] text-center text-[18px] leading-[24px] text-white"
          >
            Create Account
          </BogButton>
          <p className="text-[16px] leading-[20px]">
            Already have an account?{" "}
            <button
              onClick={() => router.push("/login")}
              className="text-[18px] font-bold underline"
            >
              Login
            </button>
          </p>
        </div>
        <div className="flex h-full flex-1 flex-col items-center justify-between pt-[249px]" />
      </div>
    </div>
  );
}
