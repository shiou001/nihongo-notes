// jlpt-img.mjs — 把插圖統一成題本風格：白底、灰階、提高對比，存成 webp
//
// 用法：node tools/jlpt-img.mjs <原始圖檔> <名稱> --kind objects|scenes [--crop 寬:高:x:y]
//   objects（單一物品）→ 高 240px：img/jlpt/objects/<名稱>.webp
//   scenes（人物情境）→ 寬 900px：img/jlpt/scenes/<名稱>.webp
// 透明背景（いらすとや的 PNG）會先墊白底。每張圖的來源記在 jlpt-src/images.md。
// いらすとや：可以轉黑白、不能再散布原圖；AI 圖：有亂碼文字的要先遮掉或重畫。
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIZE = { objects: 'scale=-2:240', scenes: 'scale=900:-2' };

export function ffmpegArgs(input, output, kind, crop = '') {
  if (!SIZE[kind]) throw new Error('--kind 要是 objects 或 scenes');
  const style = `${crop ? `crop=${crop},` : ''}format=gray,eq=contrast=1.25:brightness=0.03,${SIZE[kind]}`;
  return ['-y', '-loglevel', 'error', '-i', input, '-f', 'lavfi', '-i', 'color=c=white',
    '-filter_complex', `[1:v][0:v]scale2ref[bg][fg];[bg][fg]overlay=shortest=1,${style}`,
    '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', output];
}

async function main() {
  const [input, name] = process.argv.slice(2);
  const opt = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : ''; };
  const kind = opt('--kind');
  if (!input || !name || !kind) { console.error('用法：node tools/jlpt-img.mjs <原始圖檔> <名稱> --kind objects|scenes [--crop 寬:高:x:y]'); process.exit(1); }
  const dir = path.join(root, 'img', 'jlpt', kind);
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, `${name}.webp`);
  await run('ffmpeg', ffmpegArgs(input, out, kind, opt('--crop')));
  console.log('完成：', path.relative(root, out));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exit(1); });
