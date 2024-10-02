// File: src/components/Emails.tsx

"use client";

import React, { useState, Fragment, useMemo, useEffect } from "react";
import { Email } from "@/types/email";
import DataTable, { TableColumn, TableStyles } from "react-data-table-component";
import { Tab, Dialog, Transition } from "@headlessui/react";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/20/solid";
import parse from "html-react-parser";
import { check_permissions } from "@/lib/newsletter_actions"; // Add this import

interface EmailsProps {
  sentEmails: Email[];
  incomingEmails: Email[];
  emailsLoading: boolean;
  organizationName: string;
  organizationSlug: string;
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

const customStyles: TableStyles = {
  table: {
    style: {
      tableLayout: "fixed",
      width: "100%",
    },
  },
  headRow: {
    style: {
      backgroundColor: "#333333",
      color: "#ffffff",
    },
  },
  headCells: {
    style: {
      color: "#ffffff",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
  },
  cells: {
    style: {
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
  },
  rows: {
    style: {
      backgroundColor: "#2a2a2a",
      color: "#ffffff",
      "&:hover": { backgroundColor: "#3e3e3e" },
    },
  },
  pagination: {
    style: {
      backgroundColor: "#1f1f1f",
      color: "#ffffff",
      justifyContent: "center",
    },
  },
  noData: {
    style: {
      backgroundColor: "#1f1f1f",
      color: "#ffffff",
    },
  },
};

const Emails: React.FC<EmailsProps> = ({
  sentEmails,
  incomingEmails,
  emailsLoading,
  organizationName,
  organizationSlug,
}) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [outgoingSearch, setOutgoingSearch] = useState("");
  const [incomingSearch, setIncomingSearch] = useState("");

  useEffect(() => {
    async function checkUserPermissions() {
      const permission = await check_permissions("", organizationSlug, "view_emails");
      setHasPermission(permission);
    }
    checkUserPermissions();
  }, [organizationSlug]);

  if (!hasPermission) {
    return <div className="text-red-500">You do not have permission to view emails.</div>;
  }

  const openEmailPreview = (email: Email) => {
    setSelectedEmail(email);
    setIsPreviewOpen(true);
  };

  const outgoingEmailColumns: TableColumn<Email>[] = [
    {
      name: "Subject",
      selector: (row: Email) => row.subject,
      sortable: true,
      id: "subject",
      width: "250px",
    },
    {
      name: "To",
      selector: (row: Email) => row.to.join(", "),
      sortable: true,
      id: "to",
      width: "200px",
    },
    {
      name: "Date",
      selector: (row: Email) => new Date(row.date).toLocaleString(),
      sortable: true,
      id: "date",
      width: "180px",
    },
    {
      name: "Actions",
      cell: (row: Email) => (
        <button className="text-primary underline" onClick={() => openEmailPreview(row)}>
          Preview
        </button>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      button: true,
      id: "actions",
      width: "120px",
    },
  ];

  const incomingEmailColumns: TableColumn<Email>[] = [
    {
      name: "Subject",
      selector: (row: Email) => row.subject,
      sortable: true,
      id: "subject",
      width: "250px",
    },
    {
      name: "From",
      selector: (row: Email) => row.from,
      sortable: true,
      id: "from",
      width: "200px",
    },
    {
      name: "Date",
      selector: (row: Email) => new Date(row.date).toLocaleString(),
      sortable: true,
      id: "date",
      width: "180px",
    },
    {
      name: "Actions",
      cell: (row: Email) => (
        <button className="text-primary underline" onClick={() => openEmailPreview(row)}>
          Preview
        </button>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      button: true,
      id: "actions",
      width: "120px",
    },
  ];

  const filteredSentEmails = useMemo(() => {
    if (!outgoingSearch) return sentEmails;
    return sentEmails.filter((email) =>
      Object.values(email).join(" ").toLowerCase().includes(outgoingSearch.toLowerCase())
    );
  }, [sentEmails, outgoingSearch]);

  const filteredIncomingEmails = useMemo(() => {
    if (!incomingSearch) return incomingEmails;
    return incomingEmails.filter((email) =>
      Object.values(email).join(" ").toLowerCase().includes(incomingSearch.toLowerCase())
    );
  }, [incomingEmails, incomingSearch]);

  return (
    <div>
      <h2 className="border-b-2 border-primary pb-4 text-2xl">Emails</h2>
      <Tab.Group>
        <Tab.List className="flex space-x-1 rounded-xl bg-[#333333] p-1">
          <Tab
            className={({ selected }) =>
              classNames(
                "w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-white",
                selected ? "bg-primary shadow" : "hover:bg-white/[0.12] hover:text-white"
              )
            }
          >
            Outgoing Emails
          </Tab>
          <Tab
            className={({ selected }) =>
              classNames(
                "w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-white",
                selected ? "bg-primary shadow" : "hover:bg-white/[0.12] hover:text-white"
              )
            }
          >
            Incoming Emails
          </Tab>
        </Tab.List>
        <Tab.Panels>
          <Tab.Panel>
            <input
              type="text"
              placeholder="Search Outgoing Emails..."
              value={outgoingSearch}
              onChange={(e) => setOutgoingSearch(e.target.value)}
              className="mb-4 mt-2 w-full rounded border bg-charleston p-2 text-base focus:border-primary"
            />
            <div className="overflow-x-auto">
              <DataTable
                keyField="id"
                columns={outgoingEmailColumns}
                data={filteredSentEmails}
                pagination
                fixedHeader
                fixedHeaderScrollHeight="400px"
                customStyles={customStyles}
                noDataComponent={<div>There are no records to display</div>}
                progressPending={emailsLoading}
                progressComponent={
                  <div className="w-full rounded bg-charleston p-2 text-center text-white">
                    Emails take longer to load. Please wait.
                  </div>
                }
                defaultSortFieldId="date"
                defaultSortAsc={false}
              />
            </div>
          </Tab.Panel>
          <Tab.Panel>
            <input
              type="text"
              placeholder="Search Incoming Emails..."
              value={incomingSearch}
              onChange={(e) => setIncomingSearch(e.target.value)}
              className="mb-4 mt-2 w-full rounded border bg-charleston p-2 text-base focus:border-primary"
            />
            <div className="overflow-x-auto">
              <DataTable
                keyField="id"
                columns={incomingEmailColumns}
                data={filteredIncomingEmails}
                pagination
                fixedHeader
                fixedHeaderScrollHeight="400px"
                customStyles={customStyles}
                noDataComponent={<div>There are no records to display</div>}
                progressPending={emailsLoading}
                progressComponent={
                  <div className="w-full rounded bg-charleston p-2 text-center text-white">
                    Emails take longer to load. Please wait.
                  </div>
                }
                defaultSortFieldId="date"
                defaultSortAsc={false}
              />
            </div>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>

      {selectedEmail && (
        <Transition appear show={isPreviewOpen} as={Fragment}>
          <Dialog
            as="div"
            className="fixed inset-0 z-50 overflow-y-auto"
            onClose={() => setIsPreviewOpen(false)}
          >
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black bg-opacity-75" />
            </Transition.Child>

            <div className="flex min-h-screen items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel
                  className="z-50 my-8 inline-block w-full max-w-3xl transform overflow-hidden rounded-2xl bg-gray-800 p-6 text-left align-middle shadow-xl transition-all"
                  style={{ backgroundColor: "#333333" }}
                >
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-white"
                  >
                    Preview Email: {selectedEmail.subject}
                  </Dialog.Title>
                  <div className="mt-2">
                    {selectedEmail.from &&
                    organizationName &&
                    selectedEmail.from.includes(organizationName) ? (
                      <p className="text-sm text-gray-400">
                        To: {selectedEmail.to.join(", ")}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">From: {selectedEmail.from}</p>
                    )}
                    <div className="prose prose-invert mt-4 max-w-full text-white">
                      {selectedEmail.htmlContent
                        ? parse(selectedEmail.htmlContent)
                        : parse(selectedEmail.body)}
                    </div>

                    {selectedEmail.attachments.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-md font-semibold text-white">Attachments:</h4>
                        <ul className="mt-2">
                          {selectedEmail.attachments.map((attachment, index) => (
                            <li key={index} className="text-blue-400 hover:underline">
                              <a
                                href={attachment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {attachment.filename}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <button
                      type="button"
                      className="hover:bg-primary-dark focus-visible:ring-primary-light inline-flex justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring focus-visible:ring-opacity-75"
                      onClick={() => setIsPreviewOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition>
      )}
    </div>
  );
};

export default Emails;
