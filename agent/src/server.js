import { createServer } from "node:http";
import { runGrading, runDeliveryVerification } from "./flows.js";
import { uploadImage } from "./ipfs/pinata.js";
import { logEvent } from "./logs/logger.js";
import { config } from "./config.js";

const PORT = Number(process.env.AGENT_PORT || 8787);
const MAX_BODY = 12 * 1024 * 1024; // 12 MB, covers base64 photo payloads

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "Content-Type": "application/json", ...CORS });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function dataUrlToBytes(dataUrl) {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || "");
  if (!match) throw new Error("Expected a base64 data URL");
  return { bytes: Buffer.from(match[2], "base64"), mime: match[1] };
}

const routes = {
  "POST /api/upload": async (req, res, body) => {
    const { bytes, mime } = dataUrlToBytes(body.photoDataUrl);
    const uploaded = await uploadImage({ bytes, filename: body.filename, contentType: mime });
    send(res, 200, { photoURI: uploaded.photoURI, hashHex: uploaded.hashHex, provider: uploaded.provider });
  },

  "POST /api/grade": async (req, res, body) => {
    const result = await runGrading({
      listingId: Number(body.listingId),
      cropType: body.cropType,
      weightKg: body.weightKg,
      photoDataUrl: body.photoDataUrl,
      photoFilename: body.photoFilename,
      postOnChain: body.postOnChain !== false,
    });
    send(res, 200, result);
  },

  "POST /api/verify-delivery": async (req, res, body) => {
    const result = await runDeliveryVerification({
      listingId: Number(body.listingId),
      deliveryPhotoDataUrl: body.deliveryPhotoDataUrl,
      deliveryFilename: body.deliveryFilename,
      postOnChain: body.postOnChain !== false,
    });
    send(res, 200, result);
  },

  "GET /api/health": async (req, res) => {
    send(res, 200, {
      ok: true,
      model: config.ai.models[0],
      models: config.ai.models.length,
      minConfidence: config.minConfidence,
      contract: config.chain.contractAddress || null,
      ipfs: config.ipfs.pinataJwt ? "pinata" : "data-url-fallback",
    });
  },
};

const server = createServer(async (req, res) => {
  const { method, url } = req;

  if (method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  const key = `${method} ${url.split("?")[0]}`;
  const handler = routes[key];

  if (!handler) {
    send(res, 404, { error: `No route for ${key}` });
    return;
  }

  try {
    const body = method === "POST" ? await readBody(req) : {};
    await handler(req, res, body);
  } catch (err) {
    logEvent({ level: "error", task: "http", message: key, error: err.message });
    send(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  logEvent({ level: "info", task: "http", message: `Agent listening on :${PORT}` });
  console.log(`VeriPanen agent HTTP API on http://localhost:${PORT}`);
  console.log(`Routes: ${Object.keys(routes).join(", ")}`);
});
