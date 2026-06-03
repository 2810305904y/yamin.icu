import { handleAdminSessionRequest } from "./admin-auth.mjs";

async function readBody(request) {
  if (typeof request.body === "string") return request.body;
  if (request.body && typeof request.body === "object") return JSON.stringify(request.body);

  let body = "";
  for await (const chunk of request) {
    body += chunk;
  }
  return body;
}

export default async function handler(request, response) {
  const result = await handleAdminSessionRequest({
    method: request.method,
    headers: request.headers,
    body: await readBody(request),
    env: process.env,
  });

  Object.entries(result.headers).forEach(([key, value]) => response.setHeader(key, value));
  response.status(result.status).send(result.body);
}
