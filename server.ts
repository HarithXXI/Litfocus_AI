import dotenv from "dotenv";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fetch, { Response } from "node-fetch";
import { lookup } from "node:dns/promises";
import net from "node:net";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config({ path: ".env.local" });
dotenv.config();

const PORT = 3000;
const MAX_EXTRACTED_BYTES = 2 * 1024 * 1024;
const MAX_ANALYSIS_CHARS = 30_000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const SUPPORTED_MODES = new Set(["eli5", "deep-dive", "key-points"]);

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (net.isIPv4(normalized)) {
    const [a, b] = normalized.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 0 ||
      a >= 224
    );
  }

  if (net.isIPv6(normalized)) {
    const value = normalized.split("%")[0];
    if (value.startsWith("::ffff:")) {
      return isPrivateAddress(value.slice("::ffff:".length));
    }
    return (
      value === "::" ||
      value === "::1" ||
      value.startsWith("fc") ||
      value.startsWith("fd") ||
      value.startsWith("fe8") ||
      value.startsWith("fe9") ||
      value.startsWith("fea") ||
      value.startsWith("feb") ||
      value.startsWith("ff")
    );
  }

  return true;
}

async function assertPublicUrl(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("A valid URL is required");
  }

  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("Only public HTTP(S) URLs without credentials are allowed");
  }
  if (parsed.port && !["80", "443"].includes(parsed.port)) {
    throw new Error("Only HTTP and HTTPS default ports are allowed");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || isPrivateAddress(hostname)) {
    throw new Error("Private or local network URLs are not allowed");
  }

  const addresses = net.isIP(hostname)
    ? [hostname]
    : (await lookup(hostname, { all: true })).map((entry) => entry.address);
  if (!addresses.length || addresses.some(isPrivateAddress)) {
    throw new Error("The URL resolves to a private or local network address");
  }

  return parsed;
}

async function fetchPublicHtml(rawUrl: string) {
  let url = await assertPublicUrl(rawUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          Accept: "text/html, text/plain;q=0.9",
          "User-Agent": "LitFocusAI/1.0",
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirectCount === MAX_REDIRECTS) {
          throw new Error("Too many redirects");
        }
        const location = response.headers.get("location");
        if (!location) {
          throw new Error("Redirect response did not include a destination");
        }
        url = await assertPublicUrl(new URL(location, url).toString());
        continue;
      }

      if (!response.ok) {
        throw new Error(`Source returned HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType && !/(text\/html|text\/plain|application\/xhtml\+xml)/i.test(contentType)) {
        throw new Error("The URL did not return an HTML or text document");
      }
      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > MAX_EXTRACTED_BYTES) {
        throw new Error("The source document is too large");
      }

      if (response.body) {
        const chunks: Buffer[] = [];
        let total = 0;
        for await (const chunk of response.body) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          total += buffer.length;
          if (total > MAX_EXTRACTED_BYTES) {
            throw new Error("The source document is too large");
          }
          chunks.push(buffer);
        }
        return { body: Buffer.concat(chunks).toString("utf8"), url: url.toString() };
      }

      const body = await response.text();
      if (Buffer.byteLength(body, "utf8") > MAX_EXTRACTED_BYTES) {
        throw new Error("The source document is too large");
      }
      return { body, url: url.toString() };
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Unable to fetch source");
}

function isAnalysis(value: unknown): value is {
  title: string;
  summary_short: string;
  summary_detailed: string;
  key_points: string[];
  keywords: string[];
  sentiment: string;
  reading_time: string;
} {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.title === "string" &&
    typeof candidate.summary_short === "string" &&
    typeof candidate.summary_detailed === "string" &&
    Array.isArray(candidate.key_points) &&
    candidate.key_points.every((item) => typeof item === "string") &&
    Array.isArray(candidate.keywords) &&
    candidate.keywords.every((item) => typeof item === "string") &&
    typeof candidate.sentiment === "string" &&
    typeof candidate.reading_time === "string"
  );
}

async function startServer() {
  const app = express();
  let genAI: GoogleGenAI | null = null;

  function getGenAI() {
    if (!genAI) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required");
      }
      genAI = new GoogleGenAI({ apiKey });
    }
    return genAI;
  }

  app.use(express.json({ limit: "1mb" }));

  app.post("/api/extract", async (req, res) => {
    const { url } = req.body as { url?: unknown };
    if (typeof url !== "string" || !url.trim()) {
      return res.status(400).json({ error: "A URL is required" });
    }

    try {
      const fetched = await fetchPublicHtml(url.trim());
      const dom = new JSDOM(fetched.body, { url: fetched.url });
      const article = new Readability(dom.window.document).parse();
      if (!article?.textContent?.trim()) {
        throw new Error("Could not extract article content");
      }
      return res.json({ text: article.textContent.trim(), title: article.title || "URL Analysis" });
    } catch (error) {
      console.error("Extraction failed:", error);
      const message = error instanceof Error && error.name === "AbortError"
        ? "The source request timed out"
        : error instanceof Error
          ? error.message
          : "Failed to extract content";
      return res.status(502).json({ error: message });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    const { text, mode } = req.body as { text?: unknown; mode?: unknown };
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Text is required for analysis" });
    }
    if (text.length > MAX_ANALYSIS_CHARS) {
      return res.status(413).json({ error: "Text exceeds the 30,000 character limit" });
    }
    if (mode !== undefined && (typeof mode !== "string" || !SUPPORTED_MODES.has(mode))) {
      return res.status(400).json({ error: "Invalid analysis mode" });
    }

    try {
      const ai = getGenAI();
      const prompt = `Analyze the following text according to the mode: "${mode || "key-points"}".

Mode descriptions:
- eli5: Explain like I'm five. Simple, relatable, easy to understand.
- deep-dive: Technical research dive. Detailed, covers nuances, methodologies, and core arguments.
- key-points: Key point extraction. Focus on the most important takeaways.

Text to analyze:
${text}`;

      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary_short: { type: Type.STRING },
              summary_detailed: { type: Type.STRING },
              key_points: { type: Type.ARRAY, items: { type: Type.STRING } },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              sentiment: { type: Type.STRING },
              reading_time: { type: Type.STRING },
            },
            required: ["title", "summary_short", "summary_detailed", "key_points", "keywords", "sentiment", "reading_time"],
          },
        },
      });

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.text || "");
      } catch {
        throw new Error("AI returned invalid JSON");
      }
      if (!isAnalysis(parsed)) {
        throw new Error("AI returned an incomplete analysis");
      }
      return res.json(parsed);
    } catch (error) {
      console.error("Analysis failed:", error);
      return res.status(502).json({
        error: error instanceof Error ? error.message : "Failed to analyze content",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Server failed to start:", error);
  process.exitCode = 1;
});
