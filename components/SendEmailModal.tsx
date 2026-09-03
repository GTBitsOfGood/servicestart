"use client";

import { useMemo, useState } from "react";
import Select, { type MultiValue } from "react-select";
import BogModal from "@/components/bog/BogModal/BogModal";
import BogTextInput from "@/components/bog/BogTextInput/BogTextInput";
import BogButton from "@/components/bog/BogButton/BogButton";
import BogIcon from "@/components/bog/BogIcon/BogIcon";

interface SendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipients?: Array<{ id: string; name: string }>;
  initialRecipientIds?: string[];
  onSend?: (values: {
    subject: string;
    subtitle?: string;
    body: string;
    footer?: string;
    recipientIds: string[];
  }) => void | Promise<void>;
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
  const [sendMessageToRecipient, setSendMessageToRecipient] = useState(false);
  const [recipientMenuOpen, setRecipientMenuOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

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
    setSendMessageToRecipient(false);
    setSendError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSend = async () => {
    setHasAttemptedSend(true);
    if (isInvalid || isSending) return;

    const trimmedSubtitle = subtitle.trim();
    const trimmedFooter = footer.trim();

    setIsSending(true);
    setSendError(null);
    try {
      await onSend?.({
        subject: subject.trim(),
        ...(trimmedSubtitle && { subtitle: trimmedSubtitle }),
        body: body.trim(),
        ...(trimmedFooter && { footer: trimmedFooter }),
        recipientIds: selectedRecipientIds,
      });
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : "Failed to send email",
      );
      return;
    } finally {
      setIsSending(false);
    }

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
      closeButton={<BogIcon name="x" size={25} />}
      contentProps={{
        className:
          "!w-[96vw] mobile:!w-[88vw] tablet:!w-[76vw] desktop:!w-[700px] !max-w-[700px] !p-3 mobile:!p-5 desktop:!p-7 !gap-3",
        style: { maxHeight: "92vh", overflowY: "auto" },
      }}
      title={
        <span className="text-heading-4 text-grey-text-strong">Send Email</span>
      }
      description={
        <div className="mt-2 flex flex-col gap-4 desktop:gap-5 text-grey-text-strong">
          <div className="flex items-center justify-start">
            <BogButton
              variant="secondary"
              size="medium"
              className="!rounded-md !px-4 !py-2 !mt-[-4px] !text-paragraph-2"
            >
              Use Presaved Template
            </BogButton>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-paragraph">Recipient</span>
              <button
                type="button"
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-grey-text-strong hover:bg-grey-fill-weak"
                aria-label="Add recipient"
                onClick={() => setRecipientMenuOpen((open) => !open)}
              >
                <BogIcon name="plus" size={16} />
              </button>
            </div>
            <Select
              isMulti
              options={recipientOptions}
              value={selectedOptions}
              placeholder="Select recipients"
              className="text-paragraph-2 text-grey-text-strong"
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
                  borderRadius: 4,
                  fontSize: "inherit",
                  lineHeight: "inherit",
                  backgroundColor: "var(--color-solid-bg-sunken)",
                  borderColor: state.isFocused
                    ? "var(--color-brand-stroke-strong)"
                    : "var(--color-grey-stroke-weak)",
                  boxShadow: "none",
                  padding: 0,
                  cursor: "text",
                  "&:hover": {
                    borderColor: state.isFocused
                      ? "var(--color-brand-stroke-strong)"
                      : "var(--color-grey-stroke-strong)",
                  },
                }),
                valueContainer: (base) => ({
                  ...base,
                  backgroundColor: "transparent",
                  padding: "8px 4px",
                  fontSize: "inherit",
                  lineHeight: "inherit",
                }),
                input: (base) => ({
                  ...base,
                  backgroundColor: "transparent",
                  margin: 0,
                  padding: 0,
                  fontSize: "inherit",
                  lineHeight: "inherit",
                }),
                placeholder: (base) => ({
                  ...base,
                  color: "var(--color-grey-text-weakest)",
                  margin: 0,
                  fontSize: "inherit",
                  lineHeight: "inherit",
                }),
                singleValue: (base) => ({
                  ...base,
                  margin: 0,
                  fontSize: "inherit",
                  lineHeight: "inherit",
                }),
                multiValue: (base) => ({
                  ...base,
                  borderRadius: 999,
                  paddingLeft: 8,
                  paddingRight: 4,
                  backgroundColor: "#fff",
                  border: "1px solid var(--color-grey-stroke-strong)",
                }),
                multiValueLabel: (base) => ({
                  ...base,
                  color: "var(--color-dark-500)",
                  fontSize: "inherit",
                  lineHeight: "inherit",
                }),
                multiValueRemove: (base) => ({
                  ...base,
                  borderRadius: 999,
                  cursor: "pointer",
                  backgroundColor: "transparent",
                  color: "var(--color-grey-icon-strong)",
                  ":hover": {
                    backgroundColor: "transparent",
                    color: "var(--color-status-red-text)",
                  },
                  ":active": {
                    backgroundColor: "transparent",
                    color: "var(--color-status-red-text)",
                  },
                }),
                option: (base) => ({
                  ...base,
                  cursor: "pointer",
                  fontSize: "inherit",
                  lineHeight: "inherit",
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
            placeholder="Message Headline"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            error={hasAttemptedSend && !subject.trim()}
          />
          <BogTextInput
            name="subtitle"
            label="Subtitle"
            placeholder="Message Subtitle (Optional)"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
          />
          <BogTextInput
            name="body"
            label="Text"
            required
            multiline
            placeholder="Message Text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            error={hasAttemptedSend && !body.trim()}
            className="[&_textarea]:!min-h-[160px] [&_textarea]:!resize-y"
          />
          <BogTextInput
            name="footer"
            label="Footer"
            placeholder="Footer (Optional)"
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
          />
          {sendError && (
            <p role="alert" className="text-paragraph-2 text-status-red-text">
              {sendError}
            </p>
          )}
          <div className="mt-1 flex flex-col gap-3 mobile:flex-row mobile:items-center mobile:justify-end">
            <label className="flex items-center gap-2 text-paragraph-2 text-grey-text-strong">
              <input
                type="checkbox"
                checked={sendMessageToRecipient}
                onChange={(event) =>
                  setSendMessageToRecipient(event.target.checked)
                }
                className="h-4 w-4 accent-brand-text"
              />
              Send message to recipient
            </label>
            <BogButton
              variant="primary"
              size="medium"
              onClick={handleSend}
              disabled={isInvalid || isSending}
              className="!rounded-md !px-4 !py-2"
            >
              {isSending ? "Sending..." : "Send Email"}
            </BogButton>
          </div>
        </div>
      }
      primaryLabel="Send Email"
      secondaryLabel=""
      onPrimary={handleSend}
      onSecondary={handleClose}
      primaryDisabled={isInvalid || isSending}
      buttonsContainerClassName="!hidden"
      secondaryButtonClassName="!hidden"
      primaryButtonClassName="!hidden"
    />
  );
}
