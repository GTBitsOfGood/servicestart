"use client";
import { useState } from "react";
import BogButton from "@/components/bog/BogButton/BogButton";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import EditProfileModal from "@/components/EditProfileModal";

type EditProfileButtonProps = {
  user: React.ComponentProps<typeof EditProfileModal>["user"];
};

export default function EditProfileButton({ user }: EditProfileButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <EditProfileModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        user={user}
      />

      <div className="flex items-center gap-8">
        <BogButton
          variant="primary"
          size="responsive"
          className="bg-[#FC5B43]"
          onClick={() => setModalOpen(true)}
        >
          Edit Details
        </BogButton>

        <button className="text-[#FC5B43] hover:opacity-70 transition-opacity">
          <BogIcon name="gear" size={24} />
        </button>
      </div>
    </>
  );
}
