#!/usr/bin/env node
// Pre-render the tour narration: voice af_heart (Kokoro) through the local lhi-lcb-tts service (loopback), one clip per step.
// Synthesised PER SENTENCE (the model silently truncates long inputs), joined with short pauses, encoded to small mono mp3.
// Run on DigitalOcean:  node make-audio.mjs [--only WEB-4]     Output: tour/audio/<id>.mp3 (committed, so the public page needs no TTS access)
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { DEFS } from './steps.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'audio'); fs.mkdirSync(out, { recursive: true });
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : '';
const TTS = process.env.LHI_TTS_URL || 'http://127.0.0.1:7073/v1/audio/speech';
const tmp = fs.mkdtempSync('/tmp/eci-tour-audio-');
for (const d of DEFS) {
  if (only && d.id !== only) continue;
  const sentences = d.say.match(/[^.!?]+[.!?]+/g).map((s) => s.trim());
  const files = [];
  for (let i = 0; i < sentences.length; i++) {
    const r = await fetch(TTS, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: sentences[i], voice: 'af_heart', speed: 1, response_format: 'wav' }) });
    if (!r.ok) throw new Error(`TTS ${r.status} for ${d.id} sentence ${i + 1}: ${(await r.text()).slice(0, 120)}`);
    const f = path.join(tmp, `${d.id}-${i}.wav`); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); files.push(f);
  }
  const list = path.join(tmp, `${d.id}.txt`);
  const sil = path.join(tmp, 'sil.wav');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '0.28', sil], { stdio: 'ignore' });
  fs.writeFileSync(list, files.map((f) => `file '${f}'\nfile '${sil}'`).join('\n'));
  const m = spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '56k', path.join(out, d.id + '.mp3')], { stdio: 'ignore' });
  if (m.status !== 0) throw new Error('ffmpeg failed for ' + d.id);
  console.log(d.id, sentences.length + ' sentence(s)', (fs.statSync(path.join(out, d.id + '.mp3')).size / 1024).toFixed(0) + ' KB');
}
fs.rmSync(tmp, { recursive: true, force: true });
