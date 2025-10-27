// Export the Client class for the GadgetProvider
export { Client } from "@gadget-client/simplybook";

// Create a basic API client instance for use in components
// This instance will have session token authentication when used within the GadgetProvider context
import { Client as GadgetClient } from "@gadget-client/simplybook";
export const api = new GadgetClient();