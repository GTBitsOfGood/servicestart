import api from "@/lib/api";

export type SendEmailValues = {
  subject: string;
  body: string;
  subtitle: string;
  footer: string;
  recipientIds: string[];
};

const MEMBER_LIST_PAGE_SIZE = 100;

export const EMAIL_SENT_MESSAGE = "Email sent.";

export async function fetchAllMemberRecipients(): Promise<
  Array<{ id: string; name: string }>
> {
  const recipients: Array<{ id: string; name: string }> = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (recipients.length < total) {
    const response = await api.members.$get({
      query: { page: String(page), pageSize: String(MEMBER_LIST_PAGE_SIZE) },
    });
    if (!response.ok) {
      throw new Error("Failed to fetch members");
    }
    const body = await response.json();
    if (!("data" in body)) {
      throw new Error("Failed to fetch members");
    }
    total = body.total;
    recipients.push(
      ...body.data.map((member) => ({ id: member.userId, name: member.name })),
    );
    if (body.data.length === 0) break;
    page += 1;
  }

  return recipients;
}

export async function postOrganizationEmail(values: SendEmailValues) {
  const response = await api.emails.$post({
    json: {
      subject: values.subject,
      body: values.body,
      subtitle: values.subtitle,
      footer: values.footer,
      recipientIds: values.recipientIds,
    },
  });

  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    if (
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
    ) {
      throw new Error(data.error);
    }
    throw new Error("Failed to send email");
  }
}
