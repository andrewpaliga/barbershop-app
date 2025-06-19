import { useNavigate } from "@remix-run/react";
import { AutoForm, AutoInput, AutoBelongsToInput, AutoSubmit } from "@gadgetinc/react/auto/polaris";
import { Page, Card, Button, BlockStack, Text } from "@shopify/polaris";
import { ArrowLeftIcon } from "@shopify/polaris-icons";
import { api } from "../api";

export default function NewStaffPage() {
  const navigate = useNavigate();

  const handleSuccess = () => {
    shopify.toast.show("Staff member created successfully!");
    navigate("/staff");
  };

  const handleBack = () => {
    navigate("/staff");
  };

  return (
    <Page
      title="Add New Staff Member"
      titleMetadata={<Text as="span" variant="bodyMd" color="subdued">Create a new staff member</Text>}
      backAction={{
        content: "Back to Staff",
        onAction: handleBack
      }}
    >
      <Card>
        <BlockStack gap="400">
          <AutoForm 
            action={api.staff.create}
            onSuccess={handleSuccess}
          >
            <BlockStack gap="400">
              <AutoInput field="name" />
              <AutoInput field="email" />
              <AutoInput field="phone" />
              <AutoInput field="bio" />
              <AutoBelongsToInput field="location" />
              <AutoInput field="isActive" />
              <BlockStack gap="200">
                <AutoSubmit />
                <Button onClick={handleBack}>
                  Cancel
                </Button>
              </BlockStack>
            </BlockStack>
          </AutoForm>
        </BlockStack>
      </Card>
    </Page>
  );
}