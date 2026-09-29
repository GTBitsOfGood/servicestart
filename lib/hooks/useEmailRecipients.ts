"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAllMemberRecipients } from "@/lib/organizationEmail";

type RecipientRequest = {
  organizationId: string | undefined;
  enabled: boolean;
  attempt: number;
};

type RecipientState = {
  request: RecipientRequest;
  recipients: Array<{ id: string; name: string }>;
  error: string | null;
};

export function useEmailRecipients(
  organizationId: string | undefined,
  enabled: boolean,
) {
  const [result, setResult] = useState<RecipientState | null>(null);
  const [attempt, setAttempt] = useState(0);

  const request = useMemo(
    () => ({ organizationId, enabled, attempt }),
    [organizationId, enabled, attempt],
  );

  useEffect(() => {
    if (!request.enabled || !request.organizationId) return;

    let cancelled = false;
    fetchAllMemberRecipients()
      .then((recipients) => {
        if (!cancelled) setResult({ request, recipients, error: null });
      })
      .catch(() => {
        if (!cancelled) {
          setResult({
            request,
            recipients: [],
            error: "Unable to load recipients. Please try again.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [request]);

  const currentResult = enabled && result?.request === request ? result : null;

  return {
    recipients: currentResult?.recipients ?? [],
    recipientsLoading: enabled && !currentResult,
    recipientsError: currentResult?.error ?? null,
    retryRecipients: () => {
      setAttempt((previous) => previous + 1);
    },
  };
}
