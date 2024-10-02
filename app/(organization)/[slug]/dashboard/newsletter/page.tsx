import {
  fetchEventsByOrganization,
  fetchMembersByOrganization,
  fetchOrganizationBySlug,
} from "@/lib/newsletter_actions";
import NewsletterTabs from "@/components/newsletter/newsletter_tabs";
import { Email } from "@/types/email";

export default async function NewsletterPage({ params }: { params: { slug: string } }) {
  const orgSlug = params.slug;
  const organization = await fetchOrganizationBySlug(orgSlug);

  if (!organization) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ backgroundColor: "#1c1c1c", color: "white" }}
      >
        <div className="rounded-lg p-6 text-center shadow-lg" style={{ backgroundColor: "#2c2c2c" }}>
          <p className="text-lg font-semibold">Organization not found.</p>
        </div>
      </div>
    );
  }

  const [fetchedEvents, fetchedUsers] = await Promise.all([
    fetchEventsByOrganization(organization.organizationid),
    fetchMembersByOrganization(organization.organizationid),
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const emailsResponse = await fetch(
    `${baseUrl}/api/newsletter/fetch-newsletter-emails?organizationName=${organization.name}&organizationSlug=${organization.slug}`
  );
  const allEmails = await emailsResponse.json();

  const sentEmails = allEmails?.emails?.filter((email: Email) => email.from.includes(organization.name)) || [];
  const incomingEmails = allEmails?.emails?.filter((email: Email) =>
    email.to?.some(
      (addr) =>
        addr.includes(`${organization.slug}@`) ||
        addr.endsWith(`${organization.slug}@yourdomain.com`)
    )
  ) || [];

  return (
    <div className="bg-raisin mb-40 w-full max-w-full space-y-6 rounded-lg pt-3 font-sans text-white">
      <NewsletterTabs
        organizationName={organization.name}
        organizationId={organization.organizationid}
        organizationSlug={organization.slug}
        events={fetchedEvents || []}
        users={fetchedUsers || []}
        sentEmails={sentEmails}
        incomingEmails={incomingEmails}
      />
    </div>
  );
}