import { useParams, useNavigate } from "@remix-run/react";
import {
  Page,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Banner,
} from "@shopify/polaris";
import { DeleteIcon, ArrowLeftIcon } from "@shopify/polaris-icons";
import { useState } from "react";
import {
  AutoForm,
  AutoInput,
  AutoSubmit,
  SubmitResultBanner,
} from "@gadgetinc/react/auto/polaris";
import { useAction } from "@gadgetinc/react";
import { api } from "../api";

export default function StaffEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [{ data: deleteData, fetching: deleting, error: deleteError }, deleteStaff] = useAction(api.staff.delete);

  const handleDelete = async () => {
    if (id) {
      await deleteStaff({ id });
      if (!deleteError) {
        navigate("/staff");
      }
    }
  };

  return (
    <Page
      backAction={{
        content: "Staff",
        onAction: () => navigate("/staff"),
      }}
      title="Edit Staff Member"
      primaryAction={
        <Button
          variant="primary"
          form="staff-edit-form"
          submit
          loading={false}
        >
          Save
        </Button>
      }
      secondaryActions={[
        {
          content: "Delete",
          destructive: true,
          icon: DeleteIcon,
          onAction: () => setShowDeleteConfirm(true),
        },
      ]}
    >
      <BlockStack gap="500">
        {showDeleteConfirm && (
          <Banner
            title="Delete staff member?"
            tone="critical"
            action={{
              content: "Delete",
              onAction: handleDelete,
              loading: deleting,
            }}
            secondaryAction={{
              content: "Cancel",
              onAction: () => setShowDeleteConfirm(false),
            }}
          >
            <Text as="p" variant="bodyMd">
              This action cannot be undone. This will permanently delete the staff member.
            </Text>
          </Banner>
        )}

        {deleteError && (
          <Banner title="Error deleting staff member" tone="critical">
            <Text as="p" variant="bodyMd">
              {deleteError.toString()}
            </Text>
          </Banner>
        )}

        <Card>
          <AutoForm action={api.staff.update} findBy={id} id="staff-edit-form">
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Staff Information
              </Text>
              
              <BlockStack gap="300">
                <AutoInput field="name" />
                <AutoInput field="email" />
                <AutoInput field="phone" />
                <AutoInput field="bio" />
                <AutoInput field="location" />
                <AutoInput field="isActive" />
              </BlockStack>

              <SubmitResultBanner />
            </BlockStack>
          </AutoForm>
        </Card>
      </BlockStack>
    </Page>
  );
}