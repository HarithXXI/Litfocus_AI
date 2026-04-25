import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Gemini AI lazily to avoid crashing if key is missing at startup
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

  app.use(express.json({ limit: '50mb' }));

  // API Route: Extract content from URL
  app.post("/api/extract", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const html = await response.text();
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (!article || !article.textContent) {
        throw new Error("Could not extract article content");
      }

      res.json({ text: article.textContent, title: article.title });
    } catch (error: any) {
      console.error("Extraction failed:", error);
      res.status(500).json({ error: error.message || "Failed to extract content" });
    }
  });

  // API Route: AI Analysis
  app.post("/api/analyze", async (req, res) => {
    const { text, mode } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required for analysis" });
    }

    try {
      const ai = getGenAI();
      const prompt = `Analyze the following text according to the mode: "${mode || 'key-points'}".
  
      Mode descriptions:
      - eli5: Explain like I'm five. Simple, relatable, easy to understand.
      - deep-dive: Technical research dive. Detailed, covers nuances, methodologies, and core arguments.
      - key-points: Key point extraction. Focus on the most important takeaways.

      Text to analyze:
      ${text.substring(0, 30000)} // Limiting to ~30k chars for safety
      `;

      const result = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary_short: { type: Type.STRING },
              summary_detailed: { type: Type.STRING },
              key_points: { type: Type.ARRAY, items: { type: Type.STRING } },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              sentiment: { type: Type.STRING },
              reading_time: { type: Type.STRING }
            },
            required: ['title', 'summary_short', 'summary_detailed', 'key_points', 'keywords', 'sentiment', 'reading_time']
          }
        }
      });

      res.json(JSON.parse(result.text));
    } catch (error: any) {
      console.error("Analysis failed:", error);
      res.status(500).json({ error: error.message || "Failed to analyze content" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
