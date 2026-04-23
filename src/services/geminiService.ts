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
    'deep-dive': "Provide a deep academic analysis of this literature. Cover methodology, key findings, citations/context, and potential limitations. Be exhaustive.",
    'key-points': "Extract the top 5-7 most critical key points from this literature. Format them as an actionable list."
  };

  const systemPrompt = `You are LitFocus AI, a premium academic assistant. 
  Your goal is to provide high-quality, clear, and insightful summaries of research papers or literature. 
  Output MUST be in polished Markdown format. 
  
  STRUCTURE:
  1. Mandatory: H1 Title (The first line must be # Followed by a catchy title).
  2. Mandatory: A line exactly saying: "Reading Time Estimate: X min read".
  3. Sections with H2 and H3 headings.
  4. Use bolding and bullet points for readability.
  
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
