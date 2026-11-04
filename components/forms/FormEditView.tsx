import FormFillClient from "@/components/forms/FormFillClient";
import FormMessage from "@/components/forms/FormMessage";
import LocalDateTime from "@/components/forms/LocalDateTime";
import type { FormAnswerValue, FormDefinition } from "@/lib/forms/schema";
import { canEditSubmission, getFormAvailability } from "@/lib/forms/submission";
import type { SubmissionReviewStatus } from "@/lib/schema";

type FormEditViewProps = {
  definition: Pick<
    FormDefinition,
    "formId" | "components" | "status" | "settings"
  >;
  answers: Record<string, FormAnswerValue>;
  reviewStatus: SubmissionReviewStatus;
};

/** The edit form for a response, or why it can't be edited right now. */
export default function FormEditView({
  definition,
  answers,
  reviewStatus,
}: FormEditViewProps) {
  const availability = getFormAvailability(definition);
  if (availability === "not_yet_open" && definition.settings.opensAt) {
    return (
      <FormMessage title="This form isn't open yet">
        It opens <LocalDateTime iso={definition.settings.opensAt} />.
      </FormMessage>
    );
  }
  if (availability !== "open") {
    return (
      <FormMessage title="This form is closed">
        It's no longer accepting changes to responses.
      </FormMessage>
    );
  }
  if (!canEditSubmission({ availability, reviewStatus })) {
    return (
      <FormMessage title="This response can't be edited">
        It has already been reviewed.
      </FormMessage>
    );
  }
  return (
    <FormFillClient
      mode="edit"
      definition={{
        formId: definition.formId,
        components: definition.components,
      }}
      initialValues={answers}
      uploadsPath={`/api/forms/${encodeURIComponent(definition.formId)}/my-uploads`}
    />
  );
}
