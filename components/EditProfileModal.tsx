"use client";

import { useState, useRef } from "react";
import authClient from "@/lib/authClient";
import { useRouter } from "next/navigation";
import BogTextInput from "@/components/bog/BogTextInput/BogTextInput";
import BogButton from "@/components/bog/BogButton/BogButton";
import BogModal from "@/components/bog/BogModal/BogModal";
import BogBanner from "@/components/bog/BogBanner/BogBanner";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    name: string;
    email: string;
    image?: string | null;
    phoneNumber?: string | null;
    displayName?: string | null;
    pronouns?: string | null;
    location?: string | null;
  };
}

export default function EditProfileModal({
  isOpen,
  onClose,
  user,
}: EditProfileModalProps) {
  const router = useRouter();

  const [fullName, setFullName] = useState(user.name ?? "");
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [phone, setPhone] = useState(user.phoneNumber ?? "");
  const [pronouns, setPronouns] = useState(user.pronouns ?? "");
  const [location, setLocation] = useState(user.location ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [imagePreview, setImagePreview] = useState<string | null>(
    user.image ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isInvalid =
    !fullName.trim() || !phone.trim() || !email.trim() || !location.trim();

  const resetToUserValues = () => {
    setFullName(user.name ?? "");
    setDisplayName(user.displayName ?? "");
    setPhone(user.phoneNumber ?? "");
    setPronouns(user.pronouns ?? "");
    setLocation(user.location ?? "");
    setEmail(user.email ?? "");
    setImagePreview(user.image ?? null);
    setHasAttemptedSave(false);
  };

  const handleClose = () => {
    resetToUserValues();
    onClose();
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    setHasAttemptedSave(true);
    if (isInvalid) return;

    setLoading(true);
    try {
      await authClient.updateUser({
        name: fullName,
        displayName: displayName || null,
        pronouns: pronouns || null,
        phoneNumber: phone || null,
        location: location || null,
        // image upload tbd
      });

      if (email !== user.email) {
        await authClient.changeEmail({
          // Sends a verification email before this is done
          newEmail: email,
          callbackURL: "/profile?saved=true",
        });
        handleClose();
        router.refresh();
        return;
      }

      handleClose();
      router.push("/profile?saved=true");
      router.refresh();
    } catch (err) {
      console.error(err);
      handleClose();
      router.push("/profile?saved=error");
    } finally {
      setLoading(false);
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
      title={<h3>Edit details</h3>}
      description={
        <div className="flex flex-col gap-4">
          <div className="flex gap-16 mt-6">
            <div className="flex-[2] flex flex-col gap-6">
              <BogTextInput
                name="fullName"
                label="Full name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                error={hasAttemptedSave && !fullName.trim()}
              />

              <div className="flex flex-col gap-1">
                <BogTextInput
                  name="displayName"
                  label="Display name"
                  placeholder="Your full name will display if this is left blank."
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <p className="text-paragraph-2 text-black/50 mt-5">
                  This could be your first name, or a nickname — however you'd
                  like people to refer to you on this platform.
                </p>
              </div>

              <BogTextInput
                name="location"
                label="Location"
                required
                placeholder="Search..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                error={hasAttemptedSave && !location.trim()}
                iconProps={{
                  iconProps: { name: "search", size: 16 },
                  position: "left",
                }}
              />

              <BogTextInput
                name="phone"
                label="Phone"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                error={hasAttemptedSave && !phone.trim()}
              />

              <BogTextInput
                name="pronouns"
                label="Pronouns"
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value)}
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

            <div className="flex-[1] flex flex-col items-start gap-5">
              <span className="text-paragraph-2">Profile photo</span>

              <div className="w-full aspect-square rounded-lg bg-[#D9D9D9] flex items-center justify-center overflow-hidden">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Profile preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[#aaaaaa] text-[64px] font-light">
                    {fullName?.charAt(0).toUpperCase() ?? "?"}
                  </span>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />

              <BogButton
                variant="primary"
                size="medium"
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#FC5B43] w-full"
              >
                Upload photo
              </BogButton>

              <button
                onClick={handleRemovePhoto}
                className="text-[#FC5B43] font-medium w-full text-center hover:underline text-paragraph-2"
              >
                Remove photo
              </button>
            </div>
          </div>

          {hasAttemptedSave && isInvalid && (
            <BogBanner
              type="error"
              variant="surface"
              content={<span>Please fill out all required fields.</span>}
            />
          )}
        </div>
      }
      primaryLabel="Save"
      secondaryLabel="Discard"
      onPrimary={handleSave}
      onSecondary={handleClose}
      primaryDisabled={loading}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      contentProps={{ className: "min-w-[900px]" }}
    />
  );
}
