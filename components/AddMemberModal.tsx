"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import authClient from "@/lib/authClient";
import BogTextInput from "@/components/bog/BogTextInput/BogTextInput";
import BogModal from "@/components/bog/BogModal/BogModal";
import BogBanner from "@/components/bog/BogBanner/BogBanner";

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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDirect, setLoadingDirect] = useState(false);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isInvalid = !name.trim() || !email.trim();

  const reset = () => {
    setName("");
    setEmail("");
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
      const { error } = await authClient.organization.inviteMember({
        email,
        name,
        role: "member",
        organizationId,
        resend: true,
      });

      if (error) {
        setError(error.message ?? "Something went wrong.");
        return;
      }

      handleClose();
    } catch (err) {
      console.error(err);
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
      console.error(err);
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
        </div>
      }
      primaryLabel="Add & Send Invite Email"
      primaryDisabled={loading || loadingDirect}
      onPrimary={invite}
      secondaryLabel="Add"
      onSecondary={handleAddDirectly}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      contentProps={{ className: "w-full max-w-[500px]" }}
    />
  );
}
