import { useNavigate } from "@remix-run/react";
import { useState, useRef, useEffect } from "react";
import { AutoForm, AutoInput, AutoBelongsToInput, AutoSubmit } from "@gadgetinc/react/auto/polaris";
import { Page, Card, Button, BlockStack, Text, InlineStack, Avatar } from "@shopify/polaris";
import { ArrowLeftIcon } from "@shopify/polaris-icons";
import { api } from "../api";

export default function NewStaffPage() {
  const navigate = useNavigate();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSuccess = () => {
    navigate("/staff");
  };

  const handleBack = () => {
    navigate("/staff");
  };

  const getInitials = (name?: string) => {
    if (!name || name.trim() === '') return "?";
    return name
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2);
  };

  const getAvatarSource = () => {
    return previewUrl || undefined;
  };

  const handleUploadPhotoClick = () => {
    console.log('handleUploadPhotoClick called');

    const findAndClickFileInput = (attempt: number = 1): void => {
      console.log(`Attempt ${attempt} to find file input`);

      // Try multiple selectors to find the file input
      const selectors = [
        'input[type="file"][name*="avatar"]',
        'input[type="file"][name="avatar"]',
        'input[type="file"]',
        '[name*="avatar"] input[type="file"]'
      ];

      let hiddenInput: HTMLInputElement | null = null;

      for (const selector of selectors) {
        console.log(`Trying selector: ${selector}`);
        hiddenInput = document.querySelector(selector) as HTMLInputElement;
        if (hiddenInput) {
          console.log(`Found file input with selector: ${selector}`, hiddenInput);
          break;
        }
      }

      // If not found, try looking in forms as a last resort
      if (!hiddenInput) {
        console.log('Trying to find file input within forms');
        const forms = document.querySelectorAll('form');
        for (const form of forms) {
          const fileInputInForm = form.querySelector('input[type="file"]') as HTMLInputElement;
          if (fileInputInForm) {
            console.log('Found file input in form', fileInputInForm);
            hiddenInput = fileInputInForm;
            break;
          }
        }
      }

      if (hiddenInput) {
        console.log('File input found, setting up event handler and clicking');

        // Set up the file change event handler before clicking
        const handleFileChange = (event: Event) => {
          const target = event.target as HTMLInputElement;
          const file = target.files?.[0];

          if (file) {
            console.log('File selected:', file.name);
            // Clean up previous preview URL
            if (previewUrl) {
              URL.revokeObjectURL(previewUrl);
            }

            // Create new preview URL
            const newPreviewUrl = URL.createObjectURL(file);
            setPreviewUrl(newPreviewUrl);
          }
        };

        // Remove any existing event listener and add the new one
        hiddenInput.removeEventListener('change', handleFileChange);
        hiddenInput.addEventListener('change', handleFileChange);

        fileInputRef.current = hiddenInput;
        hiddenInput.click();
      } else {
        console.log(`File input not found on attempt ${attempt}`);

        // Retry with exponential backoff, up to 5 attempts
        if (attempt < 5) {
          const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000); // 100ms, 200ms, 400ms, 800ms, 1000ms
          console.log(`Retrying in ${delay}ms...`);
          setTimeout(() => findAndClickFileInput(attempt + 1), delay);
        } else {
          console.error('Failed to find file input after 5 attempts');
        }
      }
    };

    findAndClickFileInput();
  };

  useEffect(() => {
    const handleFileChange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];

      if (file) {
        // Clean up previous preview URL
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }

        // Create new preview URL
        const newPreviewUrl = URL.createObjectURL(file);
        setPreviewUrl(newPreviewUrl);
      }
    };

    // Add event listener to detect file input changes
    const observeFileInputs = () => {
      const fileInput = document.querySelector('input[type="file"][name*="avatar"]') as HTMLInputElement;
      if (fileInput) {
        fileInput.addEventListener('change', handleFileChange);
        fileInputRef.current = fileInput;
      }
    };

    // Use MutationObserver to detect when the hidden file input is added to the DOM
    const observer = new MutationObserver(observeFileInputs);
    observer.observe(document.body, { childList: true, subtree: true });

    // Initial check
    observeFileInputs();

    return () => {
      observer.disconnect();
      const fileInput = fileInputRef.current;
      if (fileInput) {
        fileInput.removeEventListener('change', handleFileChange);
      }
      // Clean up preview URL on unmount
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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
          {/* Custom Avatar Section */}
          <BlockStack gap="300">
            <Text as="h3" variant="headingMd">Photo</Text>
            <InlineStack gap="400" align="start">
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid var(--p-color-border-subdued)'
              }}>
                <Avatar
                  size="xl"
                  source={getAvatarSource()}
                  initials={getInitials()}
                />
              </div>
              <BlockStack gap="200">
                <Button
                  size="large"
                  onClick={handleUploadPhotoClick}
                >
                  Upload photo
                </Button>
              </BlockStack>
            </InlineStack>
          </BlockStack>

          <AutoForm
            action={api.staff.create}
            onSuccess={handleSuccess}
          >
            <BlockStack gap="400">
              {/* Hidden avatar input */}
              <div style={{ display: 'none' }}>
                <AutoInput field="avatar" />
              </div>

              <AutoInput field="name" />
              <AutoInput field="email" />
              <AutoInput field="phone" />
              <AutoInput field="title" />
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