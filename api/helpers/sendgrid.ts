/**
 * SendGrid email helper functions for sending appointment confirmations and reminders
 * 
 * Requires SENDGRID_API_KEY environment variable to be set in Gadget settings.
 * Set this in your Gadget dashboard under Settings > Environment Variables.
 */

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";

if (!SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY environment variable is not set. Email sending will fail.");
}

export interface ConfirmationEmailData {
  serviceName: string;
  serviceDateTime: string;
  providerName: string;
  businessName: string;
  locationName: string;
  locationAddress: string;
  shopUrl: string;
  gcalStart: string;
  gcalEnd: string;
}

export interface ReminderEmailData {
  serviceName: string;
  serviceDateTime: string;
  providerName: string;
  businessName: string;
  locationName: string;
  locationAddress: string;
  shopUrl: string;
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
}

/**
 * Format a date for email display (e.g., "March 22, 2025 at 3:00 PM")
 */
export function formatDateTimeForEmail(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * Format a date for Google Calendar (ISO 8601 format, e.g., "20250322T150000Z")
 */
export function formatDateTimeForGoogleCalendar(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Send a confirmation email using SendGrid
 */
export async function sendConfirmationEmail(
  to: string,
  data: ConfirmationEmailData,
  templateId: string
): Promise<SendEmailResult> {
  if (!SENDGRID_API_KEY) {
    return {
      success: false,
      error: "SENDGRID_API_KEY environment variable is not set",
    };
  }

  try {
    const response = await fetch(SENDGRID_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: to }],
            dynamic_template_data: data,
          },
        ],
        from: {
          email: "noreply@thesimplybookapp.com",
          name: data.businessName,
        },
        template_id: templateId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `SendGrid API error: ${response.status} ${errorText}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send a reminder email (24-hour or 1-hour) using SendGrid
 */
export async function sendReminderEmail(
  to: string,
  data: ReminderEmailData,
  templateId: string
): Promise<SendEmailResult> {
  if (!SENDGRID_API_KEY) {
    return {
      success: false,
      error: "SENDGRID_API_KEY environment variable is not set",
    };
  }

  try {
    const response = await fetch(SENDGRID_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: to }],
            dynamic_template_data: data,
          },
        ],
        from: {
          email: "noreply@thesimplybookapp.com",
          name: data.businessName,
        },
        template_id: templateId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `SendGrid API error: ${response.status} ${errorText}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

