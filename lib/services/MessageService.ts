import db from "@/lib/db";
import { messageRecipients, messages } from "@/lib/schema";
import { EmailService } from "@/lib/services/EmailService";
import { MembersService } from "@/lib/services/MemberService";

export type MessageBody = Record<string, unknown>;

export type MessageCreateInput = {
  id: string;
  organizationId: string;
  senderId: string;
  subject: string;
  body?: MessageBody;
  textBody?: string;
  htmlBody?: string;
  recipientUserIds?: string[];
};

function buildBodyFromText(textBody?: string, htmlBody?: string): MessageBody {
  const content = [] as Array<{ type: string; value: string }>;

  if (textBody) {
    content.push({ type: "text/plain", value: textBody });
  }

  if (htmlBody) {
    content.push({ type: "text/html", value: htmlBody });
  }

  return content.length > 0 ? { content } : {};
}

async function createAndSend(input: MessageCreateInput) {
  const messageBody =
    input.body ?? buildBodyFromText(input.textBody, input.htmlBody);

  const [createdMessage] = await db
    .insert(messages)
    .values({
      id: input.id,
      organizationId: input.organizationId,
      senderId: input.senderId,
      subject: input.subject,
      body: messageBody,
    })
    .returning({
      id: messages.id,
      organizationId: messages.organizationId,
      senderId: messages.senderId,
      subject: messages.subject,
      body: messages.body,
      sentAt: messages.sentAt,
    });

  const hasExplicitRecipients =
    input.recipientUserIds && input.recipientUserIds.length > 0;

  const recipientUserIds = hasExplicitRecipients
    ? input.recipientUserIds!
    : await MembersService.getUserIdsByOrganization(input.organizationId);

  if (recipientUserIds.length > 0) {
    await db.insert(messageRecipients).values(
      recipientUserIds.map((userId) => ({
        messageId: input.id,
        userId,
      })),
    );
  }

  const textBody = input.textBody ?? input.htmlBody;
  const htmlBody = input.htmlBody;

  if (textBody && recipientUserIds.length > 0) {
    const content: Array<{ type: "text/plain" | "text/html"; value: string }> =
      [{ type: "text/plain", value: textBody }];

    if (htmlBody) {
      content.push({ type: "text/html", value: htmlBody });
    }

    await EmailService.emailMembers(input.organizationId, {
      subject: input.subject,
      content,
      ...(hasExplicitRecipients ? { targetUserIds: recipientUserIds } : {}),
    });
  }

  return createdMessage ?? null;
}

export const MessageService = {
  createAndSend,
};
