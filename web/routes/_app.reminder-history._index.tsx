import { useState, useMemo } from "react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  DataTable,
  Spinner,
  EmptyState,
  TextField,
  Banner,
  Badge,
} from "@shopify/polaris";
import { useFindMany } from "@gadgetinc/react";
import { api } from "../api";

export default function ReminderHistory() {
  const [searchEmail, setSearchEmail] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 25;

  // Calculate date 90 days ago
  const ninetyDaysAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return date;
  }, []);

  // Build filter
  const filter = useMemo(() => {
    const baseFilter: any = {
      sentAt: {
        greaterThanOrEqual: ninetyDaysAgo.toISOString(),
      },
    };

    if (searchEmail.trim()) {
      baseFilter.customerEmail = {
        contains: searchEmail.trim(),
      };
    }

    return baseFilter;
  }, [searchEmail, ninetyDaysAgo]);

  // Fetch reminder history
  const [{ data: reminders, fetching, error }] = useFindMany(api.reminderHistory, {
    filter,
    sort: { sentAt: "Descending" },
    first: itemsPerPage,
    skip: (currentPage - 1) * itemsPerPage,
    select: {
      id: true,
      customerEmail: true,
      reminderType: true,
      sentAt: true,
      status: true,
      errorMessage: true,
      booking: {
        id: true,
        scheduledAt: true,
        customerName: true,
        variant: {
          product: {
            title: true,
          },
        },
        staff: {
          name: true,
        },
      },
    },
  });

  // Format reminder type for display
  const formatReminderType = (type: string) => {
    switch (type) {
      case "confirmation":
        return "Confirmation";
      case "24_hour":
        return "24 Hour Reminder";
      case "1_hour":
        return "1 Hour Reminder";
      default:
        return type;
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  // Format booking date for display
  const formatBookingDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  // Build table rows
  const rows = useMemo(() => {
    if (!reminders) return [];

    return reminders.map((reminder: any) => [
      reminder.customerEmail || "—",
      formatReminderType(reminder.reminderType || ""),
      formatDate(reminder.sentAt),
      reminder.booking?.variant?.product?.title || "—",
      reminder.booking?.staff?.name || "—",
      formatBookingDate(reminder.booking?.scheduledAt || ""),
      reminder.status === "sent" ? (
        <Badge tone="success">Sent</Badge>
      ) : (
        <Badge tone="critical">Failed</Badge>
      ),
      reminder.errorMessage || "—",
    ]);
  }, [reminders]);

  const headings = [
    "Email",
    "Type",
    "Sent At",
    "Service",
    "Staff",
    "Appointment Date",
    "Status",
    "Error",
  ];

  if (fetching && !reminders) {
    return (
      <Page title="Reminder History">
        <Card>
          <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
            <Spinner size="large" />
          </div>
        </Card>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="Reminder History">
        <Banner tone="critical">
          <Text as="p">Error loading reminder history: {error.toString()}</Text>
        </Banner>
      </Page>
    );
  }

  return (
    <Page
      title="Reminder History"
      subtitle="View all email reminders sent to customers. Only reminders from the last 90 days are shown."
    >
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="400">
            <TextField
              label="Search by email"
              value={searchEmail}
              onChange={setSearchEmail}
              placeholder="Enter email address..."
              autoComplete="off"
            />
            <Banner tone="info">
              <Text as="p">
                Only reminders from the last 90 days are displayed. Older reminders are automatically removed.
              </Text>
            </Banner>
          </BlockStack>
        </Card>

        <Card>
          {reminders && reminders.length > 0 ? (
            <DataTable
              columnContentTypes={[
                "text",
                "text",
                "text",
                "text",
                "text",
                "text",
                "text",
                "text",
              ]}
              headings={headings}
              rows={rows}
            />
          ) : (
            <EmptyState
              heading="No reminders found"
              action={{
                content: "Clear search",
                onAction: () => setSearchEmail(""),
              }}
            >
              <Text as="p">
                {searchEmail
                  ? "No reminders match your search criteria."
                  : "No reminders have been sent yet."}
              </Text>
            </EmptyState>
          )}
        </Card>
      </BlockStack>
    </Page>
  );
}

