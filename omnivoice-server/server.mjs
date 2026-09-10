import http from "node:http";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

// Minimal local TTS server matching the OmniVoice contract expected by
// AI-auto-generate-video: POST /tts { text } -> audio/mpeg bytes.
// Backed by Microsoft Edge's free neural TTS (no API key, no model download).

const PORT = process.env.PORT ?? 8123;
const VOICE = process.env.TTS_VOICE ?? "vi-VN-HoaiMyNeural"; // vi-VN-NamMinhNeural for male voice

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/tts") {
    res.writeHead(404).end("Not found");
    return;
  }

  try {
    const raw = await readBody(req);
    const { text } = JSON.parse(raw);
    if (!text || typeof text !== "string") {
      res.writeHead(400).end("Missing 'text'");
      return;
    }

    const tts = new MsEdgeTTS();
    await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text);
    const audio = await streamToBuffer(audioStream);
    tts.close();

    res.writeHead(200, { "Content-Type": "audio/mpeg", "Content-Length": audio.length });
    res.end(audio);
  } catch (err) {
    console.error("TTS error:", err);
    res.writeHead(500).end("TTS generation failed");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`OmniVoice-compatible TTS server listening on http://127.0.0.1:${PORT} (voice: ${VOICE})`);
});
