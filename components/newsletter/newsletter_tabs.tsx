"use client";

import React, { Fragment } from "react";
import { Tab } from "@headlessui/react";
import NewsletterCreation from "./newsletter_creation";
import Emails from "./emails";

interface NewsletterTabsProps {
  organizationName: string;
  organizationId: string;
  organizationSlug: string;
  events: any[]; // Replace with actual type
  users: any[]; // Replace with actual type
  sentEmails: any[]; // Replace with Email type
  incomingEmails: any[]; // Replace with Email type
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

const NewsletterTabs: React.FC<NewsletterTabsProps> = ({
  organizationName,
  organizationId,
  organizationSlug,
  events,
  users,
  sentEmails,
  incomingEmails,
}) => {
  return (
    <div className="bg-raisin rounded-lg font-sans text-white">
      <Tab.Group>
        <Tab.List className="flex space-x-1 rounded-xl bg-[#333333] p-1 mb-6">
          <Tab
            className={({ selected }) =>
              classNames(
                "w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-white",
                selected
                  ? "bg-primary shadow"
                  : "hover:bg-white/[0.12] hover:text-white"
              )
            }
          >
            Newsletter Creation
          </Tab>
          <Tab
            className={({ selected }) =>
              classNames(
                "w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-white",
                selected
                  ? "bg-primary shadow"
                  : "hover:bg-white/[0.12] hover:text-white"
              )
            }
          >
            Emails
          </Tab>
        </Tab.List>
        <Tab.Panels>
          <Tab.Panel>
            <NewsletterCreation
              organizationName={organizationName}
              organizationId={organizationId}
              organizationSlug={organizationSlug}
              events={events}
              users={users}
            />
          </Tab.Panel>
          <Tab.Panel>
            <Emails
              sentEmails={sentEmails}
              incomingEmails={incomingEmails}
              organizationName={organizationName}
              organizationId={organizationId}
            />
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
};

export default NewsletterTabs;
