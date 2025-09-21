import React from "react";
import {
  Page,
  Card,
  Text,
  Select,
  Button,
  BlockStack,
  InlineStack,
  Badge,
} from "@shopify/polaris";
import { useFindFirst, useAction } from "@gadgetinc/react";
import { api } from "../api";
import { useState } from "react";

export default function Settings() {
  const [{ data: config, fetching, error }] = useFindFirst(api.config);
  const [{ fetching: updatingOnboarding }, updateConfig] = useAction(api.config.update);
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
    <Page 
      title="Settings"
      primaryAction={{
        content: isSaving ? 'Saving...' : 'Save Settings',
        onAction: async () => {
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
        },
        loading: isSaving,
        disabled: isSaving
      }}
    >
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                Time Slot Configuration
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Set the duration for your booking time slots
              </Text>
            </BlockStack>

            <BlockStack gap="200">
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
              <Text as="p" variant="bodyMd" tone="subdued">
                Select the duration for each booking time slot. This determines how long each available time slot will be.
              </Text>
            </BlockStack>
          </BlockStack>
        </Card>
        
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                Onboarding Settings
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Manage your app setup and onboarding experience
              </Text>
            </BlockStack>

            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd">
                    Setup Onboarding
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {config?.onboardingSkipped ? "Onboarding was skipped" : "Onboarding is active"}
                  </Text>
                </BlockStack>
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone={config?.onboardingSkipped ? "critical" : "success"}>
                    {config?.onboardingSkipped ? "Skipped" : "Active"}
                  </Badge>
                  {config?.onboardingSkipped && (
                    <Button
                      variant="primary"
                      size="slim"
                      loading={updatingOnboarding}
                      onClick={async () => {
                        setIsSaving(true);
                        try {
                          await updateConfig({ id: config.id, onboardingSkipped: false });
                          setShowSuccess(true);
                          setTimeout(() => setShowSuccess(false), 3000);
                        } catch (error) {
                          console.error('Failed to reset onboarding:', error);
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                    >
                      Show Onboarding
                    </Button>
                  )}
                </InlineStack>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                The onboarding helps you get started with setting up services, staff, and booking features. You can re-enable it anytime.
              </Text>
            </BlockStack>
          </BlockStack>
        </Card>
        
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                Extension Usage Tracking
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Track which extensions have been used and reset for testing
              </Text>
            </BlockStack>

            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd">
                    Theme Extension (Booking Widget)
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {config?.themeExtensionUsed ? "Extension has been used" : "Extension not yet used"}
                  </Text>
                </BlockStack>
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone={config?.themeExtensionUsed ? "success" : "warning"}>
                    {config?.themeExtensionUsed ? "Used" : "Not Used"}
                  </Badge>
                  {config?.themeExtensionUsed && (
                    <Button
                      variant="secondary"
                      size="slim"
                      loading={isSaving}
                      onClick={async () => {
                        setIsSaving(true);
                        try {
                          await api.config.update(config.id, {
                            themeExtensionUsed: false
                          });
                          setShowSuccess(true);
                          setTimeout(() => setShowSuccess(false), 3000);
                        } catch (error) {
                          console.error('Failed to reset theme extension tracking:', error);
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                    >
                      Reset
                    </Button>
                  )}
                </InlineStack>
              </InlineStack>
              
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd">
                    POS Extension
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {config?.posExtensionUsed ? "Extension has been used" : "Extension not yet used"}
                  </Text>
                </BlockStack>
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone={config?.posExtensionUsed ? "success" : "warning"}>
                    {config?.posExtensionUsed ? "Used" : "Not Used"}
                  </Badge>
                  {config?.posExtensionUsed && (
                    <Button
                      variant="secondary"
                      size="slim"
                      loading={isSaving}
                      onClick={async () => {
                        setIsSaving(true);
                        try {
                          await api.config.update(config.id, {
                            posExtensionUsed: false
                          });
                          setShowSuccess(true);
                          setTimeout(() => setShowSuccess(false), 3000);
                        } catch (error) {
                          console.error('Failed to reset POS extension tracking:', error);
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                    >
                      Reset
                    </Button>
                  )}
                </InlineStack>
              </InlineStack>
              
              <Text as="p" variant="bodySm" tone="subdued">
                These flags are automatically set to true when the respective extensions make their first API call. 
                You can reset them for testing purposes.
              </Text>
            </BlockStack>
          </BlockStack>
        </Card>
      </BlockStack>
      
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
            ✅ Your changes have been saved!
          </Text>
        </div>
      )}
    </Page>
  );
}