"use client";

import { useEffect, useMemo, useState } from "react";
import BogModal from "@/components/bog/BogModal/BogModal";
import BogTextInput from "@/components/bog/BogTextInput/BogTextInput";
import BogButton from "@/components/bog/BogButton/BogButton";
import BogCheckbox from "@/components/bog/BogCheckbox/BogCheckbox";

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
  const [recipientMenuOpen, setRecipientMenuOpen] = useState(false);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>(
    initialRecipientIds ?? [],
  );

  useEffect(() => {
    if (!isOpen) return;
    setSelectedRecipientIds(initialRecipientIds ?? []);
  }, [initialRecipientIds, isOpen]);

  const isInvalid = !subject.trim() || !body.trim();

  const selectedRecipients = useMemo(
    () => recipients.filter((r) => selectedRecipientIds.includes(r.id)),
    [recipients, selectedRecipientIds],
  );

  const resetForm = () => {
    setSubject("");
    setSubtitle("");
    setBody("");
    setFooter("");
    setHasAttemptedSend(false);
    setRecipientMenuOpen(false);
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

  const toggleRecipient = (recipientId: string, checked: boolean) => {
    setSelectedRecipientIds((prev) => {
      if (checked) {
        return prev.includes(recipientId) ? prev : [...prev, recipientId];
      }
      return prev.filter((id) => id !== recipientId);
    });
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
            <span className="text-paragraph-2">Recipient</span>
            <div className="flex items-center gap-2 justify-between flex-wrap">
              {selectedRecipients.length === 0 ? (
                <span className="text-paragraph-2 text-black/50">
                  No recipients selected
                </span>
              ) : (
                selectedRecipients.map((recipient) => (
                  <span
                    key={recipient.id}
                    className="px-5 py-1 rounded-2xl border text-paragraph-2 flex items-center gap-2"
                  >
                    {recipient.name}
                    <button
                      type="button"
                      className="text-black/60"
                      aria-label={`Remove ${recipient.name}`}
                      onClick={() => toggleRecipient(recipient.id, false)}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
              <button
                type="button"
                className="h-10 w-10 rounded-full flex items-center justify-center"
                aria-label="Add recipient"
                onClick={() => setRecipientMenuOpen((open) => !open)}
              >
                +
              </button>
            </div>
            {recipientMenuOpen && (
              <div className="relative h-0">
                <div className="absolute z-10 mt-2 w-full max-w-sm rounded-lg border bg-white p-3 shadow-md">
                  <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                    {recipients.map((recipient) => (
                      <BogCheckbox
                        key={recipient.id}
                        name={`recipient-${recipient.id}`}
                        label={recipient.name}
                        checked={selectedRecipientIds.includes(recipient.id)}
                        onCheckedChange={(checked) =>
                          toggleRecipient(recipient.id, checked === true)
                        }
                      />
                    ))}
                    {recipients.length === 0 && (
                      <span className="text-paragraph-2 text-black/50">
                        No recipients available
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
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
