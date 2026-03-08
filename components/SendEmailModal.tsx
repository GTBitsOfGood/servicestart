"use client";

import { useMemo, useState } from "react";
import Select, { type MultiValue } from "react-select";
import BogModal from "@/components/bog/BogModal/BogModal";
import BogTextInput from "@/components/bog/BogTextInput/BogTextInput";
import BogButton from "@/components/bog/BogButton/BogButton";

interface SendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipients?: Array<{ id: string; name: string }>;
  initialRecipientIds?: string[];
  onSend?: (values: {
    subject: string;
    body: string;
    recipientIds: string[];
  }) => void;
}

export default function SendEmailModal({
  isOpen,
  onClose,
  recipients = [],
  initialRecipientIds,
  onSend,
}: SendEmailModalProps) {
  const [subject, setSubject] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [hasAttemptedSend, setHasAttemptedSend] = useState(false);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>(
    initialRecipientIds ?? [],
  );
  const [recipientMenuOpen, setRecipientMenuOpen] = useState(false);

  const isInvalid = !subject.trim() || !body.trim();

  const recipientOptions = useMemo(
    () =>
      recipients.map((recipient) => ({
        value: recipient.id,
        label: recipient.name,
      })),
    [recipients],
  );

  const selectedOptions = useMemo(
    () =>
      recipientOptions.filter((option) =>
        selectedRecipientIds.includes(option.value),
      ),
    [recipientOptions, selectedRecipientIds],
  );

  const resetForm = () => {
    setSubject("");
    setSubtitle("");
    setBody("");
    setFooter("");
    setHasAttemptedSend(false);
    setSelectedRecipientIds(initialRecipientIds ?? []);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSend = () => {
    setHasAttemptedSend(true);
    if (isInvalid) return;
    onSend?.({
      subject: subject.trim(),
      body: body.trim(),
      recipientIds: selectedRecipientIds,
    });
    handleClose();
  };

  return (
    <BogModal
      openState={{
        open: isOpen,
        setOpen: (open) => {
          if (!open) handleClose();
        },
      }}
      trigger={<span />}
      title={<h3>Send Email</h3>}
      description={
        <div className="flex flex-col gap-6 mt-6">
          <div className="flex items-center justify-between">
            <BogButton variant="secondary" size="medium">
              Use Presaved Template
            </BogButton>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-paragraph-2">Recipient</span>
              <button
                type="button"
                className="h-5 w-5 flex items-center justify-center text-black cursor-pointer"
                aria-label="Add recipient"
                onClick={() => setRecipientMenuOpen((open) => !open)}
              >
                +
              </button>
            </div>
            <Select
              isMulti
              options={recipientOptions}
              value={selectedOptions}
              placeholder="Select recipients"
              classNamePrefix="bog-select"
              menuIsOpen={recipientMenuOpen}
              onMenuOpen={() => setRecipientMenuOpen(true)}
              onMenuClose={() => setRecipientMenuOpen(false)}
              onChange={(value: MultiValue<{ value: string; label: string }>) =>
                setSelectedRecipientIds(value.map((option) => option.value))
              }
              components={{
                DropdownIndicator: () => null,
                IndicatorSeparator: () => null,
                ClearIndicator: () => null,
              }}
              styles={{
                control: (base, state) => ({
                  ...base,
                  minHeight: 44,
                  borderRadius: 8,
                  paddingTop: 4,
                  paddingBottom: 4,
                  backgroundColor: recipientMenuOpen
                    ? "var(--color-solid-bg-sunken)"
                    : "transparent",
                  borderColor: recipientMenuOpen
                    ? state.isFocused
                      ? "var(--color-brand-stroke-strong)"
                      : "var(--color-grey-stroke-weak)"
                    : "transparent",
                  boxShadow: "none",
                  paddingLeft: recipientMenuOpen ? 4 : 0,
                  cursor: "text",
                  "&:hover": {
                    borderColor: recipientMenuOpen
                      ? state.isFocused
                        ? "var(--color-brand-stroke-strong)"
                        : "var(--color-grey-stroke-strong)"
                      : "transparent",
                  },
                }),
                valueContainer: (base) => ({
                  ...base,
                  backgroundColor: "transparent",
                  paddingLeft: recipientMenuOpen ? base.paddingLeft : 0,
                }),
                input: (base) => ({
                  ...base,
                  backgroundColor: "transparent",
                }),
                placeholder: (base) => ({
                  ...base,
                  color: "var(--color-grey-text-weak)",
                }),
                multiValue: (base) => ({
                  ...base,
                  borderRadius: 12,
                  paddingLeft: 6,
                  paddingRight: 2,
                  backgroundColor: "#fff",
                  border: "1px solid #666",
                }),
                multiValueLabel: (base) => ({
                  ...base,
                  color: "var(--color-dark-500)",
                }),
                multiValueRemove: (base) => ({
                  ...base,
                  borderRadius: 999,
                  cursor: "pointer",
                }),
                option: (base) => ({
                  ...base,
                  cursor: "pointer",
                }),
                clearIndicator: (base) => ({
                  ...base,
                  cursor: "pointer",
                }),
                menu: (base) => ({
                  ...base,
                  zIndex: 30,
                }),
              }}
            />
          </div>
          <BogTextInput
            name="subject"
            label="Headline"
            required
            placeholder="Subject Line"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            error={hasAttemptedSend && !subject.trim()}
          />
          <BogTextInput
            name="subtitle"
            label="Subtitle"
            placeholder="Email Subtitle (Optional)"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
          />
          <BogTextInput
            name="body"
            label="Text"
            required
            multiline
            placeholder="Email Content"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            error={hasAttemptedSend && !body.trim()}
          />
          <BogTextInput
            name="footer"
            label="Footer"
            placeholder="Footer (Optional)"
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
          />
        </div>
      }
      primaryLabel="Send Email"
      secondaryLabel="Cancel"
      onPrimary={handleSend}
      onSecondary={handleClose}
      primaryDisabled={isInvalid}
    />
  );
}
