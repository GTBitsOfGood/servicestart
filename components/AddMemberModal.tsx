"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { RadioGroup } from "radix-ui";
import authClient from "@/lib/authClient";
import BogTextInput from "@/components/bog/BogTextInput/BogTextInput";
import BogModal from "@/components/bog/BogModal/BogModal";
import BogBanner from "@/components/bog/BogBanner/BogBanner";
import BogButton from "@/components/bog/BogButton/BogButton";
import BogRadioGroup from "@/components/bog/BogRadioGroup/BogRadioGroup";
// BogRadioItem's label isn't tied to its radio, so the radios here reuse its
// styles with a real <label htmlFor>.
import radioStyles from "@/components/bog/BogRadioItem/styles.module.css";

type InviteRole = "member" | "admin";

const ROLE_OPTIONS: { value: InviteRole; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
];

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  onAddDirectly?: (
    organizationId: string,
    email: string,
    name: string,
  ) => Promise<{ error?: string; success?: boolean }>;
}

export default function AddMemberModal({
  isOpen,
  onClose,
  organizationId,
  onAddDirectly,
}: AddMemberModalProps) {
  const router = useRouter();
  const radioId = useId();
  const [name, setName] = useState("");
  const [role, setRole] = useState<InviteRole>("member");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDirect, setLoadingDirect] = useState(false);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isInvalid =
    !name.trim() ||
    !email.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const reset = () => {
    setName("");
    setEmail("");
    setRole("member");
    setHasAttemptedSave(false);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const invite = async () => {
    setHasAttemptedSave(true);
    if (isInvalid) return;

    setLoading(true);
    setError(null);
    try {
      // A resend keeps a pending invite's old role, so cancel one with a
      // different role first. Its email link stops working.
      const { data: invitations, error: listError } =
        await authClient.organization.listInvitations({
          query: { organizationId },
        });
      if (listError) {
        setError(listError.message ?? "Something went wrong.");
        return;
      }
      const normalizedEmail = email.trim().toLowerCase();
      const stale = invitations?.find(
        (inv) =>
          inv.status === "pending" &&
          inv.email.toLowerCase() === normalizedEmail &&
          inv.role !== role,
      );
      if (stale) {
        const { error } = await authClient.organization.cancelInvitation({
          invitationId: stale.id,
        });
        if (error) {
          setError(error.message ?? "Something went wrong.");
          return;
        }
      }

      const { error } = await authClient.organization.inviteMember({
        email,
        name,
        role,
        organizationId,
        resend: true,
      });

      if (error) {
        setError(error.message ?? "Something went wrong.");
        return;
      }

      handleClose();
    } catch (err) {
      console.error("Failed to send invite:", err);
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddDirectly = async () => {
    setHasAttemptedSave(true);
    if (isInvalid) return;

    setLoadingDirect(true);
    setError(null);
    try {
      if (!onAddDirectly) {
        setError("Direct add is not supported here.");
        setLoadingDirect(false);
        return;
      }

      const res = await onAddDirectly(organizationId, email, name);

      if (res?.error) {
        setError(res.error);
        return;
      }

      router.refresh();
      handleClose();
    } catch (err) {
      console.error("Failed to send invite:", err);
      setError("Something went wrong.");
    } finally {
      setLoadingDirect(false);
    }
  };

  return (
    <BogModal
      openState={{
        open: isOpen,
        setOpen: (v) => {
          if (!v) handleClose();
        },
      }}
      trigger={<span />}
      title={<h3>Add Member</h3>}
      description={
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-6 mt-6">
            <BogTextInput
              name="name"
              label="Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={hasAttemptedSave && !name.trim()}
            />
            <BogTextInput
              name="email"
              label="Email"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={hasAttemptedSave && !email.trim()}
            />
            <div className="flex flex-col gap-2">
              <span
                id={`${radioId}-label`}
                className="font-paragraph text-paragraph-2 text-grey-text-strong"
              >
                Role
              </span>
              <BogRadioGroup
                aria-labelledby={`${radioId}-label`}
                value={role}
                onValueChange={(value) => setRole(value as InviteRole)}
                className="flex-row! gap-6!"
              >
                {ROLE_OPTIONS.map((option) => (
                  <div key={option.value} className={radioStyles.container}>
                    <RadioGroup.Item
                      id={`${radioId}-${option.value}`}
                      value={option.value}
                      className={radioStyles.radio}
                    >
                      <RadioGroup.Indicator className={radioStyles.indicator} />
                    </RadioGroup.Item>
                    <label
                      htmlFor={`${radioId}-${option.value}`}
                      className={`${radioStyles.label} cursor-pointer`}
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </BogRadioGroup>
            </div>
          </div>

          {hasAttemptedSave && isInvalid && (
            <BogBanner
              type="error"
              variant="surface"
              content={<span>Please fill out all required fields.</span>}
            />
          )}
          {error && (
            <BogBanner
              type="error"
              variant="surface"
              content={<span>{error}</span>}
            />
          )}

          {/* BogModal can't disable its secondary button, so render both. */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-4">
              <BogButton
                variant="secondary"
                size="medium"
                onClick={handleAddDirectly}
                disabled={role === "admin" || loading || loadingDirect}
                aria-describedby={
                  role === "admin" ? `${radioId}-add-help` : undefined
                }
              >
                Add
              </BogButton>
              <BogButton
                variant="primary"
                size="medium"
                onClick={invite}
                disabled={loading || loadingDirect}
              >
                Add & Send Invite Email
              </BogButton>
            </div>
            {role === "admin" && (
              <p
                id={`${radioId}-add-help`}
                className="text-paragraph-2 text-grey-text-weak"
              >
                Admins can only be added by invite.
              </p>
            )}
          </div>
        </div>
      }
      buttonsContainerClassName="hidden"
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      contentProps={{ className: "w-full max-w-[500px]" }}
    />
  );
}
