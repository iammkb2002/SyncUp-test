"use client";

import { useUser } from "@/context/user_context";
import {
  fetchEventsByOrganization,
  fetchMembersByEvent,
  fetchMembersByOrganization,
  fetchOrganizationBySlug,
  check_permissions,
} from "@/lib/newsletter_actions";
import { Email } from "@/types/email";
import { Event } from "@/types/event";
import { CombinedUserData } from "@/types/combined_user_data";
import { useParams } from "next/navigation";
import React, { useEffect, useState, Fragment, useMemo, useRef } from "react";
import DataTable, { TableColumn } from "react-data-table-component";
import dynamic from "next/dynamic";
import { Disclosure, Dialog, Transition, Tab } from "@headlessui/react";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/20/solid";
import parse from "html-react-parser";
import { z } from "zod";
import axios from "axios";
import { useDropzone } from "react-dropzone";

const RichTextEditor = dynamic(() => import("@mantine/rte"), { ssr: false });

const newsletterSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  content: z.string().min(1, "Content is required"),
});

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export default function NewsletterPage() {
  const { user } = useUser();
  const params = useParams();
  const orgSlug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const [editorState, setEditorState] = useState("");
  const [subject, setSubject] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<CombinedUserData[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<CombinedUserData[]>([]);
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [incomingEmails, setIncomingEmails] = useState<Email[]>([]);
  const [sending, setSending] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<Event[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string | null>(null);
  const [outgoingSearch, setOutgoingSearch] = useState("");
  const [incomingSearch, setIncomingSearch] = useState("");
  const [eventsSearch, setEventsSearch] = useState("");
  const [usersSearch, setUsersSearch] = useState("");
  const [eventsLoading, setEventsLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [organizationName, setOrganizationName] = useState<string | null>(null);

  const emailsFetched = useRef(false);

  useEffect(() => {
    async function checkUserPermissions() {
      if (user && orgSlug) {
        const organization = await fetchOrganizationBySlug(orgSlug as string);
        if (organization) {
          setOrganizationName(organization.name);
          const hasPerm = await check_permissions(
            user?.id || "",
            organization.organizationid,
            "send_newsletters"
          );
          setHasPermission(!!hasPerm);
        } else {
          setHasPermission(false);
        }
      } else {
        setHasPermission(false);
      }
    }
    checkUserPermissions();
  }, [user, orgSlug]);

  useEffect(() => {
    async function fetchOrganization() {
      if (user && orgSlug) {
        const organization = await fetchOrganizationBySlug(orgSlug as string);
        return organization;
      }
    }

    async function fetchEvents(organizationId: string) {
      const eventsData = await fetchEventsByOrganization(organizationId);
      setEvents(eventsData);
    }

    async function fetchUsers(organizationId: string) {
      const usersData = await fetchMembersByOrganization(organizationId);
      setUsers(usersData);
    }

    async function fetchEmails(organizationName: string, organizationSlug: string) {
      if (!emailsFetched.current) {
        console.log(
          "Fetching emails for organization:",
          organizationName,
          "with slug:",
          organizationSlug
        );

        const emailsResponse = await axios.get(
          "/api/newsletter/fetch-newsletter-emails",
          {
            params: {
              organizationName,
              organizationSlug,
            },
          }
        );
        const allEmails: { emails: Email[] } = emailsResponse.data;
        console.log("Fetched emails:", allEmails);

        const sentEmailsData = allEmails.emails.filter((email: Email) =>
          email.from.includes(organizationName)
        );
        const incomingEmailsData = allEmails.emails.filter((email: Email) =>
          email.to.some(
            (addr) =>
              addr.includes(`${organizationSlug}@`) ||
              addr.endsWith(`${organizationSlug}@yourdomain.com`)
          )
        );
        console.log("Setting sent emails:", sentEmailsData);
        console.log("Setting incoming emails:", incomingEmailsData);

        setSentEmails(sentEmailsData);
        setIncomingEmails(incomingEmailsData);
        emailsFetched.current = true;
      }
    }

    async function fetchData() {
      setEventsLoading(true);
      setUsersLoading(true);
      setEmailsLoading(true);
      const organization = await fetchOrganization();
      if (organization) {
        await Promise.all([
          fetchEvents(organization.organizationid).finally(() => setEventsLoading(false)),
          fetchUsers(organization.organizationid).finally(() => setUsersLoading(false)),
          fetchEmails(organization.name, organization.slug).finally(() =>
            setEmailsLoading(false)
          ),
        ]);
      } else {
        setEventsLoading(false);
        setUsersLoading(false);
        setEmailsLoading(false);
      }
    }

    if (hasPermission) {
      fetchData();
    }
  }, [user, orgSlug, hasPermission]);

  const validateForm = () => {
    try {
      const formData = { subject, content: editorState };
      newsletterSchema.parse(formData);

      if (selectedUsers.length === 0 && selectedEvents.length === 0) {
        setValidationErrors("At least one recipient is required");
        return false;
      }

      setValidationErrors(null);
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        setValidationErrors(err.errors.map((e) => e.message).join(", "));
      }
      return false;
    }
  };

  const handleSendNewsletter = async () => {
    if (!validateForm()) return;

    setSending(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      if (user && orgSlug) {
        const organization = await fetchOrganizationBySlug(orgSlug as string);
        if (organization) {
          const selectedEventUsers = await Promise.all(
            selectedEvents.map((event) => fetchMembersByEvent(event.eventid))
          ).then((results) => results.flat());

          const combinedUsers = [...selectedUsers, ...selectedEventUsers];
          const uniqueUsers = combinedUsers.filter(
            (user, index, self) => index === self.findIndex((t) => t.email === user.email)
          );

          if (uniqueUsers.length === 0) {
            setErrorMessage("At least one recipient is required.");
            return;
          }

          const formData = new FormData();
          formData.append("fromName", organization.name);
          formData.append("replyToExtension", organization.slug);
          formData.append("recipients", JSON.stringify(uniqueUsers.map((u) => u.email)));
          formData.append("subject", subject);
          formData.append("message", editorState);
          attachments.forEach((file) => formData.append("attachments", file));

          const response = await axios.post(
            "/api/newsletter/send-newsletter-email",
            formData,
            {
              headers: { "Content-Type": "multipart/form-data" },
            }
          );

          if (response.status === 200) {
            setSuccessMessage("Newsletter sent successfully!");
            setAttachments([]);
          } else {
            setErrorMessage("Failed to send newsletter.");
          }
        }
      }
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || "Failed to send newsletter.");
    } finally {
      setSending(false);
    }
  };

  const openEmailPreview = (email: Email) => {
    setSelectedEmail(email);
    setIsPreviewOpen(true);
  };

  // Updated column definitions with fixed widths
  const eventColumns: TableColumn<Event>[] = [
    {
      name: "Title",
      selector: (row: Event) => row.title,
      sortable: true,
      id: "title",
      width: "200px",
    },
    {
      name: "Location",
      selector: (row: Event) => row.location,
      sortable: true,
      id: "location",
      width: "150px",
    },
    {
      name: "Date",
      selector: (row: Event) => new Date(row.starteventdatetime).toLocaleString(),
      sortable: true,
      id: "startDate",
      width: "180px",
    },
  ];

  const userColumns: TableColumn<CombinedUserData>[] = [
    {
      name: "Email",
      selector: (row: CombinedUserData) => row.email || "",
      sortable: true,
      id: "email",
      width: "250px",
    },
    {
      name: "First Name",
      selector: (row: CombinedUserData) => row.first_name || "",
      sortable: true,
      id: "firstName",
      width: "150px",
    },
    {
      name: "Last Name",
      selector: (row: CombinedUserData) => row.last_name || "",
      sortable: true,
      id: "lastName",
      width: "150px",
    },
  ];

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

  // Updated customStyles
  const customStyles = {
    table: {
      style: {
        tableLayout: "fixed" as "fixed",
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => setAttachments((prev) => [...prev, ...acceptedFiles]),
  });

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

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

  const filteredEvents = useMemo(() => {
    if (!eventsSearch) return events;
    return events.filter((event) =>
      Object.values(event).join(" ").toLowerCase().includes(eventsSearch.toLowerCase())
    );
  }, [events, eventsSearch]);

  const filteredUsers = useMemo(() => {
    if (!usersSearch) return users;
    return users.filter((user) =>
      Object.values(user).join(" ").toLowerCase().includes(usersSearch.toLowerCase())
    );
  }, [users, usersSearch]);

  return (
    <>
      {(hasPermission === null || hasPermission === false) && (
        <div
          className="flex h-screen items-center justify-center"
          style={{ backgroundColor: "#1c1c1c", color: "white" }}
        >
          <div
            className="rounded-lg p-6 text-center shadow-lg"
            style={{ backgroundColor: "#2c2c2c" }}
          >
            <p className="text-lg font-semibold">
              Checking permissions or you do not have permissions to send newsletters.
              Thank you for your patience!
            </p>
          </div>
        </div>
      )}
      {hasPermission === true && (
        <>
          <div className="bg-raisin mb-40 w-full max-w-full space-y-6 rounded-lg p-10 font-sans text-white">
            <h1 className="border-b-2 border-primary pb-4 text-3xl">
              Newsletter Creation
            </h1>

            <input
              className="w-full rounded border bg-charleston p-4 text-base focus:border-primary"
              type="text"
              placeholder="Subject*"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />

            <RichTextEditor
              value={editorState}
              onChange={setEditorState}
              className="rounded border border-primary p-2 text-white"
              styles={{
                root: {
                  backgroundColor: "#333333",
                  color: "#ffffff",
                  "&:hover": {
                    backgroundColor: "#444444",
                  },
                },
                toolbar: { backgroundColor: "#333333", borderColor: "#444444" },
                toolbarControl: {
                  backgroundColor: "#333333",
                  "&:hover": {
                    backgroundColor: "#444444",
                  },
                },
              }}
            />

            <div className="mt-6">
              <h2 className="mb-2 text-xl font-semibold">Attachments</h2>
              <div
                {...getRootProps()}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center ${
                  isDragActive ? "border-primary" : "border-gray-400"
                }`}
              >
                <input {...getInputProps()} />
                {isDragActive ? (
                  <p className="text-primary">Drop the files here ...</p>
                ) : (
                  <p>Drag & drop some files here, or click to select files</p>
                )}
              </div>

              {attachments.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-lg font-medium">Selected Attachments:</h3>
                  <ul className="mt-2">
                    {attachments.map((file, index) => (
                      <li
                        key={index}
                        className="mt-2 flex items-center justify-between rounded bg-gray-700 p-2"
                      >
                        <span>{file.name}</span>
                        <button
                          onClick={() => removeAttachment(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <h2 className="border-b-2 border-primary pb-4 text-2xl">Select Recipients</h2>

            <Disclosure>
              {({ open }) => (
                <>
                  <Disclosure.Button className="flex w-full justify-between rounded-lg bg-[#333333] px-4 py-2 text-left text-lg font-medium text-white focus:outline-none focus-visible:ring focus-visible:ring-opacity-75">
                    <span>Events</span>
                    {open ? (
                      <ChevronUpIcon className="h-5 w-5 text-white" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5 text-white" />
                    )}
                  </Disclosure.Button>
                  <Disclosure.Panel className="px-4 pb-2 pt-4 text-sm text-gray-200">
                    <input
                      type="text"
                      placeholder="Search Events..."
                      value={eventsSearch}
                      onChange={(e) => setEventsSearch(e.target.value)}
                      className="mb-4 w-full rounded border bg-charleston p-2 text-base focus:border-primary"
                    />
                    <div className="overflow-x-auto">
                      <DataTable
                        keyField="eventid"
                        columns={eventColumns}
                        data={filteredEvents}
                        selectableRows
                        onSelectedRowsChange={(state) =>
                          setSelectedEvents(state.selectedRows)
                        }
                        pagination
                        fixedHeader
                        fixedHeaderScrollHeight="400px"
                        customStyles={customStyles}
                        noDataComponent={<div>There are no records to display</div>}
                        progressPending={eventsLoading}
                        progressComponent={
                          <div className="w-full rounded bg-charleston p-2 text-center text-white">
                            Loading...
                          </div>
                        }
                        defaultSortFieldId="startDate"
                        defaultSortAsc={false}
                      />
                    </div>
                  </Disclosure.Panel>
                </>
              )}
            </Disclosure>

            <Disclosure>
              {({ open }) => (
                <>
                  <Disclosure.Button className="mt-4 flex w-full justify-between rounded-lg bg-[#333333] px-4 py-2 text-left text-lg font-medium text-white focus:outline-none focus-visible:ring focus-visible:ring-opacity-75">
                    <span>Individual Users</span>
                    {open ? (
                      <ChevronUpIcon className="h-5 w-5 text-white" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5 text-white" />
                    )}
                  </Disclosure.Button>
                  <Disclosure.Panel className="px-4 pb-2 pt-4 text-sm text-gray-200">
                    <input
                      type="text"
                      placeholder="Search Users..."
                      value={usersSearch}
                      onChange={(e) => setUsersSearch(e.target.value)}
                      className="mb-4 w-full rounded border bg-charleston p-2 text-base focus:border-primary"
                    />
                    <div className="overflow-x-auto">
                      <DataTable
                        keyField="email"
                        columns={userColumns}
                        data={filteredUsers}
                        selectableRows
                        onSelectedRowsChange={(state) =>
                          setSelectedUsers(state.selectedRows)
                        }
                        pagination
                        fixedHeader
                        fixedHeaderScrollHeight="400px"
                        customStyles={customStyles}
                        noDataComponent={<div>There are no records to display</div>}
                        progressPending={usersLoading}
                        progressComponent={
                          <div className="w-full rounded bg-charleston p-2 text-center text-white">
                            Loading...
                          </div>
                        }
                        defaultSortFieldId="email"
                        defaultSortAsc={false}
                      />
                    </div>
                  </Disclosure.Panel>
                </>
              )}
            </Disclosure>

            <button
              onClick={handleSendNewsletter}
              className="hover:bg-primary-dark mt-6 cursor-pointer rounded bg-primary px-6 py-3 text-lg text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={sending}
            >
              {sending ? "Sending..." : "Send Newsletter"}
            </button>

            {validationErrors && (
              <div className="mt-4 rounded bg-red-100 p-4 text-red-500">
                {validationErrors}
              </div>
            )}
            {successMessage && (
              <div className="mt-4 rounded bg-green-100 p-4 text-green-500">
                {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="mt-4 rounded bg-red-100 p-4 text-red-500">
                {errorMessage}
              </div>
            )}

            <h2 className="border-b-2 border-primary pb-4 text-2xl">Emails</h2>
            <Tab.Group>
              <Tab.List className="flex space-x-1 rounded-xl bg-[#333333] p-1">
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
                  Outgoing Emails
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
          </div>

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
                          <p className="text-sm text-gray-400">
                            From: {selectedEmail.from}
                          </p>
                        )}
                        <div className="prose prose-invert mt-4 max-w-full text-white">
                          {selectedEmail.htmlContent
                            ? parse(selectedEmail.htmlContent)
                            : parse(selectedEmail.body)}
                        </div>

                        {selectedEmail.attachments.length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-md font-semibold text-white">
                              Attachments:
                            </h4>
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
        </>
      )}
    </>
  );
}
