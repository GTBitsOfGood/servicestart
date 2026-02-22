"use client";

import authClient from "@/lib/authClient";
import { useState } from "react";
import BogTextInput from "@/components/BogTextInput/BogTextInput";
import BogButton from "@/components/BogButton/BogButton";
import { useRouter } from "next/navigation";
import useOrganizationConfig from "@/lib/hooks/useOrganizationConfig";
import { OrganizationConfigKey } from "@/lib/schema";

export default function SignupPage() {
  const router = useRouter();
  const organization = authClient.useActiveOrganization();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const config = useOrganizationConfig([
    OrganizationConfigKey.PrimaryColor,
    OrganizationConfigKey.SecondaryColor,
  ] as const);
  const primaryColor = "#FD8033";
  const secondaryColor = "#FB3552";

  const handleSignup = async () => {
    const { data, error } = await authClient.signUp.email(
      {
        email,
        password,
        name: `${firstName} ${lastName}`,
        callbackURL: "/",
      },
      {
        onSuccess: () => {
          router.push("/login");
        },
        onError: (e) => {
          console.error("Sign Up error:", e);
        },
      },
    );
  };

  return (
    <div
      className="flex h-screen w-screen items-center"
      style={{
        background: `linear-gradient(75deg, ${primaryColor[0]} 0%, ${secondaryColor[0]} 100%)`,
      }}
    >
      <div className="w-[53%] h-full flex justify-between items-center flex-shrink-0 px-[30px]">
        <div
          className="h-[94%] w-full flex flex-col justify-flex-end rounded-[20px] pt-[90%] pb-[20px] pl-[20px] pr-[60%]"
          style={{
            background: `linear-gradient(180deg, ${primaryColor[0]} 0%, #FFF 100%)`,
          }}
        >
          <div className="w-[339px] h-[130px]">
            {organization?.data?.logo && (
              <img
                src={`/images/${organization?.data?.logo}`}
                alt="Organization Logo"
                className="w-[107px] h-[107px]"
              />
            )}
          </div>
        </div>
      </div>
      <div className="h-full flex flex-col justify-between items-center flex-1 pt-[8%]">
        <div className="w-[78%] h-full flex flex-col items-center gap-[23px] p-[35px] pt-[12%] border-[2px] border-[#FFF] rounded-[30px] shadow-[0_4px_7px_0_rgba(0,0,0,0.4)]">
          <p className="text-black text-[48px] font-bold self-stretch">
            Sign Up
          </p>
          <p className="text-white text-[20px] letter-spacing-[-0.48px] self-stretch">
            Welcome to Nonprofit!
          </p>
          <BogTextInput
            name="first_name"
            type="text"
            label="First Name"
            placeholder="John"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="text-[18px] leading-[24px] px-[12px] rounded-[4px] self-stretch font-semibold text-[#22070B]"
          />
          <BogTextInput
            name="last_name"
            type="text"
            label="Last Name"
            placeholder="Smith"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="text-[18px] leading-[24px] px-[12px] rounded-[4px] self-stretch font-semibold text-[#22070B]"
          />
          <BogTextInput
            name="email"
            type="email"
            label="Email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-[18px] leading-[24px] px-[12px] rounded-[4px] self-stretch font-semibold text-[#22070B]"
          />
          <BogTextInput
            name="password"
            type="password"
            label="Password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="text-[18px] leading-[24px] px-[12px] rounded-[4px] self-stretch font-semibold text-[#22070B]"
          />
          <BogButton
            onClick={handleSignup}
            className="flex h-[10%] text-white text-center text-[18px] leading-[24px] justify-center items-center py-[8px] px-[25px] bg-[#22070B] rounded-[4px]"
          >
            Create Account
          </BogButton>
          <p className="text-[16px] leading-[20px]">
            Already have an account?{" "}
            <button
              onClick={() => router.push("/login")}
              className="underline font-bold text-[18px]"
            >
              Login
            </button>
          </p>
        </div>
        <div className="flex flex-col h-full pt-[249px] justify-between items-center flex-1"></div>
      </div>
    </div>
  );
}
