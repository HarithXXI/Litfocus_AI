<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# LitFocus AI

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/ff89f5c6-72b5-4af6-93d3-2a0ea7b6c773

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY` to your Gemini API key. The server loads `.env.local` automatically.
3. Run the app:
   `npm run dev`

Upload support is limited to TXT, CSV, DOCX, and XLSX files (up to 50 MB). URL extraction accepts public HTTP(S) pages only.
