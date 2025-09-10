import type { MetaFunction } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import { Page, Card, BlockStack, DataTable, Text, Spinner, Banner } from "@shopify/polaris";
import { useFindMany } from "@gadgetinc/react";
import { api } from "../api";

export const meta: MetaFunction = () => {
  return [
    { title: "Staff - Barbershop" },
    { name: "description", content: "Manage your staff members" },
  ];
};

export default function StaffIndex() {
  const navigate = useNavigate();

  const [{ data, fetching, error }] = useFindMany(api.staff, {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
    },
  });

  const handleAddNewStaff = () => {
    navigate("/staff/new");
  };

  const handleStaffClick = (record: any) => {
    navigate(`/staff/${record.id}`);
  };

  if (fetching && !data) {
    return (
      <Page
        title="Staff"
        primaryAction={{
          content: "Add New Staff",
          onAction: handleAddNewStaff,
        }}
      >
        <BlockStack gap="400">
          <Card>
            <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
              <Spinner size="large" />
            </div>
          </Card>
        </BlockStack>
      </Page>
    );
  }

  if (error) {
    return (
      <Page
        title="Staff"
        primaryAction={{
          content: "Add New Staff",
          onAction: handleAddNewStaff,
        }}
      >
        <BlockStack gap="400">
          <Banner status="critical">
            <Text as="p">Error loading staff: {error.toString()}</Text>
          </Banner>
        </BlockStack>
      </Page>
    );
  }

  const rows = data?.map((staff) => [
    staff.name || "—",
    staff.email || "—",
    staff.phone || "—",
    staff.isActive ? "Yes" : "No",
  ]) || [];

  const headings = ["Name", "Email", "Phone", "Active"];

  return (
    <Page
      title="Staff"
      primaryAction={{
        content: "Add New Staff",
        onAction: handleAddNewStaff,
      }}
    >
      <BlockStack gap="400">
        <Card>
          {data && data.length > 0 ? (
            <DataTable
              columnContentTypes={["text", "text", "text", "text"]}
              headings={headings}
              rows={rows}
              onRowClick={(rowIndex) => {
                const staff = data[rowIndex];
                if (staff) {
                  handleStaffClick(staff);
                }
              }}
            />
          ) : (
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <Text as="p" variant="bodyMd">
                No staff members found. Add your first staff member to get started.
              </Text>
            </div>
          )}
        </Card>
      </BlockStack>
    </Page>
  );
}