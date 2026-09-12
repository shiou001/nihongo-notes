// mock-supabase.mjs — 本機假的 Supabase RPC 端點，用來離線測試同步流程。
// 用法：node sync/mock-supabase.mjs   （聽 http://localhost:54321）
// 然後把 data/sync-config.js 暫時改成 url: 'http://localhost:54321', anonKey: 'mock'
import http from 'node:http';
import { createHash } from 'node:crypto';

const store = new Map(); // code_hash -> { data, updated_at }
const hash = s => createHash('sha256').update(s).digest('hex');

http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    const m = req.url.match(/^\/rest\/v1\/rpc\/(progress_get|progress_put)$/);
    if (!m || req.method !== 'POST') { res.writeHead(404, cors); return res.end('{"message":"not found"}'); }
    const p = JSON.parse(body || '{}');
    if (!p.p_code || p.p_code.length < 12) { res.writeHead(400, cors); return res.end('{"message":"sync code too short"}'); }
    const k = hash(p.p_code);
    if (m[1] === 'progress_get') {
      const row = store.get(k);
      console.log('GET', p.p_code, row ? 'hit' : 'miss');
      res.writeHead(200, cors); return res.end(row ? JSON.stringify(row.data) : 'null');
    }
    const at = new Date().toISOString();
    store.set(k, { data: p.p_data, updated_at: at });
    console.log('PUT', p.p_code, Object.keys(p.p_data?.items || {}).length, 'items');
    res.writeHead(200, cors); res.end(JSON.stringify(at));
  });
}).listen(54321, () => console.log('🧪 mock Supabase RPC on http://localhost:54321'));
