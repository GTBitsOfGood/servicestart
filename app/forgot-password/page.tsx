"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useOrganizationConfig from "@/lib/hooks/useOrganizationConfig";
import BogTextInput from "@/components/bog/BogTextInput/BogTextInput";
import BogButton from "@/components/bog/BogButton/BogButton";
import { OrganizationConfigKey } from "@/lib/schema";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";
import authClient from "@/lib/authClient";
import LeftArrowIcon from "@/components/LeftArrowIcon";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const { primary_color = "#FFFFFF", secondary_color = "#FFFFFF" } =
    useOrganizationConfig([
      OrganizationConfigKey.PrimaryColor,
      OrganizationConfigKey.SecondaryColor,
    ]);
  const org = useActiveOrganization();
  const logo = org?.organization.data?.logo;

  const handleEmailSubmit = async () => {
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });

    if (error) {
      alert(error.message || "Failed to send password reset email");
    } else {
      alert("Password reset email sent!");
      router.push("/login");
    }
  };

  return (
    <div
      className="flex h-screen w-screen items-center"
      data-testid="page"
      style={{
        background: `linear-gradient(75deg, ${primary_color} 0%, ${secondary_color} 100%)`,
      }}
    >
      <div className="flex h-full w-[53%] flex-shrink-0 items-center justify-between px-[30px]">
        <div
          className="flex h-[95%] w-full flex-col justify-flex-end rounded-3xl pt-[90%] pb-5 pl-5 pr-1/2"
          style={{
            background: `linear-gradient(180deg, ${primary_color} 0%, #FFF 100%)`,
          }}
        >
          <div className="h-full w-1/3">
            {logo && (
              <img
                src={`/images/${logo}`}
                alt="Organization Logo"
                className="h-[80%]"
              />
            )}
          </div>
        </div>
      </div>
      <div className="flex h-full flex-1 flex-col items-center justify-between pt-[15%]">
        <div className="flex w-[80%] bg-white flex-col p-12 justify-center items-center gap-5 border-[2px] rounded-4xl shadow-[0_4px_7px_0_rgba(0,0,0,0.4)]">
          <div className="flex flex-col items-center gap-5 self-stretch">
            <div className="flex flex-col items-center gap-14 self-stretch">
              <div className="flex flex-col items-flex-start gap-12 self-stretch">
                <div className="flex flex-col items-flex-start gap-4 self-stretch">
                  <h1>Reset Password</h1>
                  <p className="text-grey-text-weak">
                    Enter your email to receive a password reset link.
                  </p>
                </div>
                <BogTextInput
                  name="email"
                  label="Email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex flex-col self-stretch"
                />
              </div>
              <div className="flex flex-col items-center gap-6">
                <BogButton onClick={handleEmailSubmit} className="p-5 bg-black">
                  Reset Password
                </BogButton>
                <BogButton
                  className="bg-transparent text-grey-text-weak"
                  onClick={() => router.push("/login")}
                >
                  <LeftArrowIcon />
                  Back to Login
                </BogButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
