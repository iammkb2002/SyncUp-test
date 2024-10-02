// File: src/components/NewsletterCreation.tsx

"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Event } from "@/types/event";
import { CombinedUserData } from "@/types/combined_user_data";
import DataTable, { TableColumn, TableStyles } from "react-data-table-component";
import dynamic from "next/dynamic";
import { Disclosure } from "@headlessui/react";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/20/solid";
import { z } from "zod";
import axios from "axios";
import { useDropzone } from "react-dropzone";
import { fetchMembersByEvent } from "@/lib/newsletter_actions";
import { check_permissions } from "@/lib/newsletter_actions"; // Add this import

const RichTextEditor = dynamic(() => import("@mantine/rte"), { ssr: false });

interface NewsletterCreationProps {
  organizationName: string;
  organizationSlug: string;
  events: Event[];
  users: CombinedUserData[];
  eventsLoading: boolean;
  usersLoading: boolean;
}

const newsletterSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  content: z.string().min(1, "Content is required"),
});

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

const NewsletterCreation: React.FC<NewsletterCreationProps> = ({
  organizationName,
  organizationSlug,
  events,
  users,
  eventsLoading,
  usersLoading,
}) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [editorState, setEditorState] = useState("");
  const [subject, setSubject] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<CombinedUserData[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<Event[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string | null>(null);
  const [eventsSearch, setEventsSearch] = useState("");
  const [usersSearch, setUsersSearch] = useState("");

  useEffect(() => {
    async function checkUserPermissions() {
      const permission = await check_permissions(
        "",
        organizationSlug,
        "send_newsletters"
      );
      setHasPermission(permission);
    }
    checkUserPermissions();
  }, [organizationSlug]);

  if (!hasPermission) {
    return (
      <div className="text-red-500">You do not have permission to send newsletters.</div>
    );
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => setAttachments((prev) => [...prev, ...acceptedFiles]),
  });

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

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
      formData.append("fromName", organizationName);
      formData.append("replyToExtension", organizationSlug);
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
        setSubject("");
        setEditorState("");
        setSelectedUsers([]);
        setSelectedEvents([]);
      } else {
        setErrorMessage("Failed to send newsletter.");
      }
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || "Failed to send newsletter.");
    } finally {
      setSending(false);
    }
  };

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
    <div>
      <h1 className="border-b-2 border-primary pb-4 text-3xl">Newsletter Creation</h1>

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
                  onSelectedRowsChange={(state) => setSelectedEvents(state.selectedRows)}
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
                  onSelectedRowsChange={(state) => setSelectedUsers(state.selectedRows)}
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
        <div className="mt-4 rounded bg-red-100 p-4 text-red-500">{validationErrors}</div>
      )}
      {successMessage && (
        <div className="mt-4 rounded bg-green-100 p-4 text-green-500">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mt-4 rounded bg-red-100 p-4 text-red-500">{errorMessage}</div>
      )}
    </div>
  );
};

export default NewsletterCreation;
