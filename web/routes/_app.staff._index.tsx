import type { MetaFunction } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import { Page, Card, Button, BlockStack } from "@shopify/polaris";
import { AutoTable } from "@gadgetinc/react/auto/polaris";
import { api } from "../api";

export const meta: MetaFunction = () => {
  return [
    { title: "Staff - Barbershop" },
    { name: "description", content: "Manage your staff members" },
  ];
};

export default function StaffIndex() {
  const navigate = useNavigate();

  const handleAddNewStaff = () => {
    navigate("/staff/new");
  };

  const handleStaffClick = (record: any) => {
    navigate(`/staff/${record.id}`);
  };

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
          <AutoTable
            model={api.staff}
            columns={[
              "name",
              "email", 
              "phone",
              {
                header: "Active",
                field: "isActive",
              },
            ]}
            onClick={handleStaffClick}
          />
        </Card>
      </BlockStack>
    </Page>
  );
}