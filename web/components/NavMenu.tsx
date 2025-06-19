import { Link } from "@remix-run/react";
import { NavMenu as AppBridgeNavMenu } from "@shopify/app-bridge-react";

export function NavMenu() {
  return (
    <AppBridgeNavMenu>
      <Link to="/" rel="home">
        Shop Information
      </Link>
      <Link to="/staff">
        Staff
      </Link>
      <Link to="/products">
        Products & Services
      </Link>
      <Link to="/schedule">
        Schedule
      </Link>
    </AppBridgeNavMenu>
  );
}
