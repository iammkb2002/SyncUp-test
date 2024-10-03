"use server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { EmailContent } from "@/types/email_content";
import { AdminUuid } from "@/types/admin_uuid";
import { User } from "@/types/user";
import { OrganizationUuid } from "@/types/organization_uuid";
import { EventUuid } from "@/types/event_uuid";
import { Organization } from "@/types/organization";

import { PostgrestError } from "@supabase/supabase-js";

export async function fetchSentEmailsByAdmin(adminUserId: AdminUuid) {
  const supabase = createClient();
  // console.log("Fetching sent emails for admin:", adminUserId);
  try {
    const { data: sentEmails, error } = await supabase.rpc("get_emails_by_admin", {
      admin_user_id: adminUserId,
    });

    if (error) throw error;
    // console.log("Fetched sent emails:", sentEmails);
    return sentEmails;
  } catch (error) {
    console.error("Error fetching sent emails:", (error as Error).message);
    return [];
  }
}

export async function sendEmail(emailContent: EmailContent) {
  const resend = new Resend(process.env.NEXT_PUBLIC_RESEND_API_KEY);
  // console.log("Sending email with content:", emailContent);
  try {
    const response = await resend.emails.send(emailContent);
    if (
      response.error &&
      response.error.message.includes(
        "You can only send testing emails to your own email address"
      )
    ) {
      throw new Error(
        "You can only send emails to the account bound to the Resend API Free Plan."
      );
    }
    // console.log("Email sent:", response);
    return response;
  } catch (error) {
    console.error("Error sending email:", (error as Error).message);
    throw error; // Re-throw error to handle it in the calling function
  }
}

export async function sendNewsletter(
  subject: string,
  content: string,
  allUsers: User[],
  attachments: any[],
  organizationName: string,
  organizationUuid: OrganizationUuid
) {
  const supabase = createClient();
  // console.log("Sending newsletter with subject:", subject);
  // console.log("Content:", content);
  // console.log("Attachments:", attachments);
  // console.log("Organization Name:", organizationName);
  // console.log("Organization UUID:", organizationUuid);

  let successCount = 0;
  let failures: { email: string; reason: string }[] = [];

  const uniqueUsers = allUsers.filter(
    (user, index, self) => index === self.findIndex((t) => t.email === user.email)
  );

  // console.log("Unique users to send to:", uniqueUsers);

  const promises = uniqueUsers.map(async (user) => {
    if (user && user.email) {
      const emailContent: EmailContent = {
        from: `${organizationName} <onboarding@resend.dev>`,
        to: user.email,
        subject,
        html: content,
        attachments,
      };

      try {
        const emailResponse = await sendEmail(emailContent);
        if (emailResponse && emailResponse.data) {
          // console.log("Email sent to:", user.email);
          const { data: insertData, error: insertError } = await supabase
            .from("emails")
            .insert([
              {
                sender_id: organizationUuid,
                receiver_id: user.id,
                sender: organizationName,
                receiver: user.email,
                subject,
                body: content,
                status: "Sent",
              },
            ]);

          if (insertError) {
            console.error("Error inserting email record:", insertError.message);
            throw new Error(insertError.message); // Re-throw to handle it as a failure
          }

          successCount++;
          return emailResponse;
        } else {
          throw new Error(emailResponse?.error?.message || "Unknown error sending email");
        }
      } catch (emailError) {
        failures.push({ email: user.email, reason: (emailError as Error).message });
        const errorMessage = (emailError as Error).message;
        console.error("Error sending email to:", user.email, errorMessage);
      }
    }
  });

  await Promise.all(promises);

  // Show success/failure summary
  // console.log("Newsletter send process complete. Success count:", successCount);
  if (failures.length > 0) {
    console.error("Failures:", failures);
  }

  return { successCount, failures };
}

export async function fetchMembersByOrganization(organizationUuid: OrganizationUuid) {
  const supabase = createClient();
  // console.log("Fetching members for organization UUID:", organizationUuid);
  try {
    const { data: members, error } = await supabase.rpc(
      "get_all_combined_user_data_by_org",
      { organization_uuid: organizationUuid }
    );

    if (error) throw error;
    // console.log("Fetched members:", members);
    return members;
  } catch (error) {
    console.error("Error fetching members by organization:", (error as Error).message);
    return [];
  }
}

export async function fetchMembersByEvent(eventUuid: EventUuid) {
  const supabase = createClient();
  // console.log("Fetching members for event UUID:", eventUuid);
  try {
    const { data: members, error } = await supabase.rpc(
      "get_all_combined_user_data_by_event",
      { event_uuid: eventUuid }
    );

    if (error) throw error;
    // console.log("Fetched members by event:", members);
    return members;
  } catch (error) {
    console.error("Error fetching members by event:", (error as Error).message);
    return [];
  }
}

export async function fetchEventsByOrganization(organizationUuid: OrganizationUuid) {
  const supabase = createClient();
  // console.log("Fetching events for organization UUID:", organizationUuid);
  try {
    const { data: events, error } = await supabase.rpc("get_events_by_organization", {
      org_id: organizationUuid,
    });

    if (error) throw error;
    // console.log("Fetched events:", events);
    return events;
  } catch (error) {
    console.error("Error fetching events by organization:", (error as Error).message);
    return [];
  }
}

export async function fetchOrganizationBySlug(
  slug: string
): Promise<Organization | null> {
  const supabase = createClient();
  // console.log("Fetching organization by slug:", slug);
  try {
    const { data: organization, error } = await supabase.rpc("get_organization_by_slug", {
      org_slug: slug,
    });

    if (error) throw error;

    // console.log("Fetched organization:", organization);
    return organization.length > 0 ? organization[0] : null;
  } catch (error) {
    // console.error("Error fetching organization by slug:", (error as Error).message);
    return null;
  }
}
export async function check_permissions(
  org_id: string,
  perm_key: string,
  userid: string
) {
  const supabase = createClient();
  // console.log(
  //   "Checking permissions for organization:",
  //   org_id,
  //   "permission key:",
  //   perm_key,
  //   " user:",
  //   userid
  // );

  const { data, error } = await supabase.rpc("check_org_permissions", {
    p_org_id: org_id,
    p_perm_key: perm_key,
    p_user_id: userid,
  });

  if (error) {
    console.error("Error checking permissions", error);
    return null;
  }

  return data;
}
