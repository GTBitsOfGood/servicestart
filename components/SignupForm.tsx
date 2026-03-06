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

export function SignupForm() {
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
      await authClient.signUp.email(
        {
          email,
          password,
          name: `${firstName} ${lastName}`,
          callbackURL: "/",
        },
        {
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
      <div className="flex h-full w-[53%] flex-shrink-0 items-center justify-between px-[30px]">
        <div
          className="flex h-[94%] w-full flex-col justify-end rounded-[20px] pt-[90%] pb-[20px] pl-[20px] pr-[60%]"
          style={{
            background: `linear-gradient(180deg, ${primary_color} 0%, #FFF 100%)`,
          }}
        >
          <div className="h-[130px] w-[339px]">
            {logo && (
              <img
                src={`/images/${logo}`}
                alt="Organization Logo"
                className="h-[107px] w-[107px]"
              />
            )}
          </div>
        </div>
      </div>
      <div className="flex h-full flex-1 flex-col items-center justify-between pt-[8%]">
        <div className="flex h-full w-[78%] flex-col items-center gap-[23px] rounded-[30px] border-[2px] border-[#FFF] p-[35px] pt-[12%] shadow-[0_4px_7px_0_rgba(0,0,0,0.4)]">
          <p className="self-stretch text-[48px] font-bold text-black">
            Sign Up
          </p>
          <p className="self-stretch text-[20px] text-white">{tagline}</p>
          <BogTextInput
            name="first_name"
            type="text"
            label="First Name"
            placeholder="John"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="self-stretch rounded-[4px] px-[12px] text-[18px] font-semibold leading-[24px] text-[#22070B]"
          />
          <BogTextInput
            name="last_name"
            type="text"
            label="Last Name"
            placeholder="Smith"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="self-stretch rounded-[4px] px-[12px] text-[18px] font-semibold leading-[24px] text-[#22070B]"
          />
          <BogTextInput
            name="email"
            type="email"
            label="Email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="self-stretch rounded-[4px] px-[12px] text-[18px] font-semibold leading-[24px] text-[#22070B]"
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
