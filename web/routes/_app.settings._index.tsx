import React from "react";
import {
  Page,
  Card,
  Text,
  Select,
  Button,
} from "@shopify/polaris";
import { useFindFirst } from "@gadgetinc/react";
import { api } from "../api";
import { useState } from "react";

export default function Settings() {
  const [{ data: config, fetching, error }] = useFindFirst(api.config);
  const [selectedInterval, setSelectedInterval] = useState<number>(30);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Update selectedInterval when config loads
  React.useEffect(() => {
    if (config?.timeSlotInterval) {
      setSelectedInterval(config.timeSlotInterval);
    }
  }, [config?.timeSlotInterval]);

  if (fetching) {
    return (
      <Page title="Settings">
        <Card>
          <div style={{ padding: "16px" }}>
            <Text as="p" variant="bodyMd">Loading settings...</Text>
          </div>
        </Card>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="Settings">
        <Card>
          <div style={{ padding: "16px" }}>
            <Text as="p" variant="bodyMd" tone="critical">
              Error loading settings: {error.toString()}
            </Text>
          </div>
        </Card>
      </Page>
    );
  }

  if (!config) {
    return (
      <Page title="Settings">
        <Card>
          <div style={{ padding: "16px" }}>
            <Text as="p" variant="bodyMd">
              No configuration found. Please contact support.
            </Text>
          </div>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Time Slot Settings" subtitle="Configure your booking time slot duration">
      <div style={{ padding: "20px" }}>
        <Card>
          <div style={{ padding: "20px" }}>
            <div style={{ marginBottom: "20px" }}>
              <Text as="h2" variant="headingMd">
                Time Slot Configuration
              </Text>
              <div style={{ marginTop: "8px" }}>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Set the duration for your booking time slots
                </Text>
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <Select
                label="Time Slot Interval (minutes)"
                options={[
                  { label: "15 minutes", value: "15" },
                  { label: "30 minutes", value: "30" },
                  { label: "45 minutes", value: "45" },
                  { label: "60 minutes", value: "60" },
                  { label: "90 minutes", value: "90" }
                ]}
                value={selectedInterval.toString()}
                onChange={(value) => setSelectedInterval(parseInt(value))}
              />
              <div style={{ marginTop: "6px" }}>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Select the duration for each booking time slot. This determines how long each available time slot will be.
                </Text>
              </div>
            </div>

            <div style={{ marginTop: "16px" }}>
              <Button 
                variant="primary"
                loading={isSaving}
                disabled={isSaving}
                onClick={async () => {
                  setIsSaving(true);
                  try {
                    await api.config.update(config.id, {
                      timeSlotInterval: selectedInterval
                    });
                    setShowSuccess(true);
                    // Hide success message after 3 seconds
                    setTimeout(() => setShowSuccess(false), 3000);
                  } catch (error) {
                    console.error('Failed to update settings:', error);
                    // You could add an error message here
                  } finally {
                    setIsSaving(false);
                  }
                }}
              >
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
      
      {showSuccess && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: '#50b83c',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          animation: 'slideIn 0.3s ease-out'
        }}>
          <Text variant="bodyMd">
            ✅ Time slot interval saved successfully!
          </Text>
        </div>
      )}
    </Page>
  );
}