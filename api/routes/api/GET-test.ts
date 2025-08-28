import { RouteHandler } from "gadget-server";

const route: RouteHandler = async ({ reply }) => {
  await reply.code(200).send({ message: "Test route working" });
};

export default route;
