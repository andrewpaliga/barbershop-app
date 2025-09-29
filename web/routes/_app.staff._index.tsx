import type { MetaFunction } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import { Page, Card, BlockStack, DataTable, Text, Spinner, Banner, Button, FooterHelp, Link } from "@shopify/polaris";
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
          <Banner tone="critical">
            <Text as="p">Error loading staff: {error.toString()}</Text>
          </Banner>
        </BlockStack>
      </Page>
    );
  }

  const rows = data?.map((staff) => [
    <Button
      key={staff.id}
      variant="plain"
      onClick={() => handleStaffClick(staff)}
      accessibilityLabel={`View details for ${staff.name}`}
    >
      {staff.name || "—"}
    </Button>,
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
            />
          ) : (
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <Text as="p" variant="bodyMd">
                No staff members found. Add your first staff member to get started.
              </Text>
            </div>
          )}
        </Card>

        <FooterHelp>
          Learn more about <Link url="https://shopifybookingapp.com/docs/#staff-management">SimplyBook staff management</Link>.
        </FooterHelp>
      </BlockStack>
    </Page>
  );
}