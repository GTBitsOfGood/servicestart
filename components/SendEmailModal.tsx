"use client";

import { useMemo, useState } from "react";
import Select, { type MultiValue } from "react-select";
import BogModal from "@/components/bog/BogModal/BogModal";
import BogTextInput from "@/components/bog/BogTextInput/BogTextInput";
import BogButton from "@/components/bog/BogButton/BogButton";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import BogBanner from "@/components/bog/BogBanner/BogBanner";
import type { SendEmailValues } from "@/lib/organizationEmail";

interface SendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipients: Array<{ id: string; name: string }>;
  initialRecipientIds?: string[];
  recipientsLoading: boolean;
  recipientsError: string | null;
  onRetryRecipients: () => void;
  onSend: (values: SendEmailValues) => void | Promise<void>;
}

export default function SendEmailModal({
  isOpen,
  onClose,
  recipients,
  initialRecipientIds,
  recipientsLoading,
  recipientsError,
  onRetryRecipients,
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
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recipientsUnavailable = recipientsLoading || !!recipientsError;

  const missingSubject = !subject.trim();
  const missingBody = !body.trim();
  const missingRecipients = selectedRecipientIds.length === 0;
  const isInvalid = missingSubject || missingBody || missingRecipients;

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
    setRecipientMenuOpen(false);
    setError(null);
  };

  const handleClose = () => {
    if (isSending) return;
    resetForm();
    onClose();
  };

  const handleSend = async () => {
    if (isSending || recipientsUnavailable) return;
    setHasAttemptedSend(true);
    if (isInvalid) return;

    setError(null);
    setIsSending(true);
    try {
      await onSend({
        subject: subject.trim(),
        subtitle: subtitle.trim(),
        body: body.trim(),
        footer: footer.trim(),
        recipientIds: selectedRecipientIds,
      });
      resetForm();
      onClose();
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Failed to send email",
      );
    } finally {
      setIsSending(false);
    }
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
        onEscapeKeyDown: (event) => {
          if (isSending) event.preventDefault();
        },
      }}
      title={
        <span className="text-heading-4 text-grey-text-strong">Send Email</span>
      }
      description={
        <div className="mt-2 flex flex-col gap-4 desktop:gap-5 text-grey-text-strong">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-paragraph">Recipient</span>
              <button
                type="button"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded text-grey-text-strong hover:bg-grey-fill-weak"
                aria-label="Add recipient"
                disabled={isSending || recipientsUnavailable}
                onClick={() => setRecipientMenuOpen((open) => !open)}
              >
                <BogIcon name="plus" size={16} />
              </button>
            </div>
            <Select
              isMulti
              isDisabled={isSending || recipientsUnavailable}
              isLoading={recipientsLoading}
              options={recipientOptions}
              value={selectedOptions}
              placeholder="Select recipients"
              aria-label="Recipients"
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
            {recipientsLoading && (
              <p className="text-paragraph-2 text-grey-text-weak" role="status">
                Loading recipients...
              </p>
            )}
            {recipientsError && (
              <BogBanner
                type="error"
                variant="surface"
                content={
                  <span className="flex items-center gap-3">
                    <span>{recipientsError}</span>
                    <BogButton
                      variant="secondary"
                      size="small"
                      onClick={onRetryRecipients}
                      disabled={isSending}
                    >
                      Retry
                    </BogButton>
                  </span>
                }
              />
            )}
            {hasAttemptedSend && missingRecipients && (
              <p className="text-paragraph-2 text-status-red-text" role="alert">
                Select at least one recipient.
              </p>
            )}
          </div>
          <BogTextInput
            name="subject"
            label="Headline"
            required
            placeholder="Message Headline"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            error={hasAttemptedSend && missingSubject}
            disabled={isSending}
          />
          <BogTextInput
            name="subtitle"
            label="Subtitle"
            placeholder="Message Subtitle (Optional)"
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
            disabled={isSending}
          />
          <BogTextInput
            name="body"
            label="Text"
            required
            multiline
            placeholder="Message Text"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            error={hasAttemptedSend && missingBody}
            disabled={isSending}
            className="[&_textarea]:min-h-40! [&_textarea]:resize-y!"
          />
          <BogTextInput
            name="footer"
            label="Footer"
            placeholder="Footer (Optional)"
            value={footer}
            onChange={(event) => setFooter(event.target.value)}
            disabled={isSending}
          />
          {error && (
            <BogBanner
              type="error"
              variant="surface"
              content={<span>{error}</span>}
            />
          )}
          <div className="mt-1 flex justify-end">
            <BogButton
              variant="primary"
              size="medium"
              onClick={() => {
                void handleSend();
              }}
              disabled={isSending || recipientsUnavailable}
              className="rounded-md! px-4! py-2!"
            >
              {isSending ? "Sending..." : "Send Email"}
            </BogButton>
          </div>
        </div>
      }
      primaryLabel="Send Email"
      secondaryLabel=""
      onPrimary={() => {
        void handleSend();
      }}
      onSecondary={handleClose}
      primaryDisabled={isSending || recipientsUnavailable}
      buttonsContainerClassName="!hidden"
      secondaryButtonClassName="!hidden"
      primaryButtonClassName="!hidden"
    />
  );
}
