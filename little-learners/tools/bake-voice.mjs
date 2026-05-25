#!/usr/bin/env node
/**
 * bake-voice.mjs — generate the Hoot voice pack from a phrase catalog.
 *
 * Reads tools/voice-phrases.json and produces one webm/opus clip per phrase
 * under audio/voice/<packId>/phrases/, then writes a manifest.json the
 * runtime can load.
 *
 * Requirements (macOS):
 *   - `say`     (built in)
 *   - `ffmpeg`  (brew install ffmpeg)
 *   - `ffprobe` (ships with ffmpeg)
 *
 * Usage:
 *   node tools/bake-voice.mjs                       # bake new/missing only
 *   node tools/bake-voice.mjs --force               # re-bake everything
 *   node tools/bake-voice.mjs --voice "Ava (Premium)"
 *   node tools/bake-voice.mjs --pack hoot-en-v1
 *
 * To use a non-macOS TTS, replace `synthOne()` below with a call to your
 * provider of choice (Azure, ElevenLabs, Piper CLI, etc.). The rest of the
 * pipeline (ffmpeg encode, ffprobe duration, manifest write) is engine
 * agnostic.
 */
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile, stat, unlink } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---- args ----
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : null;
};
const FORCE = !!flag('--force');
const VOICE = flag('--voice') || 'Ava (Premium)';
const PACK  = flag('--pack')  || 'hoot-en-v1';
const RATE  = Number(flag('--rate')) || 180; // words per minute for `say`

const PACK_DIR = join(ROOT, 'audio', 'voice', PACK);
const CLIPS_DIR = join(PACK_DIR, 'phrases');
const MANIFEST  = join(PACK_DIR, 'manifest.json');
const CATALOG   = join(ROOT, 'tools', 'voice-phrases.json');

async function exists(p) { try { await stat(p); return true; } catch { return false; } }

async function ensureTools() {
  for (const cmd of ['say', 'ffmpeg', 'ffprobe']) {
    try { await exec('which', [cmd]); }
    catch { throw new Error(`Missing required tool: ${cmd}. Install with: brew install ffmpeg`); }
  }
}

async function synthOne(id, text) {
  // 1) macOS `say` -> AIFF in a tmp file
  const aiff = join(tmpdir(), `pp-bake-${id}.aiff`);
  const webm = join(CLIPS_DIR, `${id}.webm`);
  await exec('say', ['-v', VOICE, '-r', String(RATE), '-o', aiff, text]);

  // 2) ffmpeg AIFF -> Opus/WebM. 24kbps mono is plenty for speech and gives
  //    us ~3kB/second of audio, so a 60-line pack fits in well under 1 MB.
  await exec('ffmpeg', [
    '-y', '-i', aiff,
    '-c:a', 'libopus', '-b:a', '24k', '-ac', '1', '-ar', '24000',
    '-application', 'voip',
    webm,
  ]);
  try { await unlink(aiff); } catch {}

  // 3) ffprobe for duration so the runtime can size its safety timeout.
  const { stdout } = await exec('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', webm,
  ]);
  const durationMs = Math.round(Number(stdout.trim()) * 1000) || 0;
  const { size } = await stat(webm);
  return { file: `phrases/${id}.webm`, text, durationMs, bytes: size };
}

async function loadManifest() {
  if (!(await exists(MANIFEST))) {
    return { id: PACK, label: 'Hoot Premium', voice: VOICE, lang: 'en-US', version: 1, clips: {} };
  }
  return JSON.parse(await readFile(MANIFEST, 'utf8'));
}

async function main() {
  await ensureTools();
  await mkdir(CLIPS_DIR, { recursive: true });
  const catalog = JSON.parse(await readFile(CATALOG, 'utf8'));
  const phrases = catalog.phrases || {};
  const manifest = await loadManifest();
  manifest.voice = VOICE;
  manifest.id = PACK;
  manifest.clips = manifest.clips || {};

  const ids = Object.keys(phrases);
  const results = [];
  let baked = 0, skipped = 0;

  for (const id of ids) {
    const text = phrases[id];
    const existing = manifest.clips[id];
    const clipPath = join(PACK_DIR, existing?.file || `phrases/${id}.webm`);
    const upToDate = existing && existing.text === text && await exists(clipPath);
    if (upToDate && !FORCE) {
      skipped++;
      results.push({ id, status: 'skip', bytes: existing.bytes || 0, ms: existing.durationMs || 0 });
      continue;
    }
    try {
      const meta = await synthOne(id, text);
      manifest.clips[id] = meta;
      baked++;
      results.push({ id, status: 'bake', bytes: meta.bytes, ms: meta.durationMs });
    } catch (err) {
      results.push({ id, status: 'fail', error: String(err.message || err) });
    }
  }

  // Drop manifest entries for phrases removed from the catalog.
  for (const id of Object.keys(manifest.clips)) {
    if (!phrases[id]) delete manifest.clips[id];
  }

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

  // Summary
  const totalBytes = Object.values(manifest.clips).reduce((s, c) => s + (c.bytes || 0), 0);
  const totalMs    = Object.values(manifest.clips).reduce((s, c) => s + (c.durationMs || 0), 0);
  const pad = (s, n) => String(s).padEnd(n);
  console.log('');
  console.log(`Pack:   ${PACK}`);
  console.log(`Voice:  ${VOICE}`);
  console.log(`Lines:  ${ids.length}  (baked: ${baked}, skipped: ${skipped})`);
  console.log(`Total:  ${(totalBytes / 1024).toFixed(1)} KB  ·  ${(totalMs / 1000).toFixed(1)}s`);
  const fails = results.filter(r => r.status === 'fail');
  if (fails.length) {
    console.log('\nFailures:');
    fails.forEach(f => console.log(`  ${pad(f.id, 20)} ${f.error}`));
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
