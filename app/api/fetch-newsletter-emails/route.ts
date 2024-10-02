// app/api/fetch-newsletter-emails/route.ts

import { NextResponse } from "next/server";
import imaps from "imap-simple";
import { simpleParser, ParsedMail } from "mailparser";
import { Email, IncomingAttachment } from "@/types/email";
import fs from "fs/promises";
import path from "path";

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

async function cleanupOldAttachments(
  attachmentsDir: string,
  validAttachments: Set<string>
) {
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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const organizationName = searchParams.get("organizationName"); // For sent emails
    const organizationSlug = searchParams.get("organizationSlug"); // For incoming emails

    if (!organizationName || !organizationSlug) {
      return NextResponse.json(
        { message: "Organization name and slug are required" },
        { status: 400 }
      );
    }

    console.log("Connecting to IMAP server...");
    const connection = await imaps.connect(imapConfig);
    console.log("IMAP server connected successfully.");

    const mailboxes = ["INBOX", "[Gmail]/Sent Mail"];

    const allEmails: Email[] = [];

    // Define the directory where attachments will be saved
    const attachmentsDir = path.join(process.cwd(), "attachments");

    // Ensure the attachments directory exists
    await fs.mkdir(attachmentsDir, { recursive: true });

    for (const mailbox of mailboxes) {
      console.log(`Fetching emails from mailbox: ${mailbox}`);
      await connection.openBox(mailbox);

      const searchCriteria = ["ALL"];
      const fetchOptions = {
        bodies: [""],
        struct: true,
        markSeen: false,
      };

      const results = await connection.search(searchCriteria, fetchOptions);

      for (const res of results) {
        const rawEmailPart = res.parts.find((part: any) => part.which === "");
        const rawEmail = rawEmailPart ? rawEmailPart.body : null;

        if (rawEmail) {
          // Parse the raw email content
          const parsedEmail: ParsedMail = await simpleParser(rawEmail);
          console.log("Parsed email:", parsedEmail);

          // Initialize isRelevant to false
          let isRelevant = false;

          if (mailbox === "[Gmail]/Sent Mail") {
            // For sent emails, check if 'from' name includes the organization name
            if (parsedEmail.from && parsedEmail.from.value) {
              isRelevant = parsedEmail.from.value.some(
                (address) => address.name && address.name.includes(organizationName)
              );
            }
          } else if (mailbox === "INBOX") {
            // For incoming emails, check if any 'to' address includes the organization's email alias
            if (parsedEmail.to) {
              const toAddresses = Array.isArray(parsedEmail.to)
                ? parsedEmail.to
                : [parsedEmail.to];

              isRelevant = toAddresses.some(
                (address) =>
                  address.text && address.text.includes(`+${organizationSlug}@gmail.com`)
              );
            }
          }

          if (!isRelevant) {
            // Skip emails not relevant to the organization
            continue;
          }

          // Extract attachments if any and save them
          const attachments: IncomingAttachment[] = [];

          for (const [index, attachment] of parsedEmail.attachments.entries()) {
            const originalFilename = attachment.filename || `attachment-${index}`;
            const uniqueFilename = `${res.attributes.uid}-${Date.now()}-${originalFilename}`;
            const sanitizedFilename = path.basename(uniqueFilename); // Prevent directory traversal

            const filePath = path.join(attachmentsDir, sanitizedFilename);

            if (!downloadedAttachments.has(sanitizedFilename)) {
              try {
                console.log(`Saving attachment to ${filePath}`);
                await fs.writeFile(filePath, attachment.content);

                downloadedAttachments.add(sanitizedFilename);

                attachments.push({
                  filename: sanitizedFilename,
                  contentType: attachment.contentType || "application/octet-stream",
                  url: `/api/get-attachment?filename=${encodeURIComponent(sanitizedFilename)}`,
                });
              } catch (writeError: any) {
                console.error(
                  `Failed to save attachment ${sanitizedFilename}: ${writeError.message}`
                );

                // Optionally, continue without failing the entire email processing
              }
            }
          }

          // Construct the Email object
          const email: Email = {
            id: res.attributes.uid.toString(),
            from: formatAddress(parsedEmail.from),
            to: parsedEmail.to
              ? Array.isArray(parsedEmail.to)
                ? parsedEmail.to.map((addr: any) => `${addr.name} <${addr.address}>`)
                : parsedEmail.to.value.map(
                    (addr: any) => `${addr.name} <${addr.address}>`
                  )
              : [],
            subject: parsedEmail.subject || "No Subject",
            date: parsedEmail.date ? parsedEmail.date.toISOString() : "No Date",
            body: parsedEmail.text || "",
            htmlContent: parsedEmail.html || "",
            attachments: attachments.length > 0 ? attachments : [],
            mailbox,
            status: "unread",
            date_created: new Date().toISOString(),
          };

          allEmails.push(email);
        }
      }
    }

    connection.end();

    // Clean up old attachments
    await cleanupOldAttachments(attachmentsDir, downloadedAttachments);

    return NextResponse.json({ emails: allEmails });
  } catch (error: any) {
    console.error("Error while fetching emails:", error.message);

    return NextResponse.json(
      { message: "Error fetching emails", error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Formats an address object to a string.
 * @param address The address object from mailparser.
 * @returns A formatted address string.
 */
function formatAddress(address: ParsedMail["from"]): string {
  if (!address || !address.value) return "Unknown";
  return address.value.map((addr: any) => `${addr.name} <${addr.address}>`).join(", ");
}
