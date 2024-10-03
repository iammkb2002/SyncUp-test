"use client";
import Preloader from "@/components/preloader";
import { useEffect, useMemo, useState } from "react";
import DataTable, { TableColumn } from "react-data-table-component";
import MembershipOptions from "./membership_options";

interface Address {
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  country: string;
}

interface Socials {
  facebook: string;
  twitter: string;
  linkedin: string;
}

interface Member {
  id: number;
  gender: string | null;
  userid: string;
  company: string | null;
  website: string | null;
  last_name: string;
  updatedat: string;
  first_name: string;
  dateofbirth: string | null;
  description: string | null;
  profilepicture: string | null;
}

interface Membership {
  name: string;
  members: Member[];
  features: string[];
  description: string;
  membershipid: string;
  total_members: number;
  yearlydiscount: number;
  registrationfee: number;
  open?: boolean; // Make these properties optional
  setOpen?: (open: boolean) => void; // Make these properties optional
  orgname?: string; // Make these properties optional
}

interface OrganizationMembershipsView {
  organizationid: string;
  name: string;
  description: string;
  adminid: string;
  created_at: string;
  organization_type: string;
  industry: string;
  organization_size: string;
  website: string;
  date_established: string;
  address: Address;
  socials: Socials;
  slug: string;
  photo: string | null;
  banner: string | null;
  memberships: Membership[];
}

interface MembershipsTableProps {
  orgsMemView: OrganizationMembershipsView[];
}

export default function MembershipsTable({ orgsMemView = [] }: MembershipsTableProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [tableData, setTableData] = useState<Membership[]>([]);
  const [filterText, setFilterText] = useState<string>("");

  const organizations = useMemo(() => {
    return orgsMemView.map((org) => ({
      id: org.organizationid,
      name: org.name,
    }));
  }, [orgsMemView]);

  useEffect(() => {
    const filteredOrganizations = selectedOrgId
      ? orgsMemView.filter((org) => org.organizationid === selectedOrgId)
      : orgsMemView;

    const data = filteredOrganizations.flatMap((org) =>
      org.memberships.map((mem) => ({
        ...mem,
        orgname: org.name,
        organizationid: org.organizationid,
        open: mem.open ?? false,
        setOpen:
          mem.setOpen ??
          ((open: boolean) => {
            setTableData((prevData) => {
              const newData = [...prevData];
              const index = newData.findIndex(
                (item) => item.membershipid === mem.membershipid
              );
              if (index !== -1) {
                newData[index] = { ...newData[index], open };
              }
              return newData;
            });
          }),
      }))
    );

    setTableData(data);
  }, [orgsMemView, selectedOrgId]);

  const columns: TableColumn<Membership>[] = [
    {
      name: "Membership",
      selector: (row) => row.name,
      sortable: true,
    },
    {
      name: "Organization",
      selector: (row) => row.orgname || "",
      sortable: true,
      omit: selectedOrgId !== "",
    },
    {
      name: "Fee",
      selector: (row) =>
        row.registrationfee !== null && row.registrationfee !== undefined
          ? `$ ${row.registrationfee.toFixed(2)}`
          : "",
      sortable: true,
    },
    {
      name: "Members",
      selector: (row) => row.total_members,
      sortable: true,
    },
    {
      name: "",
      cell: (row) => (
        <MembershipOptions
          selectedTier={row}
          open={row.open ?? false}
          setOpen={row.setOpen ?? (() => {})}
          TierMembers={row.members || []}
        />
      ),
      button: true,
    },
  ];

  const filteredData = useMemo(
    () =>
      tableData.filter((item) => {
        if (!filterText) return true;
        return (
          item.name.toLowerCase().includes(filterText.toLowerCase()) ||
          (selectedOrgId === "" &&
            item.orgname?.toLowerCase().includes(filterText.toLowerCase()))
        );
      }),
    [filterText, tableData, selectedOrgId]
  );

  const subHeaderComponent = (
    <input
      type="text"
      placeholder="Search..."
      value={filterText}
      onChange={(e) => setFilterText(e.target.value)}
      className="block rounded-md border border-[#525252] bg-charleston px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
    />
  );

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-base font-semibold leading-6 text-light">Memberships</h1>
          <p className="mt-2 text-sm text-light">
            A list of all the memberships in your organization
          </p>
        </div>
        <div className="relative mt-2 sm:mt-0">
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="block w-full appearance-none rounded-full border border-solid border-gray-500 bg-raisinblack px-3 py-2 pr-8 text-base font-normal text-light transition ease-in-out hover:border-emerald-500 focus:border-emerald-500 focus:bg-charleston focus:text-light focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Organizations</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-8">
        {tableData.length > 0 ? (
          <DataTable
            columns={columns}
            data={filteredData}
            defaultSortFieldId="membershipname"
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
          />
        ) : (
          <Preloader />
        )}
      </div>
    </div>
  );
}
