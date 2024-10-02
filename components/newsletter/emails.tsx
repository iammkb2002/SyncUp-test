// Filename: D:\Repos\SyncUp-test\components\newsletter\emails.tsx

"use client";

import React, { useState, Fragment, useMemo, useEffect } from "react";
import { Email } from "@/types/email";
import DataTable, { TableColumn, TableStyles } from "react-data-table-component";
import dynamic from "next/dynamic";
import { Disclosure } from "@headlessui/react";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  XMarkIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/solid";
import { Dialog, Transition } from "@headlessui/react";
import { check_permissions } from "@/lib/newsletter_actions";
import { useUser } from "@/context/user_context";
import Swal from "sweetalert2";
import Preloader from "@/components/preloader";

const RichTextEditor = dynamic(() => import("@mantine/rte"), { ssr: false });

interface EmailsProps {
  sentEmails: Email[];
  incomingEmails: Email[];
  organizationName: string;
  organizationId: string;
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

const customStyles: TableStyles = {
  table: {
    style: {
      tableLayout: "fixed",
      width: "100%",
      backgroundColor: "transparent",
    },
  },
  headRow: {
    style: {
      backgroundColor: "#212121",
      color: "#ffffff",
    },
  },
  headCells: {
    style: {
      color: "#ffffff",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      padding: "12px",
      backgroundColor: "#212121",
      borderRadius: "8px",
    },
  },
  cells: {
    style: {
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      padding: "12px",
      backgroundColor: "transparent",
      color: "#ffffff",
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
      backgroundColor: "transparent",
      color: "#ffffff",
      justifyContent: "center",
    },
  },
  noData: {
    style: {
      backgroundColor: "transparent",
      color: "#ffffff",
    },
  },
};

const extractTextFromHtml = (html: string): string => {
  if (!html) return "";

  // Create a temporary DOM element to leverage the browser's HTML parser
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;
  const plainText = tempDiv.textContent || "";

  // Replace multiple consecutive newlines (including \r\n) with a single newline
  const normalizedText = plainText.replace(/(\r?\n){2,}/g, "\n");

  return normalizedText;
};

const Emails: React.FC<EmailsProps> = ({
  sentEmails,
  incomingEmails,
  organizationName,
  organizationId,
}) => {
  const { user } = useUser();

  // State Management
  const [hasPermission, setHasPermission] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [outgoingSearch, setOutgoingSearch] = useState("");
  const [incomingSearch, setIncomingSearch] = useState("");

  // Permission Check
  useEffect(() => {
    async function checkUserPermissions() {
      setCheckingPermission(true); // Start loading
      console.log("Checking user permissions... ", user?.id, organizationId);
      try {
        const permission = await check_permissions(
          organizationId,
          "send_newsletters",
          user?.id || ""
        );
        setHasPermission(permission);
        console.log("User has permission to view emails: ", permission);
      } catch (error) {
        console.error("Error checking permissions:", error);
        setHasPermission(false);
        Swal.fire("Error", "Failed to check permissions.", "error");
      } finally {
        setCheckingPermission(false); // End loading
      }
    }

    if (user && organizationId) {
      checkUserPermissions();
    } else {
      setHasPermission(false);
      setCheckingPermission(false);
    }
  }, [user, organizationId]);

  // Table Columns without Reply
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
        <div className="flex space-x-2">
          <button
            className="text-primary underline"
            onClick={() => openEmailPreview(row)}
          >
            Preview
          </button>
        </div>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      button: true,
      id: "actions",
      width: "150px",
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
        <div className="flex space-x-2">
          <button
            className="text-primary underline"
            onClick={() => openEmailPreview(row)}
          >
            Preview
          </button>
        </div>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      button: true,
      id: "actions",
      width: "150px",
    },
  ];

  // Search Functionality
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

  // Open Email Preview Modal
  const openEmailPreview = (email: Email) => {
    setSelectedEmail(email);
    setIsPreviewOpen(true);
  };

  return (
    <div className="mx-auto max-w-6xl rounded-lg bg-[#1f1f1f] p-4 shadow-lg">
      {checkingPermission ? (
        <Preloader />
      ) : !hasPermission ? (
        <div className="text-center text-lg font-semibold text-red-500">
          You do not have permission to view emails.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4">
            {/* Outgoing Emails Section */}
            <Disclosure>
              {({ open }) => (
                <>
                  <Disclosure.Button className="flex w-full items-center justify-between rounded bg-[#333333] px-3 py-2 text-left text-sm font-medium text-white focus:outline-none focus-visible:ring focus-visible:ring-opacity-75">
                    <span>Outgoing Emails</span>
                    {open ? (
                      <ChevronUpIcon className="h-4 w-4 text-white" />
                    ) : (
                      <ChevronDownIcon className="h-4 w-4 text-white" />
                    )}
                  </Disclosure.Button>
                  <Disclosure.Panel className="mt-2 space-y-2">
                    <div className="relative border-b-2">
                      <svg
                        className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z"
                        ></path>
                      </svg>
                      <input
                        type="text"
                        placeholder="Search Outgoing Emails..."
                        value={outgoingSearch}
                        onChange={(e) => setOutgoingSearch(e.target.value)}
                        className="w-full rounded-md border-gray-500 border-transparent bg-charleston p-2 pl-10 text-sm text-white placeholder-gray-400 focus:border-primary focus:ring-0"
                      />
                    </div>
                    <div className="overflow-x-auto">
                      <DataTable
                        keyField="id"
                        columns={outgoingEmailColumns}
                        data={filteredSentEmails}
                        pagination
                        fixedHeader
                        fixedHeaderScrollHeight="400px"
                        customStyles={customStyles}
                        noDataComponent={
                          <div className="text-center text-white">
                            There are no outgoing emails to display.
                          </div>
                        }
                        defaultSortFieldId="date"
                        defaultSortAsc={false}
                      />
                    </div>
                  </Disclosure.Panel>
                </>
              )}
            </Disclosure>

            {/* Incoming Emails Section */}
            <Disclosure>
              {({ open }) => (
                <>
                  <Disclosure.Button className="flex w-full items-center justify-between rounded bg-[#333333] px-3 py-2 text-left text-sm font-medium text-white focus:outline-none focus-visible:ring focus-visible:ring-opacity-75">
                    <span>Incoming Emails</span>
                    {open ? (
                      <ChevronUpIcon className="h-4 w-4 text-white" />
                    ) : (
                      <ChevronDownIcon className="h-4 w-4 text-white" />
                    )}
                  </Disclosure.Button>
                  <Disclosure.Panel className="mt-2 space-y-2">
                    <div className="relative border-b-2">
                      <svg
                        className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z"
                        ></path>
                      </svg>
                      <input
                        type="text"
                        placeholder="Search Incoming Emails..."
                        value={incomingSearch}
                        onChange={(e) => setIncomingSearch(e.target.value)}
                        className="w-full rounded-md border-gray-500 border-transparent bg-charleston p-2 pl-10 text-sm text-white placeholder-gray-400 focus:border-primary focus:ring-0"
                      />
                    </div>
                    <div className="overflow-x-auto">
                      <DataTable
                        keyField="id"
                        columns={incomingEmailColumns}
                        data={filteredIncomingEmails}
                        pagination
                        fixedHeader
                        fixedHeaderScrollHeight="400px"
                        customStyles={customStyles}
                        noDataComponent={
                          <div className="text-center text-white">
                            There are no incoming emails to display.
                          </div>
                        }
                        defaultSortFieldId="date"
                        defaultSortAsc={false}
                      />
                    </div>
                  </Disclosure.Panel>
                </>
              )}
            </Disclosure>
          </div>

          {/* Email Preview Modal */}
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
                  <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-50" />
                </Transition.Child>
                <div className="flex min-h-screen items-center justify-center p-4 text-center">
                  <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                    enterTo="opacity-100 translate-y-0 sm:scale-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                    leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                  >
                    <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-lg bg-[#1f1f1f] text-left align-middle shadow-xl transition-all">
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-gray-700 p-4">
                        <div className="flex items-center space-x-2">
                          <button
                            className="text-gray-400 hover:text-white"
                            onClick={() => setIsPreviewOpen(false)}
                          >
                            <ArrowLeftIcon className="h-5 w-5" />
                          </button>
                          <Dialog.Title
                            as="h3"
                            className="text-lg font-semibold text-white"
                          >
                            {selectedEmail.subject}
                          </Dialog.Title>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            className="text-gray-400 hover:text-white"
                            onClick={() => setIsPreviewOpen(false)}
                          >
                            <XMarkIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                      {/* Email Body */}
                      <div className="space-y-4 p-6">
                        <div className="flex flex-col space-y-1">
                          {selectedEmail.from &&
                          organizationName &&
                          selectedEmail.from.includes(organizationName) ? (
                            <span className="text-sm text-gray-400">
                              To: {selectedEmail.to.join(", ")}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">
                              From: {selectedEmail.from}
                            </span>
                          )}
                          <span className="text-xs text-gray-500">
                            {new Date(selectedEmail.date).toLocaleString()}
                          </span>
                        </div>
                        {/* ### Step 2: Update Email Content Rendering to Use Plain Text ### */}
                        <div className="whitespace-pre-wrap text-white">
                          {selectedEmail.htmlContent
                            ? extractTextFromHtml(selectedEmail.htmlContent)
                            : selectedEmail.body}
                        </div>
                        {selectedEmail.attachments.length > 0 && (
                          <div className="mt-6">
                            <h4 className="text-md mb-2 font-semibold text-white">
                              Attachments:
                            </h4>
                            <ul className="list-inside list-disc space-y-1">
                              {selectedEmail.attachments.map((attachment, index) => (
                                <li key={index}>
                                  <a
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:underline"
                                  >
                                    {attachment.filename}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      {/* Footer Actions */}
                      <div className="flex justify-end border-t border-gray-700 p-4">
                        <button
                          type="button"
                          className="hover:bg-primary-dark focus:ring-primary-light inline-flex justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2"
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
        </>
      )}
    </div>
  );
};

export default Emails;
