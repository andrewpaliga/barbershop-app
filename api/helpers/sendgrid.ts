/**
 * SendGrid email helper functions for sending appointment confirmations, reminders,
 * and the merchant welcome email after install.
 *
 * Requires SENDGRID_API_KEY (and optionally MERCHANT_WELCOME_REPLY_TO_EMAIL)
 * in Gadget → Settings → Environment variables.
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
/**
 * Email address replies should go to (your inbox). Set in Gadget → Settings → Environment variables.
 * Defaults to support@thesimplybookapp.com if not configured.
 */
function getMerchantWelcomeReplyTo(): string {
  const v = process.env.MERCHANT_WELCOME_REPLY_TO_EMAIL?.trim();
  return v || "support@thesimplybookapp.com";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface MerchantWelcomeEmailData {
  ownerName?: string;
  shopName: string;
  shopDomain: string;
}

/**
 * Thank-you email sent once when a merchant installs the app (not on reinstall).
 * Uses Reply-To so merchants can respond directly without a SendGrid-verified personal From address.
 */
export async function sendMerchantWelcomeEmail(
  to: string,
  data: MerchantWelcomeEmailData
): Promise<SendEmailResult> {
  const replyTo = getMerchantWelcomeReplyTo();
  if (!SENDGRID_API_KEY) {
    return {
      success: false,
      error: "SENDGRID_API_KEY environment variable is not set",
    };
  }
  const subject = "Thanks for installing SimplyBook";
  const greetingName = data.ownerName?.trim() || "";
  const greeting = greetingName ? `Hi ${greetingName},` : "Hello,";
  const shopLine =
    data.shopName || data.shopDomain
      ? [data.shopName, data.shopDomain].filter(Boolean).join(" · ")
      : "";
  const textBody = [
    greeting,
    "",
    "Thank you for installing SimplyBook. We are glad you are here.",
    "",
    "If you have any questions, run into something confusing, or want to share feedback, just reply to this email and it will come straight to us.",
    ...(shopLine ? ["", shopLine] : []),
    "",
    "— The SimplyBook team",
  ].join("\n");

  const htmlShopLine =
    data.shopName || data.shopDomain
      ? `<p style="color: #555; font-size: 14px;">${escapeHtml(data.shopName)}${data.shopName && data.shopDomain ? " · " : ""}${escapeHtml(data.shopDomain)}</p>`
      : "";

  const htmlBody = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5; color: #1a1a1a;">
  <p>${escapeHtml(greeting)}</p>
  <p>Thank you for installing SimplyBook. We are glad you are here.</p>
  <p>If you have any questions, run into something confusing, or want to share feedback, just reply to this email and it will come straight to us.</p>
  ${htmlShopLine}
  <p>— The SimplyBook team</p>
</body>
</html>`.trim();

  try {
    const response = await fetch(SENDGRID_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: {
          email: "noreply@thesimplybookapp.com",
          name: "SimplyBook",
        },
        reply_to: { email: replyTo },
        subject,
        content: [
          { type: "text/plain", value: textBody },
          { type: "text/html", value: htmlBody },
        ],
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

