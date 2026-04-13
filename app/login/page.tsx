"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import authClient from "@/lib/authClient";
import useOrganizationConfig from "@/lib/hooks/useOrganizationConfig";
import BogTextInput from "@/components/bog/BogTextInput/BogTextInput";
import BogButton from "@/components/bog/BogButton/BogButton";
import { OrganizationConfigKey } from "@/lib/schema";

import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";
import { getSlugFromHost } from "@/lib/clientAuthUtils";

export default function LoginPage() {
  const router = useRouter();
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

  const handleLogin = async () => {
    setLoading(true);
    try {
      const organizationSlug =
        org?.slug || getSlugFromHost(window.location.host);
      await authClient.signIn.email(
        {
          email,
          password,
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
      data-testid="page"
      style={{
        background: `linear-gradient(75deg, ${primary_color} 0%, ${secondary_color} 100%)`,
      }}
    >
      <div className="flex h-full w-[53%] flex-shrink-0 items-center justify-between px-[30px]">
        <div
          className="flex h-[94%] w-full flex-col justify-flex-end rounded-[20px] pt-[90%] pb-[20px] pl-[20px] pr-[60%]"
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
      <div className="flex h-full flex-1 flex-col items-center justify-between pt-[12%]">
        <div className="flex w-[78%] bg-white flex-col items-center gap-6 rounded-4xl border-[2px] border-[#FFF] p-9 pt-25 shadow-[0_4px_7px_0_rgba(0,0,0,0.4)]">
          <h1 className="self-stretch">Login</h1>
          <p className="self-stretch text-mobile-heading-2 text-white">
            {tagline}
          </p>
          <BogTextInput
            name="email"
            type="email"
            label="Email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="self-stretch rounded-sm px-3 font-semibold text-grey-text-strong"
          />
          <BogTextInput
            name="password"
            type="password"
            label="Password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="self-stretch rounded-sm px-3 font-semibold text-grey-text-strong"
          />
          <BogButton
            className="text-desktop-paragraph-2 font-bold underline bg-transparent text-black"
            onClick={() => router.push("/forgotpassword")}
          >
            Forgot Password?
          </BogButton>
          <BogButton
            onClick={handleLogin}
            disabled={loading}
            className="flex h-[10%] items-center justify-center rounded-[4px] bg-grey-text-strong px-8 py-3 text-center text-desktop-paragraph-1 text-white"
          >
            Login
          </BogButton>
          <p className="text-desktop-paragraph-2">
            Don't have an account?{" "}
            <BogButton
              className="text-desktop-paragraph-1 font-bold underline bg-transparent text-black"
              onClick={() => router.push("/signup")}
            >
              Sign up
            </BogButton>
          </p>
        </div>
        <div className="flex h-full flex-1 flex-col items-center justify-between pt-[249px]" />
      </div>
    </div>
  );
}
