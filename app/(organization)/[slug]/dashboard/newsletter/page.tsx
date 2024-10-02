// File: D:\Repos\SyncUp-test\app\(organization)\[slug]\dashboard\newsletter\page.tsx

import {
  fetchEventsByOrganization,
  fetchMembersByEvent,
  fetchMembersByOrganization,
  fetchOrganizationBySlug,
} from "@/lib/newsletter_actions";
import { Email } from "@/types/email";
import { Event } from "@/types/event";
import { CombinedUserData } from "@/types/combined_user_data";
import axios from "axios";
import NewsletterCreation from "@/components/newsletter/newsletter_creation";
import Emails from "@/components/newsletter/emails";
import React from "react";

export default async function NewsletterPage({ params }: { params: { slug: string } }) {
  const orgSlug = params.slug;
  const organization = await fetchOrganizationBySlug(orgSlug);

  if (!organization) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ backgroundColor: "#1c1c1c", color: "white" }}
      >
        <div
          className="rounded-lg p-6 text-center shadow-lg"
          style={{ backgroundColor: "#2c2c2c" }}
        >
          <p className="text-lg font-semibold">Organization not found.</p>
        </div>
      </div>
    );
  }

  // Fetch the necessary data for the page before rendering
  const [fetchedEvents, fetchedUsers] = await Promise.all([
    fetchEventsByOrganization(organization.organizationid),
    fetchMembersByOrganization(organization.organizationid),
  ]);

  const emailsResponse = await axios.get("/api/newsletter/fetch-newsletter-emails", {
    params: {
      organizationName: organization.name,
      organizationSlug: organization.slug,
    },
  });

  const allEmails: { emails: Email[] } = emailsResponse.data;
  const sentEmails = allEmails.emails.filter((email: Email) =>
    email.from.includes(organization.name)
  );
  const incomingEmails = allEmails.emails.filter((email: Email) =>
    email.to.some(
      (addr) =>
        addr.includes(`${organization.slug}@`) ||
        addr.endsWith(`${organization.slug}@yourdomain.com`)
    )
  );

  // Return the page after fetching the necessary data
  return (
    <div className="bg-raisin mb-40 w-full max-w-full space-y-6 rounded-lg p-10 font-sans text-white">
      <NewsletterCreation
        organizationName={organization.name}
        organizationSlug={organization.slug}
        events={fetchedEvents}
        users={fetchedUsers}
        eventsLoading={false}  // These loading states are unnecessary now
        usersLoading={false}
      />
      <Emails
        sentEmails={sentEmails}
        incomingEmails={incomingEmails}
        emailsLoading={false}  // These loading states are unnecessary now
        organizationName={organization.name}
        organizationSlug={organization.slug}
      />
    </div>
  );
}
