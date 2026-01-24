import { useGlobalAction, useSession } from "@gadgetinc/react";
import { useNavigate } from "@remix-run/react";
import { Banner } from "@shopify/polaris";
import { useEffect, type ReactNode } from "react";
import { api } from "../api";
import { FullPageSpinner } from "./FullPageSpinner";

export function BillingGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const session = useSession(api);
  const [{ data, fetching, error }, verifyBillingStatus] = useGlobalAction(api.verifyBillingStatus);

  useEffect(() => {
    if (session?.shop?.id) {
      void verifyBillingStatus({ shopId: session.shop.id });
    }
  }, [session?.shop?.id]);

  useEffect(() => {
    if (data?.result && typeof data.result === "object" && "requiresCharge" in data.result && data.result.requiresCharge) {
      navigate("/billing");
    }
  }, [data, navigate]);

  if (!session || fetching) {
    return <FullPageSpinner />;
  }

  if (error) {
    return <Banner tone="critical">Error checking billing status: {error.message}</Banner>;
  }

  return <>{children}</>;
}