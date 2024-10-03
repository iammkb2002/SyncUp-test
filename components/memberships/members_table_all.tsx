"use client";

import React, { useEffect, useMemo, useState, Fragment } from "react";
import { Organization } from "@/types/organization";
import DataTable, { TableColumn } from "react-data-table-component";
import { useDebounce } from "use-debounce";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/20/solid";
import Swal from "sweetalert2";
import { createClient } from "@/lib/supabase/client";
import { getUser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Preloader from "@/components/preloader";
import ActivityFeed from "@/components/activity_feed";
import { Activity } from "@/types/activities";
import { isActiveMember } from "@/lib/track";

const supabase = createClient();

interface OrganizationMember {
  organizationmemberid: string;
  organizationid: string;
  userid: string;
  membershipid: string | null;
  roleid: string;
  joindate: string;
  enddate: string | null;
  expiration_date: string | null;
  organization_slug: string;
  organization: any;
  user: {
    gender: string;
    userid: string;
    company: string;
    website: string;
    last_name: string;
    updatedat: string;
    first_name: string;
    dateofbirth: string | null;
    description: string;
    profilepicture: string;
  };
  membership: {
    name: string | null;
    features: any | null;
    description: string | null;
    membershipid: string | null;
    yearlydiscount: number | null;
    registrationfee: number | null;
  };
  role: {
    role: string;
    color: string;
    roleid: string;
    editable: boolean;
    deletable: boolean;
  };
  payments?: {
    type: string;
    amount: number;
    status: string;
    invoiceId: string;
    paymentId: string;
    created_at: string;
    invoiceUrl: string;
  }[];
}

interface MemberTableData extends OrganizationMember {
  open: boolean;
  setOpen: (open: boolean) => void;
  status: 'Active' | 'Inactive';
}

interface MembersTableAllProps {
  members: OrganizationMember[];
  organizations: Organization[];
}

const MembersTableAll: React.FC<MembersTableAllProps> = ({
  members,
  organizations,
}) => {
  const [tableData, setTableData] = useState<MemberTableData[]>([]);
  const [filterText, setFilterText] = useState<string>("");
  const [debouncedFilterText] = useDebounce(filterText, 300);
  const [selectedOrganization, setSelectedOrganization] = useState<string>("All");
  const [filteredOrganization, setFilteredOrganization] = useState<string>("All");
  const [isMounted, setIsMounted] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberTableData | null>(
    null
  );
  const router = useRouter();
  const [userActivities, setUserActivities] = useState<Activity[]>([]);

  useEffect(() => {
    const fetchMemberStatus = async () => {
      setIsMounted(true);
      if (members.length) {
        const data = await Promise.all(members.map(async (member) => {
          const isActive = await isActiveMember(member.userid, member.organizationid);
          return {
            ...member,
            status: isActive ? 'Active' : 'Inactive',
            open: false,
            setOpen: (open: boolean) => {
              setTableData((prevData) =>
                prevData.map((item) =>
                  item.organizationmemberid === member.organizationmemberid
                    ? { ...item, open }
                    : item
                )
              );
            },
          };
        }));
        setTableData(data as MemberTableData[]);
      }
    };

    fetchMemberStatus();
  }, [members]);

  useEffect(() => {
    if (selectedMember) {
      fetchUserActivities(selectedMember.userid);
    }
  }, [selectedMember]);

  const fetchUserActivities = async (userId: string) => {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error fetching user activities:", error);
    } else {
      setUserActivities(data || []);
    }
  };

  // Define the columns including the new "Organization" column
  const columns: TableColumn<MemberTableData>[] = [
    {
      name: "Name",
      selector: (row: MemberTableData) =>
        `${row.user.first_name} ${row.user.last_name}`,
      sortable: true,
    },
    {
      name: "Role",
      selector: (row: MemberTableData) => row.role.role,
      sortable: true,
      cell: (row: MemberTableData) => (
        <span
          className={`border-2 rounded-2xl px-4 py-1 text-xs`}
          style={{
            borderColor: row.role.color,
            backgroundColor: `${row.role.color}33`,
            color: row.role.color,
          }}
        >
          {row.role.role}
        </span>
      ),
    },
    {
      name: "Organization",
      selector: (row: MemberTableData) =>
        organizations.find((org) => org.organizationid === row.organizationid)
          ?.name || "N/A",
      sortable: true,
    },
    {
      name: "Join Date",
      selector: (row: MemberTableData) => row.joindate,
      sortable: true,
      cell: (row: MemberTableData) =>
        new Date(row.joindate).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "numeric",
          hour12: true,
        }),
    },
    {
      name: "Membership",
      selector: (row: MemberTableData) => row.membership.name ?? "N/A",
      sortable: true,
    },
    {
      name: "Status",
      selector: (row: MemberTableData) => row.status,
      sortable: true,
      cell: (row: MemberTableData) => (
        <span
          className={`w-20 text-center bg-charleston cursor-pointer rounded-2xl border-2 px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-primar ${
            row.status === 'Active' ? 'bg-green-600/25 text-green-300 border-green-700 focus:border-green-700 focus:outline-none focus:ring-green-700' : 'bg-red-600/25 text-red-300 border-red-700  focus:border-red-700 focus:outline-none focus:ring-red-700'
          }`}
        >
          {row.status}
        </span>
      ),
    },
  ];

  const handleRowClick = (row: MemberTableData) => {
    setSelectedMember(row);
  };

  // Filter data based on search text and selected organization
  const filteredData = useMemo(() => {
    return tableData.filter((item) => {
      const matchesSearch =
        !debouncedFilterText ||
        `${item.user.first_name} ${item.user.last_name}`
          .toLowerCase()
          .includes(debouncedFilterText.toLowerCase());

      const matchesOrganization =
        selectedOrganization === "All" ||
        item.organizationid === selectedOrganization;

      return matchesSearch && matchesOrganization;
    });
  }, [debouncedFilterText, selectedOrganization, tableData]);

  const subHeaderComponent = (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full">
      {/* Search Bar */}
      <input
        type="text"
        placeholder="Search by name..."
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        className="block rounded-md border border-[#525252] bg-charleston px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm mb-2 sm:mb-0"
      />

      {/* Organization Dropdown */}
      <select
        value={selectedOrganization}
        onChange={(e) => setSelectedOrganization(e.target.value)}
        className="block rounded-md border border-[#525252] bg-charleston px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
      >
        <option value="All">All Organizations</option>
        {organizations.map((org) => (
          <option key={org.organizationid} value={org.organizationid}>
            {org.name}
          </option>
        ))}
      </select>
    </div>
  );

  const handleRemoveMember = async (
    organizationMemberId: string,
    userId: string,
    role: string
  ) => {
    const { user } = await getUser(); // Get the currently logged-in user

    // Check if the member is the owner or the current user
    if (role === "Owner") {
      Swal.fire({
        title: "Failed!",
        text: "You can't remove a member with the Owner role.",
        icon: "error",
      });
      return;
    }

    if (user?.id === userId) {
      Swal.fire({
        title: "Failed!",
        text: "You can't remove your own account.",
        icon: "error",
      });
      return;
    }

    // Show a confirmation dialog
    const confirmResult = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, remove member!",
    });

    if (confirmResult.isConfirmed) {
      try {
        // Call Supabase to remove the member
        const { error } = await supabase
          .from("organizationmembers")
          .delete()
          .eq("organizationmemberid", organizationMemberId);

        if (error) {
          throw new Error(error.message);
        }

        Swal.fire(
          "Removed!",
          "The member has been removed from the organization.",
          "success"
        );

        // Update the table data
        setTableData((prevData) =>
          prevData.filter(
            (member) => member.organizationmemberid !== organizationMemberId
          )
        );
        setSelectedMember(null);

        // Refresh the page to get updated data from the server
        router.refresh();
      } catch (error) {
        Swal.fire({
          title: "Error!",
          text: "There was an error removing the member: " + (error as Error).message,
          icon: "error",
        });
      }
    }
  };

  if (!isMounted) {
    return <Preloader />;
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-base font-semibold leading-6 text-light">
            Organization Members
          </h1>
          <p className="mt-2 text-sm text-light">
            A list of all the members across organizations including their name, role,
            join date, and membership details.
          </p>
        </div>
      </div>
      <div className="mt-8">
        {tableData.length > 0 ? (
          <DataTable
            columns={columns}
            data={filteredData}
            pagination
            highlightOnHover
            subHeader
            subHeaderComponent={subHeaderComponent}
            customStyles={{
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
                },
              },
              headCells: {
                style: {
                  backgroundColor: "rgb(36, 36, 36)",
                  color: "rgb(255, 255, 255)",
                },
              },
              cells: {
                style: {
                  backgroundColor: "rgb(33, 33, 33)",
                  color: "rgb(255, 255, 255)",
                },
              },
              pagination: {
                style: {
                  backgroundColor: "rgb(33, 33, 33)",
                  color: "rgb(255, 255, 255)",
                },
              },
            }}
            onRowClicked={(row) => handleRowClick(row as MemberTableData)}
            pointerOnHover
          />
        ) : (
          <Preloader />
        )}
      </div>

      {/* Member Details Dialog */}
      <Transition.Root show={!!selectedMember} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setSelectedMember(null)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-in-out duration-500"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in-out duration-500"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
              <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
                <Transition.Child
                  as={Fragment}
                  enter="transform transition ease-in-out duration-500 sm:duration-700"
                  enterFrom="translate-x-full"
                  enterTo="translate-x-0"
                  leave="transform transition ease-in-out duration-500 sm:duration-700"
                  leaveFrom="translate-x-0"
                  leaveTo="translate-x-full"
                >
                  <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                    <div className="flex h-full flex-col overflow-y-scroll bg-eerieblack py-6 shadow-xl">
                      <div className="px-4 sm:px-6">
                        <div className="flex items-start justify-between">
                          <Dialog.Title className="text-xl font-semibold leading-6 text-light">
                            Member Details
                          </Dialog.Title>
                          <div className="ml-3 flex h-7 items-center">
                            <button
                              type="button"
                              className="rounded-md text-gray-400 hover:text-light focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                              onClick={() => setSelectedMember(null)}
                            >
                              <span className="sr-only">Close panel</span>
                              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="relative mt-6 flex-1 px-4 sm:px-6">
                        {selectedMember && (
                          <div className="space-y-6">
                            {/* Personal Information */}
                            <div className="rounded-lg bg-charleston p-4">
                              <h3 className="mb-2 text-lg font-medium text-light">
                                Personal Information
                              </h3>
                              <div className="space-y-2 text-gray-300">
                                <p>
                                  <span className="font-semibold">Name:</span>{" "}
                                  {selectedMember.user.first_name}{" "}
                                  {selectedMember.user.last_name}
                                </p>
                                <p>
                                  <span className="font-semibold">Gender:</span>{" "}
                                  {selectedMember.user.gender}
                                </p>
                                <p>
                                  <span className="font-semibold">Date of Birth:</span>{" "}
                                  {selectedMember.user.dateofbirth || "N/A"}
                                </p>
                                <p>
                                  <span className="font-semibold">Company:</span>{" "}
                                  {selectedMember.user.company}
                                </p>
                                <p>
                                  <span className="font-semibold">Website:</span>{" "}
                                  {selectedMember.user.website}
                                </p>
                                <p>
                                  <span className="font-semibold">Description:</span>{" "}
                                  {selectedMember.user.description}
                                </p>
                              </div>
                            </div>

                            {/* Organization Details */}
                            <div className="rounded-lg bg-charleston p-4">
                              <h3 className="mb-2 text-lg font-medium text-light">
                                Organization Details
                              </h3>
                              <div className="space-y-2 text-gray-300">
                                <p>
                                  <span className="font-semibold">Role:</span>{" "}
                                  {selectedMember.role.role}
                                </p>
                                <p>
                                  <span className="font-semibold">Join Date:</span>{" "}
                                  {new Date(selectedMember.joindate).toLocaleString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                      hour: "numeric",
                                      minute: "numeric",
                                      hour12: true,
                                    }
                                  )}
                                </p>
                                <p>
                                  <span className="font-semibold">End Date:</span>{" "}
                                  {selectedMember.enddate
                                    ? new Date(selectedMember.enddate).toLocaleString(
                                        "en-US",
                                        {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                          hour: "numeric",
                                          minute: "numeric",
                                          hour12: true,
                                        }
                                      )
                                    : "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Membership Information */}
                            <div className="rounded-lg bg-charleston p-4">
                              <h3 className="mb-2 text-lg font-medium text-light">
                                Membership Information
                              </h3>
                              {selectedMember.membership.name ? (
                                <div className="rounded-lg p-3">
                                  <h3 className="text-xl font-semibold text-light">
                                    {selectedMember.membership.name}
                                  </h3>
                                  <p className="mt-2 text-gray-400">
                                    {selectedMember.membership.description}
                                  </p>
                                  <hr className="my-4 border-gray-600" />
                                  <div className="mt-4 space-y-2">
                                    <div className="flex justify-between">
                                      <span className="font-semibold text-gray-300">
                                        Yearly Discount:
                                      </span>
                                      <span className="text-light">
                                        {selectedMember.membership.yearlydiscount}%
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="font-semibold text-gray-300">
                                        Registration Fee:
                                      </span>
                                      <span className="text-light">
                                        ₱{selectedMember.membership.registrationfee}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="font-semibold text-gray-300">
                                        Expiration Date:
                                      </span>
                                      <span className="text-light">
                                        {selectedMember.expiration_date
                                          ? new Date(
                                              selectedMember.expiration_date
                                            ).toLocaleString("en-US", {
                                              month: "short",
                                              day: "numeric",
                                              year: "numeric",
                                              hour: "numeric",
                                              minute: "numeric",
                                              hour12: true,
                                            })
                                          : "No Expiration"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-gray-300">No Membership</p>
                              )}
                            </div>

                            {/* Payment History */}
                            <div className="rounded-lg bg-charleston p-4">
                              <h3 className="mb-4 text-lg font-medium text-light">
                                Payment History
                              </h3>
                              {selectedMember.payments &&
                              selectedMember.payments.length > 0 ? (
                                <div className="space-y-4">
                                  {selectedMember.payments.map((payment) => (
                                    <a
                                      key={payment.paymentId}
                                      href={payment.invoiceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block rounded-lg bg-eerieblack p-4 transition-colors duration-200 hover:bg-opacity-80"
                                    >
                                      <div className="mb-2 flex items-center justify-between">
                                        <span className="text-sm font-semibold text-gray-300">
                                          {payment.invoiceId}
                                        </span>
                                        <span
                                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                                            payment.status === "COMPLETED"
                                              ? "bg-green-800 text-green-200"
                                              : "bg-yellow-800 text-yellow-200"
                                          }`}
                                        >
                                          {payment.status}
                                        </span>
                                      </div>
                                      <div className="mb-1 flex items-center justify-between">
                                        <span className="text-lg font-bold text-light">
                                          ${payment.amount}
                                        </span>
                                        <span className="text-sm capitalize text-gray-400">
                                          {payment.type}
                                        </span>
                                      </div>
                                      <div className="text-xs text-gray-400">
                                        {new Date(payment.created_at).toLocaleString(
                                          "en-US",
                                          {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                            hour: "numeric",
                                            minute: "numeric",
                                            hour12: true,
                                          }
                                        )}
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-gray-300">
                                  No payment history available
                                </p>
                              )}
                            </div>

                            {/* User Activities Section */}
                            <div className="rounded-lg bg-charleston p-4">
                              <h3 className="mb-4 text-lg font-medium text-light">
                                Recent Activities
                              </h3>
                              {userActivities.length > 0 ? (
                                <ActivityFeed activities={userActivities} />
                              ) : (
                                <p className="text-gray-300">
                                  No recent activities available
                                </p>
                              )}
                            </div>

                            {/* Remove Member Button */}
                            <div className="mt-6">
                              <button
                                onClick={() =>
                                  handleRemoveMember(
                                    selectedMember.organizationmemberid,
                                    selectedMember.userid,
                                    selectedMember.role.role
                                  )
                                }
                                className="w-full rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                              >
                                Remove Member
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  );
};

export default MembersTableAll;
