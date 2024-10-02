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
import Swal from "sweetalert2";

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
  header: {
    style: {
      backgroundColor: "rgb(36, 36, 36)",
      color: "rgb(255, 255, 255)",
    },
  },
  subHeader: {
    style: {
      backgroundColor: "none",
      color: "rgb(255, 255, 255)",
      padding: 0,
      marginBottom: 10,
    },
  },
  rows: {
    style: {
      minHeight: "6vh",
      backgroundColor: "rgb(33, 33, 33)",
      color: "rgb(255, 255, 255)",
      "&:hover": { backgroundColor: "rgb(36, 36, 36)" },
    },
  },
  headCells: {
    style: {
      backgroundColor: "rgb(36, 36, 36)",
      color: "rgb(255, 255, 255)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      padding: "8px",
    },
  },
  cells: {
    style: {
      backgroundColor: "rgb(33, 33, 33)",
      color: "rgb(255, 255, 255)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      padding: "8px",
    },
  },
  pagination: {
    style: {
      backgroundColor: "rgb(33, 33, 33)",
      color: "rgb(255, 255, 255)",
      justifyContent: "center",
    },
  },
  noData: {
    style: {
      backgroundColor: "transparent",
      color: "rgb(255, 255, 255)",
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

  const [hasPermission, setHasPermission] = useState(false);
  const [editorState, setEditorState] = useState("");
  const [subject, setSubject] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<CombinedUserData[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<Event[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [eventsSearch, setEventsSearch] = useState("");
  const [usersSearch, setUsersSearch] = useState("");

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => setAttachments((prev) => [...prev, ...acceptedFiles]),
  });

  useEffect(() => {
    async function checkUserPermissions() {
      const permission = await check_permissions(
        organizationId,
        "send_newsletters",
        user?.id || ""
      );
      setHasPermission(permission);
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
        Swal.fire("Error", "At least one recipient is required", "error");
        return false;
      }

      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        Swal.fire("Validation Error", err.errors.map((e) => e.message).join(", "), "error");
      }
      return false;
    }
  };

  const handleSendNewsletter = async () => {
    if (!validateForm()) return;

    setSending(true);
    try {
      const selectedEventUsers = await Promise.all(
        selectedEvents.map((event) => fetchMembersByEvent(event.eventid))
      ).then((results) => results.flat());

      const combinedUsers = [...selectedUsers, ...selectedEventUsers];
      const uniqueUsers = combinedUsers.filter(
        (user, index, self) => index === self.findIndex((t) => t.email === user.email)
      );

      if (uniqueUsers.length === 0) {
        Swal.fire("Error", "At least one recipient is required.", "error");
        setSending(false);
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
        Swal.fire("Success", "Newsletter sent successfully!", "success");
        setAttachments([]);
        setSubject("");
        setEditorState("");
        setSelectedUsers([]);
        setSelectedEvents([]);
      } else {
        Swal.fire("Error", "Failed to send newsletter.", "error");
      }
    } catch (error: any) {
      Swal.fire("Error", error.response?.data?.message || "Failed to send newsletter.", "error");
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
      width: "150px",
    },
    {
      name: "Location",
      selector: (row: Event) => row.location,
      sortable: true,
      id: "location",
      width: "120px",
    },
    {
      name: "Date",
      selector: (row: Event) => new Date(row.starteventdatetime).toLocaleDateString(),
      sortable: true,
      id: "startDate",
      width: "140px",
    },
  ];

  const userColumns: TableColumn<CombinedUserData>[] = [
    {
      name: "Email",
      selector: (row: CombinedUserData) => row.email || "",
      sortable: true,
      id: "email",
      width: "200px",
    },
    {
      name: "First Name",
      selector: (row: CombinedUserData) => row.first_name || "",
      sortable: true,
      id: "firstName",
      width: "120px",
    },
    {
      name: "Last Name",
      selector: (row: CombinedUserData) => row.last_name || "",
      sortable: true,
      id: "lastName",
      width: "120px",
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
    <div className="p-4 bg-[#1f1f1f] rounded-lg shadow-lg max-w-6xl mx-auto">
      {!hasPermission ? (
        <div className="text-red-500 text-center text-lg font-semibold">
          You do not have permission to send newsletters.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="flex flex-col space-y-4">
              <input
                className="w-full p-3 rounded border bg-charleston text-sm text-white placeholder-gray-400 focus:border-primary focus:ring focus:ring-primary-light"
                type="text"
                placeholder="Subject*"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <RichTextEditor
                value={editorState}
                onChange={setEditorState}
                className="rounded border border-primary text-white p-3 h-40"
                styles={{
                  root: {
                    backgroundColor: "#2a2a2a",
                    color: "#ffffff",
                    "&:hover": {
                      backgroundColor: "#3a3a3a",
                    },
                  },
                  toolbar: { backgroundColor: "#2a2a2a", borderColor: "#444444", padding: "4px" },
                  toolbarControl: {
                    backgroundColor: "#2a2a2a",
                    "&:hover": {
                      backgroundColor: "#3a3a3a",
                    },
                  },
                }}
              />
              <div>
                <h2 className="text-md font-semibold text-white">Attachments</h2>
                <div
                  {...getRootProps()}
                  className={`mt-2 cursor-pointer rounded border-2 border-dashed p-4 text-center text-sm text-gray-400 ${
                    isDragActive ? "border-primary text-primary" : "border-gray-500"
                  }`}
                >
                  <input {...getInputProps()} />
                  {isDragActive ? (
                    <p>Drop the files here...</p>
                  ) : (
                    <p>Drag & drop files here, or click to select files</p>
                  )}
                </div>
                {attachments.length > 0 && (
                  <div className="mt-2">
                    <h3 className="text-sm font-medium text-white">Selected Attachments:</h3>
                    <ul className="mt-1 space-y-1">
                      {attachments.map((file, index) => (
                        <li
                          key={index}
                          className="flex justify-between items-center p-2 rounded bg-gray-700"
                        >
                          <span className="text-sm text-white">{file.name}</span>
                          <button
                            onClick={() => removeAttachment(index)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={handleSendNewsletter}
                  className="w-40 rounded bg-primary py-2 text-sm text-white hover:bg-primary-dark focus:outline-none focus:ring focus:ring-primary-light disabled:opacity-50"
                  disabled={sending}
                >
                  {sending ? "Sending..." : "Send Newsletter"}
                </button>
              </div>
            </div>
            <div className="flex flex-col space-y-4 bg-[#2a2a2a] p-4 rounded-lg">
              <h2 className="text-lg font-semibold text-white">Select Recipients</h2>
              <Disclosure>
                {({ open }) => (
                  <>
                    <Disclosure.Button className="flex justify-between items-center w-full px-3 py-2 text-left text-sm font-medium rounded bg-[#333333] text-white focus:outline-none focus-visible:ring focus-visible:ring-opacity-75">
                      <span>Events</span>
                      {open ? (
                        <ChevronUpIcon className="w-4 h-4 text-white" />
                      ) : (
                        <ChevronDownIcon className="w-4 h-4 text-white" />
                      )}
                    </Disclosure.Button>
                    <Disclosure.Panel className="mt-2 space-y-2">
                      <input
                        type="text"
                        placeholder="Search Events..."
                        value={eventsSearch}
                        onChange={(e) => setEventsSearch(e.target.value)}
                        className="w-full p-2 rounded border bg-charleston text-sm text-white placeholder-gray-400 focus:border-primary focus:ring focus:ring-primary-light"
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
                          fixedHeaderScrollHeight="200px"
                          customStyles={customStyles}
                          noDataComponent={<div className="text-center">No events found.</div>}
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
                    <Disclosure.Button className="flex justify-between items-center w-full px-3 py-2 text-left text-sm font-medium rounded bg-[#333333] text-white focus:outline-none focus-visible:ring focus-visible:ring-opacity-75">
                      <span>Individual Users</span>
                      {open ? (
                        <ChevronUpIcon className="w-4 h-4 text-white" />
                      ) : (
                        <ChevronDownIcon className="w-4 h-4 text-white" />
                      )}
                    </Disclosure.Button>
                    <Disclosure.Panel className="mt-2 space-y-2">
                      <input
                        type="text"
                        placeholder="Search Users..."
                        value={usersSearch}
                        onChange={(e) => setUsersSearch(e.target.value)}
                        className="w-full p-2 rounded border bg-charleston text-sm text-white placeholder-gray-400 focus:border-primary focus:ring focus:ring-primary-light"
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
                          fixedHeaderScrollHeight="200px"
                          customStyles={customStyles}
                          noDataComponent={<div className="text-center">No users found.</div>}
                          defaultSortFieldId="email"
                          defaultSortAsc={false}
                        />
                      </div>
                    </Disclosure.Panel>
                  </>
                )}
              </Disclosure>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NewsletterCreation;
