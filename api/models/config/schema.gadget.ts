import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "config" model, go to https://simplybook.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "6oD5Hq7fAF7a",
  comment:
    "Stores application configuration settings for each shop, including business name, timezone, working hours, and booking settings.",
  fields: {
    allowOnlineBooking: {
      type: "boolean",
      default: true,
      storageKey: "XQ9UvedXuHMm",
    },
    autoConfirmBookings: {
      type: "boolean",
      default: false,
      storageKey: "sTTMH4DOD7EP",
    },
    bookingAdvanceLimit: {
      type: "number",
      default: 30,
      decimals: 0,
      storageKey: "GK0jj81-XSX7",
    },
    bookingBuffer: {
      type: "number",
      default: 15,
      decimals: 0,
      storageKey: "LJAYg3Srf9gR",
    },
    businessName: { type: "string", storageKey: "BVNTEB8J__2J" },
    cancellationPolicy: {
      type: "string",
      storageKey: "XKFn3OLO08kq",
    },
    emailNotifications: {
      type: "boolean",
      default: true,
      storageKey: "ucmDC_5CNbS6",
    },
    enable1HourReminders: {
      type: "boolean",
      default: false,
      storageKey: "enable1HourReminders",
    },
    enable24HourReminders: {
      type: "boolean",
      default: false,
      storageKey: "enable24HourReminders",
    },
    enableAppointmentConfirmations: {
      type: "boolean",
      default: false,
      storageKey: "enableAppointmentConfirmations",
    },
    onboardingSkipped: {
      type: "boolean",
      default: false,
      storageKey: "LPFwxzZcBylS",
    },
    posExtensionUsed: {
      type: "boolean",
      default: false,
      storageKey: "POSExtensionUsed",
    },
    requireCustomerInfo: {
      type: "boolean",
      storageKey: "435MC9FLDysN",
    },
    shop: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "shopifyShop" },
      storageKey: "2W1n9-NNu2VM",
    },
    smsNotifications: {
      type: "boolean",
      default: false,
      storageKey: "iWIn1etHeIAk",
    },
    themeExtensionUsed: {
      type: "boolean",
      default: false,
      storageKey: "ThemeExtensionUsed",
    },
    timeSlotInterval: {
      type: "number",
      default: 30,
      decimals: 0,
      validations: { run: ["validateTimeSlotInterval.js"] },
      storageKey: "3__H4mm5ceUp",
    },
    timeZone: { type: "string", storageKey: "9beWnDT1REwD" },
    workingHours: { type: "json", storageKey: "WJuH7NRCuORb" },
  },
};
