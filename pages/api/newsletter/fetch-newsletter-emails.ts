import { NextApiRequest, NextApiResponse } from 'next';
import imaps from 'imap-simple';
import { simpleParser, ParsedMail } from 'mailparser';
import { Email, IncomingAttachment } from '@/types/email';
import fs from 'fs/promises';
import path from 'path';

const imapConfig = {
  imap: {
    user: process.env.NEXT_PUBLIC_GMAIL_USER!,
    password: process.env.NEXT_PUBLIC_GMAIL_APP_PASSWORD!,
    host: "imap.gmail.com",
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    authTimeout: 3000,
  },
};

const downloadedAttachments = new Set<string>();

async function cleanupOldAttachments(attachmentsDir: string, validAttachments: Set<string>) {
  const files = await fs.readdir(attachmentsDir);
  for (const file of files) {
    if (!validAttachments.has(file)) {
      try {
        await fs.unlink(path.join(attachmentsDir, file));
      } catch (error: any) {
        console.error(`Failed to delete old attachment ${file}: ${error.message}`);
      }
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { organizationName, organizationSlug } = req.query;

    if (!organizationName || !organizationSlug) {
      console.warn("Organization name or slug is missing in the request.");
      return res.status(400).json({ message: "Organization name and slug are required" });
    }

    // console.log("Connecting to IMAP server with config:", imapConfig);
    const connection = await imaps.connect(imapConfig);

    const mailboxes = ["INBOX", "[Gmail]/Sent Mail"];
    // console.log("IMAP server connected successfully. Mailboxes:", mailboxes);

    const allEmails: Email[] = [];

    const attachmentsDir = path.join('/tmp', 'attachments');  // Changed to /tmp directory
    await fs.mkdir(attachmentsDir, { recursive: true });

    for (const mailbox of mailboxes) {
      // console.log(`Fetching emails from mailbox: ${mailbox}`);
      await connection.openBox(mailbox);

      const searchCriteria = ["ALL"];
      const fetchOptions = { bodies: [""], struct: true, markSeen: false };
      const results = await connection.search(searchCriteria, fetchOptions);

      for (const res of results) {
        const rawEmailPart = res.parts.find((part: any) => part.which === "");
        const rawEmail = rawEmailPart ? rawEmailPart.body : null;

        if (rawEmail) {
          const parsedEmail: ParsedMail = await simpleParser(rawEmail);
          // console.log(`Parsed email from ${mailbox}: ${parsedEmail.subject}`);

          let isRelevant = false;

          if (mailbox === "[Gmail]/Sent Mail") {
            if (parsedEmail.from && parsedEmail.from.value) {
              isRelevant = parsedEmail.from.value.some(
                (address) => address.name && address.name.includes(Array.isArray(organizationName) ? organizationName.join(' ') : organizationName)
              );
            }
          } else if (mailbox === "INBOX") {
            if (parsedEmail.to) {
              const toAddresses = Array.isArray(parsedEmail.to)
                ? parsedEmail.to
                : [parsedEmail.to];

              isRelevant = toAddresses.some(
                (address) => address.text && address.text.includes(`+${organizationSlug}@gmail.com`)
              );
            }
          }

          if (!isRelevant) continue;

          const attachments: IncomingAttachment[] = [];

          for (const [index, attachment] of parsedEmail.attachments.entries()) {
            const originalFilename = attachment.filename || `attachment-${index}`;
            const uniqueFilename = `${res.attributes.uid}-${Date.now()}-${originalFilename}`;
            const sanitizedFilename = path.basename(uniqueFilename);
            const filePath = path.join(attachmentsDir, sanitizedFilename);

            if (!downloadedAttachments.has(sanitizedFilename)) {
              try {
                // console.log(`Saving attachment to ${filePath}`);
                await fs.writeFile(filePath, attachment.content);
                downloadedAttachments.add(sanitizedFilename);

                attachments.push({
                  filename: sanitizedFilename,
                  contentType: attachment.contentType || "application/octet-stream",
                  url: `/api/newsletter/get-attachment?filename=${encodeURIComponent(sanitizedFilename)}`,
                });
              } catch (writeError: any) {
                console.error(`Failed to save attachment: ${writeError.message}`);
              }
            }
          }

          const email: Email = {
            id: res.attributes.uid.toString(),
            from: parsedEmail.from ? parsedEmail.from.text : 'Unknown',
            to: parsedEmail.to ? (Array.isArray(parsedEmail.to) ? parsedEmail.to.map((addr: any) => addr.text) : [parsedEmail.to.text]) : [],
            subject: parsedEmail.subject || "No Subject",
            date: parsedEmail.date ? parsedEmail.date.toISOString() : "No Date",
            body: parsedEmail.text || "",
            htmlContent: parsedEmail.html || "",
            attachments: attachments.length > 0 ? attachments : [],
            mailbox,
            status: "unread",
            date_created: new Date().toISOString(),
            organizationId: function (arg0: string, organizationId: any): unknown {
              throw new Error('Function not implemented.');
            }
          };

          allEmails.push(email);
        }
      }
    }

    // console.log("Closing IMAP connection...");
    connection.end();
    // console.log("IMAP connection closed successfully.");

    await cleanupOldAttachments(attachmentsDir, downloadedAttachments);

    res.status(200).json({ emails: allEmails });
  } catch (error: any) {
    console.error("Error fetching emails:", error);
    res.status(500).json({ message: "Error fetching emails", error: error.message });
  }
}
