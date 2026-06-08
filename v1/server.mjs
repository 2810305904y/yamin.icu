import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { handleAdminSessionRequest } from "../api/admin-auth.mjs";
import { handleSiteDataBackupRequest, handleSiteDataRequest } from "../api/site-data-store.mjs";
import { siteData } from "./content/site-data.mjs";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".png": "image/png",
};

async function readRequestBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
  }
  return body;
}

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://localhost:${port}`).pathname);
  if (pathname === "/") {
    return resolve(join(root, "index.html"));
  }
  if (pathname === "/fail") {
    return resolve(join(root, "index.html"));
  }
  if (pathname === "/v1") {
    return resolve(join(root, "v1", "index.html"));
  }
  if (pathname === "/admin") {
    return resolve(join(root, "admin", "index.html"));
  }
  if (pathname.endsWith("/")) {
    return resolve(join(root, pathname, "index.html"));
  }

  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = safePath.replace(/^[/\\]/, "");
  const fullPath = resolve(join(root, filePath));

  if (!fullPath.startsWith(root)) {
    return null;
  }

  return fullPath;
}

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || "/", `http://localhost:${port}`).pathname);
  if (pathname === "/api/site-data") {
    const result = await handleSiteDataRequest({
      method: request.method,
      headers: request.headers,
      body: await readRequestBody(request),
      env: process.env,
      fallbackData: siteData,
    });

    response.writeHead(result.status, result.headers);
    response.end(result.body);
    return;
  }

  if (pathname === "/api/site-data-backup") {
    const result = await handleSiteDataBackupRequest({
      method: request.method,
      headers: request.headers,
      body: await readRequestBody(request),
      env: process.env,
    });

    response.writeHead(result.status, result.headers);
    response.end(result.body);
    return;
  }

  if (pathname === "/api/admin-session") {
    const result = await handleAdminSessionRequest({
      method: request.method,
      headers: request.headers,
      body: await readRequestBody(request),
      env: process.env,
    });

    response.writeHead(result.status, result.headers);
    response.end(result.body);
    return;
  }

  const filePath = resolveRequestPath(request.url || "/");

  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const data = await readFile(filePath);
    const contentType = mimeTypes[extname(filePath)] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType });
    response.end(data);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Homepage preview: http://127.0.0.1:${port}/`);
  console.log(`Admin preview: http://127.0.0.1:${port}/admin`);
});
