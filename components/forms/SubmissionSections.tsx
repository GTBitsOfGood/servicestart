import FormResponseView from "@/components/forms/FormResponseView";
import { splitSections } from "@/lib/forms/review";
import type { FormAnswerValue, FormDefinition } from "@/lib/forms/schema";
import { FormComponentType } from "@/lib/schema";

/**
 * A submission's answers with one read-only response per section, laid out
 * side by side where there's room.
 */
export default function SubmissionSections({
  definition,
  answers,
  uploadsPath,
}: {
  definition: Pick<FormDefinition, "formId" | "components">;
  answers: Record<string, FormAnswerValue>;
  uploadsPath: string;
}) {
  const sections = splitSections(definition.components);
  return (
    <div className="grid grid-cols-1 items-start gap-6 tablet:grid-cols-2">
      {sections.map((components) => {
        const [first] = components;
        return (
          <section
            key={first.id}
            aria-label={
              first.type === FormComponentType.SectionHeader
                ? first.label
                : "Responses"
            }
            className="rounded-lg border border-grey-stroke-weak bg-solid-bg-base p-6"
          >
            <FormResponseView
              definition={{ formId: definition.formId, components }}
              answers={answers}
              uploadsPath={uploadsPath}
            />
          </section>
        );
      })}
    </div>
  );
}
