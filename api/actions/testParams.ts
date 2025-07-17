import { ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  return {
    success: true,
    receivedValue: params.testValue
  };
};

export const params = {
  testValue: { type: "string" }
};

export const options: ActionOptions = {
  returnType: true
};
