// types/email.ts

export interface IncomingAttachment {
  filename: string;
  contentType: string;
  url: string; // URL to access the attachment
}

export interface OutgoingAttachment {
  filename: string;
  contentType: string;
  content: Buffer; // Attachment content as Buffer
}

export interface Email {
  organizationId(arg0: string, organizationId: any): unknown;
  id: string; // Unique identifier for the email
  from: string; // Sender's email address
  to: string[]; // Array of receiver email addresses
  subject: string;
  date: string; // ISO string format
  body: string; // Plain text body
  htmlContent: string; // HTML body
  attachments: IncomingAttachment[]; // List of attachments for incoming emails
  mailbox: string; // Mailbox name, e.g., INBOX
  status: string; // e.g., 'read', 'unread'
  date_created: string; // Timestamp of when the email was created/fetched
}

export interface OutgoingEmailData {
  fromName: string;
  replyToExtension: string;
  recipients: string[];
  subject: string;
  message: string;
  attachments?: OutgoingAttachment[];
}

export interface EmailResult {
  success: boolean;
  error?: string;
}
