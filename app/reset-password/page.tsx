"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useOrganizationConfig from "@/lib/hooks/useOrganizationConfig";
import BogTextInput from "@/components/bog/BogTextInput/BogTextInput";
import BogButton from "@/components/bog/BogButton/BogButton";
import { OrganizationConfigKey } from "@/lib/schema";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";
import authClient from "@/lib/authClient";
import XIcon from "@/components/XIcon";
import LeftArrowIcon from "@/components/LeftArrowIcon";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [passwordsMatch, setPasswordsMatch] = useState(true);

  const { primary_color = "#FFFFFF", secondary_color = "#FFFFFF" } =
    useOrganizationConfig([
      OrganizationConfigKey.PrimaryColor,
      OrganizationConfigKey.SecondaryColor,
    ]);
  const org = useActiveOrganization();
  const logo = org?.organization.data?.logo;

  const handleResetPassword = async () => {
    const token = new URLSearchParams(window.location.search).get("token");

    if (!token) {
      setIsExpired(true);
      return;
    }

    if (password !== passwordConfirm) {
      setPasswordsMatch(false);
      return;
    }

    setPasswordsMatch(true);

    if (password.length < 8) {
      alert("Password should be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token: token,
      });

      if (error) {
        alert(error.message || "Failed to reset password");
        return;
      }

      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");

    if (!token) {
      setIsExpired(true);
    }
  }, []);

  useEffect(() => {
    if (passwordConfirm.length !== 0) {
      setPasswordsMatch(password === passwordConfirm);
    }
  }, [password, passwordConfirm]);

  return (
    <div
      className="flex h-screen w-screen items-center"
      data-testid="page"
      style={{
        background: `linear-gradient(75deg, ${primary_color} 0%, ${secondary_color} 100%)`,
      }}
    >
      <div className="flex h-full w-1/2 flex-shrink-0 items-center justify-between px-8">
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
      {isExpired ? (
        <div className="flex h-full flex-1 flex-col items-center justify-between pt-[16%]">
          <div className="flex w-[80%] bg-white flex-col p-12 justify-center items-center gap-5 border-[2px] rounded-4xl shadow-[0_4px_7px_0_rgba(0,0,0,0.4)]">
            <div className="flex flex-col items-center gap-5 self-stretch">
              <div className="flex flex-col items-center gap-14 self-stretch">
                <div className="flex flex-col items-flex-start gap-12 self-stretch">
                  <div className="flex gap-2">
                    <XIcon />
                    <h1>Link Expired</h1>
                  </div>
                  <div>
                    <p className="text-grey-text-weak">
                      To reset your password, return to the login page and
                      select "forgot password" to send a new email.
                    </p>
                  </div>
                </div>
                <BogButton
                  className="bg-black w-1/3"
                  onClick={() => router.push("/login")}
                >
                  Back to log in
                </BogButton>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col w-full h-full justify-center items-center">
          {loading ? (
            <div className="flex w-full h-full flex-col items-center justify-between pt-[16%]">
              <div className="flex bg-white w-[80%] h-[600px] flex-col items-flex-start justify-center gap-3 shrink-0 border-[2px] rounded-4xl shadow-[0_4px_7px_0_rgba(0,0,0,0.4)]">
                <div className="flex flex-col p-12 items-center gap-2">
                  <h4 className="text-grey-text-weak">Logging in...</h4>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-1 flex-col items-center justify-between pt-[25%]">
              <div className="flex bg-white flex-col p-12 justify-center items-center gap-5 border-[2px] rounded-4xl shadow-[0_4px_7px_0_rgba(0,0,0,0.4)]">
                <div className="flex flex-col items-center gap-5 self-stretch">
                  <div className="flex flex-col items-center gap-14 self-stretch">
                    <div className="flex flex-col items-center gap-12 self-stretch">
                      <div className="flex flex-col items-flex-start gap-4 self-stretch">
                        <h1>Reset Password</h1>
                        <p className="text-grey-text-weak">
                          The password should be different from the previous
                          password.
                        </p>
                      </div>
                      <BogTextInput
                        name="password"
                        label="Password"
                        placeholder="Enter a new password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="flex flex-col self-stretch"
                      />
                      <div className="flex flex-col items-flex-start gap-4 self-stretch">
                        <BogTextInput
                          name="passwordConfirm"
                          label="Confirm Password"
                          placeholder="Re-enter your password"
                          type="password"
                          value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value)}
                          className="flex flex-col self-stretch"
                          error={!passwordsMatch}
                        />
                        {!passwordsMatch && (
                          <p className="text-red-500">Passwords do not match</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-6">
                      <BogButton
                        onClick={handleResetPassword}
                        className="p-5 bg-black"
                      >
                        Reset Password
                      </BogButton>
                      <BogButton
                        className="text-grey-text-weak bg-transparent"
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
          )}
        </div>
      )}
    </div>
  );
}
