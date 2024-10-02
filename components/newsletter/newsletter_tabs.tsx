"use client";

import { useState } from "react";
import NewsletterCreation from "./newsletter_creation";
import Emails from "./emails";

interface NewsletterTabsProps {
  organizationName: string;
  organizationId: string;
  events: any[]; // Replace with actual type
  users: any[]; // Replace with actual type
  sentEmails: any[]; // Replace with Email type
  incomingEmails: any[]; // Replace with Email type
}

const tabs = [
  { name: "Newsletter Creation", component: "creation" },
  { name: "Emails", component: "emails" },
];

const NewsletterTabs: React.FC<NewsletterTabsProps> = ({
  organizationName,
  organizationId,
  events,
  users,
  sentEmails,
  incomingEmails,
}) => {
  const [activeTab, setActiveTab] = useState<string>("creation");

  return (
    <div className="bg-raisin rounded-lg font-sans text-white">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.component}
            className={`py-2 px-4 -mb-px text-sm font-medium focus:outline-none transition-colors ${
              activeTab === tab.component
                ? "border-b-2 border-indigo-500 text-indigo-500"
                : "text-gray-400 hover:text-white"
            }`}
            onClick={() => setActiveTab(tab.component)}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "creation" && (
          <NewsletterCreation
            organizationName={organizationName}
            organizationId={organizationId}
            events={events}
            users={users}
          />
        )}
        {activeTab === "emails" && (
          <Emails
            sentEmails={sentEmails}
            incomingEmails={incomingEmails}
            organizationName={organizationName}
            organizationId={organizationId}
          />
        )}
      </div>
    </div>
  );
};

export default NewsletterTabs;
