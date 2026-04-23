import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzePaperStream(
  input: string, 
  mode: 'eli5' | 'deep-dive' | 'key-points',
  fileData?: { data: string, mimeType: string }
) {
  const model = "gemini-3-flash-preview";
  
  const prompts = {
    'eli5': "Explain this literature/research paper like I'm 5 years old. Use simple metaphors and focus on the 'why' and 'how'.",
    'deep-dive': "Analyze this literature thoroughly but efficiently. Synthesize the methodology, core findings, and critical limitations. Prioritize high-impact insights over length.",
    'key-points': "Extract the top 5-7 most critical key points from this literature. Format them as an actionable list."
  };

  const systemPrompt = `You are LitFocus AI, a high-speed academic research assistant. 
  Provide clear, synthesis-driven summaries without unnecessary introductory fluff or repetition. 
  Output MUST be in polished Markdown format. 
  
  STRUCTURE:
  1. Mandatory: H1 Title (The first line must be # Followed by a catch-all title).
  2. Mandatory: A line exactly saying: "Reading Time Estimate: X min read".
  3. Sections with H2 and H3 headings.
  4. Use bolding and bullet points for high scannability.
  
  Conciseness is a priority. Deliver insights immediately.
  Current mode: ${prompts[mode]}`;

  const contents: any[] = [
    { text: `System: ${systemPrompt}\n\nUser Message: ${input || "Please analyze the attached file."}` }
  ];

  if (fileData) {
    contents.push({
      inlineData: {
        data: fileData.data,
        mimeType: fileData.mimeType
      }
    });
  }

  try {
    return await ai.models.generateContentStream({
      model: model,
      contents: [{ parts: contents }],
    });
  } catch (error) {
    console.error("AI Analysis Error:", error);
    throw error;
  }
}
