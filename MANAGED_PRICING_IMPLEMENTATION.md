# Managed Pricing Implementation

This document describes the managed pricing implementation for the SimplyBook app.

## Overview

The app now supports Shopify's Managed App Pricing, which allows merchants to select plans through Shopify's hosted plan selection page. The app enforces access control based on subscription status and trial periods.

## Components Created

### 1. Subscription Status Sync (`api/actions/syncManagedPricingStatus.ts`)
- Queries Shopify's Billing API to get current subscription status
- Updates local shop records with billing status, plan name, and trial information
- Can be called manually or automatically when needed

### 2. Welcome Link Handler (`web/routes/_app.welcome.tsx`)
- Handles redirects from Shopify after a merchant approves a plan
- URL format: `/welcome?charge_id=...&shop=store.myshopify.com`
- Syncs subscription status and redirects to dashboard

### 3. Webhook Handler (`api/routes/api/POST-webhook-app-subscriptions-update.ts`)
- Handles `APP_SUBSCRIPTIONS_UPDATE` webhooks from Shopify
- Updates shop records when subscriptions change (created, updated, cancelled)
- Registered in `shopify.app.toml` files

### 4. Trial Banner Component (`web/components/TrialBanner.tsx`)
- Displays a countdown banner showing days remaining in trial
- Shows on all pages during trial period
- Includes CTA button to select a plan
- Banner tone changes based on days remaining (info → warning → critical)

### 5. Plan Required Gate Component (`web/components/PlanRequiredGate.tsx`)
- Blocks access to protected routes when:
  - No plan has been selected
  - Trial has expired
- Shows a "Plan Required" screen with link to Shopify's plan selection page
- Allows access to root page (`/`) even when trial expires

### 6. App Layout Updates (`web/routes/_app.tsx`)
- Integrates TrialBanner on all pages (except welcome page)
- Wraps protected routes with PlanRequiredGate
- Allows root and welcome routes to always be accessible

## Configuration

### Webhook Registration
The `APP_SUBSCRIPTIONS_UPDATE` webhook has been added to:
- `shopify.app.toml`
- `shopify.app.production.toml`
- `shopify.app.development.toml`

**Important**: You must also register this webhook in your Shopify Partner Dashboard:
1. Go to your app in Partner Dashboard
2. Navigate to App Setup → Webhooks
3. Add webhook subscription:
   - Event: `app_subscriptions/update`
   - URL: `https://simplybook.gadget.app/api/webhook-app-subscriptions-update` (adjust for your environment)

### Welcome Links
In your Shopify Partner Dashboard, configure welcome links for each plan:
1. Go to Apps → Your App → Distribution → Manage listing
2. Under Pricing content → Manage
3. For each plan, set the Welcome link to: `/welcome`

The welcome link can be a relative path (for embedded apps) or full URL.

### App Handle Configuration
The app handle used in plan selection URLs is currently hardcoded as `"simplybook"` in:
- `web/components/TrialBanner.tsx`
- `web/components/PlanRequiredGate.tsx`

**TODO**: Make this environment-aware or configurable. The handle should match:
- Production: `"simplybook"` (from `shopify.app.production.toml`)
- Development: `"simplybook-development"` (from `shopify.app.development.toml`)

## Access Control Logic

### During Trial Period
- ✅ Full access to all app features
- ✅ Trial banner shown on all pages with countdown
- ✅ CTA to select a plan

### After Trial Expires
- ❌ Access blocked to all pages except root (`/`)
- ✅ Root page remains accessible with "Plan Required" screen
- ✅ Welcome page remains accessible (for plan approval callbacks)

### With Active Plan
- ✅ Full access to all app features
- ✅ No trial banner shown
- ✅ All routes accessible

## Required Shop Model Fields

The implementation expects these fields on the `shopifyShop` model:
- `billingStatus` (string): "active", "pending", "cancelled", "expired", "no_billing"
- `billingPlan` (string): Plan name (e.g., "basic", "pro")
- `isTrialActive` (boolean): Whether trial is currently active
- `trialEndsAt` (datetime): When the trial period ends
- `appSubscriptionId` (string): Shopify subscription ID (GID)

**Note**: These fields may need to be added to your Gadget model schema if they don't exist yet.

## Testing

1. **Test Trial Banner**:
   - Install app on a dev store
   - Banner should appear showing trial countdown
   - Click "Select a Plan" should open Shopify's plan selection page

2. **Test Welcome Link**:
   - Select a plan in Shopify's plan selection page
   - Should redirect to `/welcome`
   - Should sync status and redirect to dashboard

3. **Test Access Control**:
   - Manually set `trialEndsAt` to a past date
   - Try accessing protected routes (e.g., `/staff`, `/services`)
   - Should show "Plan Required" screen
   - Root page (`/`) should still be accessible

4. **Test Webhook**:
   - Use Shopify CLI or Partner Dashboard to send test webhook
   - Check logs to verify webhook is received and processed
   - Verify shop record is updated

## Next Steps

1. ✅ Add custom fields to `shopifyShop` model if needed
2. ✅ Register webhook in Partner Dashboard
3. ✅ Configure welcome links for each plan in Partner Dashboard
4. ✅ Make app handle configurable/environment-aware
5. ✅ Test the full flow: install → trial → plan selection → active subscription
6. ✅ Test edge cases: plan cancellation, downgrade, etc.

## References

- [Shopify Managed App Pricing Docs](https://shopify.dev/docs/apps/launch/billing/managed-pricing)
- [Welcome Links](https://shopify.dev/docs/apps/launch/billing/managed-pricing#welcome-links)
- [Webhooks for Managed Pricing](https://shopify.dev/docs/apps/launch/billing/managed-pricing#webhooks)

