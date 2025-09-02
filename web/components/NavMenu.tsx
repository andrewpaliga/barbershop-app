import { Link } from "@remix-run/react";
import { NavMenu as AppBridgeNavMenu } from "@shopify/app-bridge-react";
import { SettingsIcon } from "@shopify/polaris-icons";

export function NavMenu() {
  return (
    <AppBridgeNavMenu>
      <Link to="/" rel="home">
        Shop Information
      </Link>
      <Link to="/staff">
        Staff
      </Link>
      <Link to="/services">
        Services
      </Link>
      <Link to="/hours-of-operation">
        Hours of Operation
      </Link>
      <Link to="/schedule">
        Schedule
      </Link>
      <Link to="/settings">
        Settings
      </Link>
    </AppBridgeNavMenu>
  );
}
