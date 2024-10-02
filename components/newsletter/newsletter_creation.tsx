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
import { fetchMembersByEvent, check_permissions } from "@/lib/newsletter_actions";
import { useUser } from "@/context/user_context";

const RichTextEditor = dynamic(() => import("@mantine/rte"), { ssr: false });

interface NewsletterCreationProps {
  organizationName: string;
  organizationId: string;
  events: Event[];
  users: CombinedUserData[];
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
  organizationId,
  events,
  users,
}) => {
  const { user } = useUser();

  // Call Hooks unconditionally
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

  // Ensure useDropzone is called on every render
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => setAttachments((prev) => [...prev, ...acceptedFiles]),
  });

  useEffect(() => {
    async function checkUserPermissions() {
      console.log("Checking user permissions... ", user?.id, organizationId);
      const permission = await check_permissions(
        organizationId,
        "send_newsletters",
        user?.id || ""
      );
      setHasPermission(permission);
      console.log("User has permission to send newsletters: ", permission);
    }
    checkUserPermissions();
  }, [user, organizationId]);

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
      formData.append("replyToExtension", organizationId);
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
    <div className="p-6 bg-[#1f1f1f] rounded-lg shadow-lg max-w-4xl mx-auto">
      {/* Conditionally render the permission message */}
      {!hasPermission ? (
        <div className="text-red-500 text-center text-xl font-semibold">
          You do not have permission to send newsletters.
        </div>
      ) : (
        <>
          <input
            className="w-full mb-6 p-4 rounded-lg border bg-charleston text-base text-white placeholder-gray-400 focus:border-primary focus:ring focus:ring-primary-light"
            type="text"
            placeholder="Subject*"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
  
          <RichTextEditor
            value={editorState}
            onChange={setEditorState}
            className="rounded-lg border border-primary text-white p-4"
            styles={{
              root: {
                backgroundColor: "#2a2a2a",
                color: "#ffffff",
                "&:hover": {
                  backgroundColor: "#3a3a3a",
                },
              },
              toolbar: { backgroundColor: "#2a2a2a", borderColor: "#444444" },
              toolbarControl: {
                backgroundColor: "#2a2a2a",
                "&:hover": {
                  backgroundColor: "#3a3a3a",
                },
              },
            }}
          />
  
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-white">Attachments</h2>
            <div
              {...getRootProps()}
              className={`mt-4 cursor-pointer rounded-lg border-2 border-dashed p-6 text-center text-gray-400 ${
                isDragActive ? "border-primary text-primary" : "border-gray-500"
              }`}
            >
              <input {...getInputProps()} />
              {isDragActive ? (
                <p>Drop the files here ...</p>
              ) : (
                <p>Drag & drop some files here, or click to select files</p>
              )}
            </div>
  
            {attachments.length > 0 && (
              <div className="mt-4">
                <h3 className="text-lg font-medium text-white">Selected Attachments:</h3>
                <ul className="mt-2 space-y-2">
                  {attachments.map((file, index) => (
                    <li key={index} className="flex justify-between items-center p-2 rounded bg-gray-700">
                      <span className="text-white">{file.name}</span>
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
  
          <h2 className="mt-10 text-2xl text-white border-b-2 border-primary pb-2">Select Recipients</h2>
  
          <Disclosure>
            {({ open }) => (
              <>
                <Disclosure.Button className="flex justify-between w-full px-4 py-2 mt-4 text-left text-lg font-medium rounded-lg bg-[#333333] text-white focus:outline-none focus-visible:ring focus-visible:ring-opacity-75">
                  <span>Events</span>
                  {open ? (
                    <ChevronUpIcon className="w-5 h-5 text-white" />
                  ) : (
                    <ChevronDownIcon className="w-5 h-5 text-white" />
                  )}
                </Disclosure.Button>
                <Disclosure.Panel className="px-4 pb-4 pt-4 text-sm text-gray-400">
                  <input
                    type="text"
                    placeholder="Search Events..."
                    value={eventsSearch}
                    onChange={(e) => setEventsSearch(e.target.value)}
                    className="mb-4 w-full rounded-lg border bg-charleston p-2 text-base text-white focus:border-primary"
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
                      fixedHeaderScrollHeight="300px"
                      customStyles={customStyles}
                      noDataComponent={<div>There are no records to display</div>}
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
                <Disclosure.Button className="mt-4 flex justify-between w-full px-4 py-2 text-left text-lg font-medium rounded-lg bg-[#333333] text-white focus:outline-none focus-visible:ring focus-visible:ring-opacity-75">
                  <span>Individual Users</span>
                  {open ? (
                    <ChevronUpIcon className="w-5 h-5 text-white" />
                  ) : (
                    <ChevronDownIcon className="w-5 h-5 text-white" />
                  )}
                </Disclosure.Button>
                <Disclosure.Panel className="px-4 pb-4 pt-4 text-sm text-gray-400">
                  <input
                    type="text"
                    placeholder="Search Users..."
                    value={usersSearch}
                    onChange={(e) => setUsersSearch(e.target.value)}
                    className="mb-4 w-full rounded-lg border bg-charleston p-2 text-base text-white focus:border-primary"
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
                      fixedHeaderScrollHeight="300px"
                      customStyles={customStyles}
                      noDataComponent={<div>There are no records to display</div>}
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
            className="mt-8 w-full rounded-lg bg-primary py-3 text-lg text-white hover:bg-primary-dark focus:outline-none focus:ring focus:ring-primary-light disabled:opacity-50"
            disabled={sending}
          >
            {sending ? "Sending..." : "Send Newsletter"}
          </button>
  
          {validationErrors && (
            <div className="mt-4 rounded-lg bg-red-100 p-4 text-red-500">
              {validationErrors}
            </div>
          )}
          {successMessage && (
            <div className="mt-4 rounded-lg bg-green-100 p-4 text-green-500">
              {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="mt-4 rounded-lg bg-red-100 p-4 text-red-500">
              {errorMessage}
            </div>
          )}
        </>
      )}
    </div>
  );
  
};

export default NewsletterCreation;
