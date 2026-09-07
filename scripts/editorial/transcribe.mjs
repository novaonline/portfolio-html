import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import {
  hash,
  write,
  writeJSON,
  readJSON,
  parse,
  serialize,
  record,
} from "./documents.mjs";
import { importFiles } from "./import.mjs";

export const MAX_AUDIO_BYTES = 25_000_000;
export function audioChunks(audio, directory) {
  if (!/\.(m4a|mp3|wav|mp4|webm)$/i.test(audio))
    throw new Error("Retranscription requires audio, not a text transcript");
  if (fs.statSync(audio).size < MAX_AUDIO_BYTES) return [audio];
  const chunkDir = path.join(directory, "chunks");
  fs.mkdirSync(chunkDir, { recursive: true });
  const complete = path.join(chunkDir, "complete.json");
  if (!fs.existsSync(complete)) {
    // 10 min at 64 kb/s is about 4.8 MB. Originals remain unchanged.
    execFileSync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        audio,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "64k",
        "-f",
        "segment",
        "-segment_time",
        "600",
        path.join(chunkDir, "%05d.mp3"),
      ],
      { stdio: "pipe" },
    );
    writeJSON(complete, {
      sourceSha256: hash(fs.readFileSync(audio)),
      segmentSeconds: 600,
    });
  }
  const chunks = fs
    .readdirSync(chunkDir)
    .filter((name) => /^\d{5}\.mp3$/.test(name))
    .sort()
    .map((name) => path.join(chunkDir, name));
  if (
    !chunks.length ||
    chunks.some((file) => fs.statSync(file).size >= MAX_AUDIO_BYTES)
  )
    throw new Error("Audio chunk exceeds upload limit");
  return chunks;
}
export async function transcribe(
  root,
  audio,
  {
    model = "gpt-transcribe",
    language = "en",
    prompt = "",
    request = fetch,
  } = {},
) {
  if (!process.env.OPENAI_API_KEY)
    throw new Error("OPENAI_API_KEY is not configured");
  audio = path.resolve(audio);
  if (!/\.(m4a|mp3|wav|mp4|webm)$/i.test(audio))
    throw new Error("Retranscription requires an audio file");
  const audioHash = hash(fs.readFileSync(audio));
  const jobId = hash(JSON.stringify({ audioHash, model, language, prompt }));
  const job = path.join(root, "media", "transcription-jobs", jobId);
  fs.mkdirSync(job, { recursive: true });
  const chunks = audioChunks(audio, job),
    parts = [];
  for (let i = 0; i < chunks.length; i++) {
    const cache = path.join(job, `${String(i).padStart(5, "0")}.json`);
    let result = readJSON(cache);
    if (!result) {
      const form = new FormData();
      form.set(
        "file",
        new Blob([fs.readFileSync(chunks[i])]),
        path.basename(chunks[i]),
      );
      form.set("model", model);
      form.set("language", language);
      form.set("response_format", "json");
      if (prompt) form.set("prompt", prompt);
      const response = await request(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          body: form,
          signal: AbortSignal.timeout(180000),
        },
      );
      if (!response.ok)
        throw new Error(
          `Transcription failed (HTTP ${response.status}); completed chunks are saved. Retry this command to resume.`,
        );
      const payload = await response.json();
      if (typeof payload.text !== "string")
        throw new Error("Transcription returned no text");
      result = {
        text: payload.text,
        index: i,
        chunkSha256: hash(fs.readFileSync(chunks[i])),
        at: new Date().toISOString(),
      };
      writeJSON(cache, result);
    }
    parts.push(result);
  }
  const output = path.join(
    job,
    path.basename(audio).replace(/\.[^.]+$/, ".txt"),
  );
  write(output, parts.map((part) => part.text.trim()).join("\n\n") + "\n");
  const sources = importFiles(root, [audio, output], {
    label: "openai-api-retranscription",
  });
  const transcriptHash = hash(fs.readFileSync(output));
  for (const source of sources) {
    const file = path.join(root, source),
      doc = parse(fs.readFileSync(file, "utf8"));
    const variant = doc.data.variants.find(
      (item) => item.sha256 === transcriptHash,
    );
    if (variant)
      variant.processing = {
        provider: "OpenAI",
        requestedModel: model,
        language,
        prompt,
        jobId,
        audioSha256: audioHash,
        chunks: parts.map(({ text: _, ...rest }) => rest),
      };
    write(file, serialize(doc.data, doc.body));
  }
  record(root, "transcription", {
    jobId,
    audioSha256: audioHash,
    transcriptSha256: transcriptHash,
    model,
    sources,
  });
  return {
    sources,
    jobId,
    transcriptSha256: transcriptHash,
    chunks: parts.length,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      root: { type: "string" },
      model: { type: "string" },
      language: { type: "string" },
      prompt: { type: "string" },
    },
  });
  try {
    console.log(
      await transcribe(
        path.resolve(values.root ?? process.env.EDITORIAL_ROOT ?? ".editorial"),
        positionals[0],
        values,
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
