import type { NextApiRequest, NextApiResponse } from "next";
import formidable, { IncomingForm, Fields, Files } from "formidable";
import fs from "fs/promises";
import nodemailer from "nodemailer";
import { OutgoingAttachment, EmailResult, OutgoingEmailData } from "@/types/email";

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Helper function to safely extract a single string from formidable fields.
 * If the field is an array, it returns the first element.
 * If the field is undefined, it returns a default value.
 *
 * @param field - The field value from formidable (string | string[] | undefined)
 * @param defaultValue - Optional default value to return if the field is undefined
 * @returns A single string value
 */
const getString = (
  field: string | string[] | undefined,
  defaultValue: string = ""
): string => {
  if (Array.isArray(field)) return field[0];
  return field || defaultValue;
};

/**
 * Validates an array of email addresses.
 *
 * @param emails - Array of email addresses to validate.
 * @returns Array of valid email addresses.
 */
const validateEmails = (emails: string[]): string[] => {
  const validEmails = emails.filter((email) => {
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isValid) {
      console.warn(`Invalid email address skipped: ${email}`);
    }
    return isValid;
  });
  return validEmails;
};

/**
 * Sends a newsletter email using Nodemailer.
 *
 * @param data - Email data including recipients, subject, message, and attachments.
 * @returns EmailResult indicating success or failure.
 */
async function sendNewsletterEmail({
  fromName,
  replyToExtension,
  recipients,
  subject,
  message,
  attachments = [],
}: OutgoingEmailData): Promise<EmailResult> {
  try {
    // console.log("Preparing to send email to recipients:", recipients);
    // console.log("Creating Nodemailer transporter");

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NEXT_PUBLIC_GMAIL_USER!, // Gmail address from environment variable
        pass: process.env.NEXT_PUBLIC_GMAIL_APP_PASSWORD!, // Gmail App Password from environment variable
      },
    });
    // console.log("Nodemailer transporter created.");
    await transporter.verify();
    // console.log("Nodemailer transporter verified successfully.");

    const mailAttachments =
      attachments.length > 0
        ? attachments.map((file) => ({
            filename: file.filename,
            content: file.content, // Buffer content for outgoing emails
            contentType: file.contentType,
          }))
        : undefined;

    if (mailAttachments) {
      // console.log("Prepared mail attachments:", mailAttachments);
    } else {
      // console.log("No attachments to include in the email.");
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"${fromName}" <${process.env.NEXT_PUBLIC_GMAIL_USER!}>`, // Custom name for the "From" field
      replyTo: `${process.env.NEXT_PUBLIC_GMAIL_USER!.split("@")[0]}+${replyToExtension}@gmail.com`, // Custom Reply-To using +extension
      to: recipients.join(", "), // The recipients' emails as a comma-separated string
      subject: subject, // The email subject
      html: message, // The email message in HTML format
      attachments: mailAttachments, // Attachments if any
    };

    // console.log("Mail options prepared:", mailOptions);
    await transporter.sendMail(mailOptions);
    // console.log("Email sent successfully.");
    return { success: true };
  } catch (error: any) {
    console.error("Error sending email:", error);
    return { success: false, error: error.message };
  }
}

/**
 * API Route Handler
 *
 * Handles POST requests to send newsletter emails with optional attachments.
 *
 * @param req - NextApiRequest object
 * @param res - NextApiResponse object
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // console.log("Received request:", {
  //   method: req.method,
  //   headers: req.headers,
  //   url: req.url,
  // });

  try {
    if (req.method !== "POST") {
      console.warn(`Method ${req.method} not allowed.`);
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ error: `Method '${req.method}' Not Allowed` });
    }

    const form = new IncomingForm({
      multiples: true,
      maxFileSize: 25 * 1024 * 1024, // 25MB per file
      allowEmptyFiles: false,
    });
    // console.log("Initialized formidable with options:", form);

    const { fields, files } = await new Promise<{
      fields: Fields;
      files: Files;
    }>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error("Formidable parse error:", err);
          reject(err);
        } else {
          // console.log("Formidable parsed fields:", fields);
          // console.log("Formidable parsed files:", files);
          resolve({ fields, files });
        }
      });
    });

    const fromName = getString(fields.fromName, "Default Name");
    const replyToExtension = getString(fields.replyToExtension);
    const recipientsString = getString(fields.recipients);
    let recipients: string[] = [];
    if (recipientsString) {
      try {
        recipients = JSON.parse(recipientsString);
        if (!Array.isArray(recipients)) {
          throw new Error("Recipients should be an array.");
        }
        // console.log("Parsed recipients:", recipients);
      } catch (error: any) {
        console.error("Invalid recipients format:", error.message);
        return res.status(400).json({
          message: "Invalid recipients format.",
          error: error.message,
        });
      }
    }

    const validRecipients = validateEmails(recipients);
    // console.log("Valid recipients after validation:", validRecipients);
    if (validRecipients.length === 0) {
      console.warn("No valid recipients provided.");
      return res.status(400).json({ message: "No valid recipients provided." });
    }

    const subject = getString(fields.subject, "Default Subject");
    const message = getString(fields.message, "");
    // console.log("Email subject:", subject);
    // console.log("Email message:", message);

    let attachments: OutgoingAttachment[] = [];
    if (files.attachments) {
      const attachmentsArray = Array.isArray(files.attachments)
        ? files.attachments
        : [files.attachments];
      // console.log("Processing attachments:", attachmentsArray);

      const totalSize = attachmentsArray.reduce((acc, file) => acc + (file.size || 0), 0);
      const maxTotalSize = 25 * 1024 * 1024; // 25MB
      if (totalSize > maxTotalSize) {
        console.warn(
          `Total attachment size ${totalSize} exceeds the limit of ${maxTotalSize} bytes.`
        );
        return res.status(400).json({
          message: "Total attachment size exceeds the 25MB limit.",
        });
      }

      attachments = await Promise.all(
        attachmentsArray.map(async (file: formidable.File) => {
          // console.log(`Reading file: ${file.filepath}`);
          const content = await fs.readFile(file.filepath);
          // console.log(`File read successfully: ${file.filepath}`);

          try {
            await fs.unlink(file.filepath);
            // console.log(`Temporary file deleted: ${file.filepath}`);
          } catch (err: any) {
            console.warn(
              `Failed to delete temporary file ${file.filepath}:`,
              err.message
            );
          }

          return {
            filename: file.originalFilename || "attachment",
            content,
            contentType: file.mimetype || "application/octet-stream",
          } as OutgoingAttachment;
        })
      );
      // console.log("Processed attachments:", attachments);
    } else {
      // console.log("No attachments provided.");
    }

    // console.log("Sending newsletter email...");
    const result: EmailResult = await sendNewsletterEmail({
      fromName,
      replyToExtension,
      recipients: validRecipients,
      subject,
      message,
      attachments,
    });
    // console.log("Email sending result:", result);

    if (result.success) {
      // console.log("Email sent successfully.");
      return res.status(200).json({ message: "Email sent successfully" });
    } else {
      console.error("Error sending email:", result.error);
      return res.status(500).json({
        message: "Error sending email",
        error: result.error,
      });
    }
  } catch (error: any) {
    console.error("Unexpected error in send-newsletter-email route:", error);
    return res.status(500).json({
      message: "An unexpected error occurred",
      error: error.message,
    });
  }
}
