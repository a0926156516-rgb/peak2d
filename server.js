// 攀巔 2D — WebSocket relay server (Node 20+, ws). Host is authoritative; server only routes.
const http = require("http");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const MAX = 4;
const NCOL = 4; // must match COLORS.length in index.html
const roster = (r) => [...r.players.values()].map((p) => ({ id: p.id, n: p.name, g: p.g, c: p.color, h: p === r.host ? 1 : 0 }));
const bcRoster = (r) => { const pl = roster(r); for (const p of r.players.values()) send(p, { t: "roster", pl }); };
const takenBy = (r, col, except) => [...r.players.values()].find((p) => p !== except && p.color === col);
function assignColor(r, c, want) {
  want = Number(want);
  if (Number.isInteger(want) && want >= 0 && want < NCOL && !takenBy(r, want, c)) return want;
  for (let i = 0; i < NCOL; i++) if (!takenBy(r, i, c)) return i;
  return 0;
}
const gender = (g) => (g === "f" ? "f" : "m");
const rooms = new Map(); // code -> {code, host, players:Map, started}
const clients = new Set();
const send = (c, o) => { try { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(o)); } catch {} };
const rid = () => Array.from(crypto.randomBytes(6), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
function newCode() {
  for (let i = 0; i < 200; i++) { const c = String(crypto.randomInt(10000)).padStart(4, "0"); if (!rooms.has(c)) return c; }
  return null;
}
function leave(c) {
  const r = c.room; if (!r) return;
  c.room = null; r.players.delete(c.id);
  if (r.host === c) {
    rooms.delete(r.code);
    for (const p of r.players.values()) { send(p, { t: "host-left" }); p.room = null; try { p.ws.close(); } catch {} }
  } else { send(r.host, { t: "peer-leave", id: c.id }); bcRoster(r); }
}
function onMessage(c, raw) {
  if (raw.length > 64000) return;
  let m; try { m = JSON.parse(raw); } catch { return; }
  if (!m || typeof m.t !== "string") return;
  c.alive = true;
  const name = String(m.name ?? "玩家").slice(0, 8);
  switch (m.t) {
    case "pong": return;
    case "create": {
      if (c.room) leave(c);
      const code = newCode(); if (!code) return send(c, { t: "error", e: "nocode" });
      c.name = name;
      const r = { code, host: c, players: new Map([[c.id, c]]), started: false };
      rooms.set(code, r); c.room = r; c.g = gender(m.g); c.color = assignColor(r, c, m.c);
      send(c, { t: "created", code, id: c.id });
      return bcRoster(r);
    }
    case "join": {
      const code = String(m.code ?? "");
      if (!/^\d{4}$/.test(code)) return send(c, { t: "error", e: "bad" });
      const r = rooms.get(code);
      if (!r) return send(c, { t: "error", e: "notfound" });
      if (r.players.size >= MAX) return send(c, { t: "error", e: "full" });
      if (c.room) leave(c);
      c.name = name; c.g = gender(m.g); c.color = assignColor(r, c, m.c); c.room = r; r.players.set(c.id, c);
      send(c, { t: "joined", code, id: c.id, hostId: r.host.id, started: r.started });
      send(r.host, { t: "peer-join", id: c.id, name });
      return bcRoster(r);
    }
    case "pickColor": {
      const r = c.room; if (!r) return;
      const want = Number(m.c);
      if (!Number.isInteger(want) || want < 0 || want >= NCOL) return;
      const t = takenBy(r, want, c);
      if (t) return send(c, { t: "colorTaken", c: want, by: t.name, pl: roster(r) });
      c.color = want; return bcRoster(r);
    }
    case "pickGender": {
      const r = c.room; if (!r) return;
      c.g = gender(m.g); return bcRoster(r);
    }
    case "started": if (c.room && c.room.host === c) c.room.started = true; return;
    case "lobbyBack": if (c.room && c.room.host === c) c.room.started = false; return;
    case "leave": return leave(c);
    case "kick": {
      const r = c.room; if (!r || r.host !== c) return;
      const p = r.players.get(String(m.id)); if (p && p !== c) { leave(p); try { p.ws.close(); } catch {} }
      return;
    }
    case "msg": {
      const r = c.room; if (!r) return;
      if (r.host === c) {
        if (m.to) { const p = r.players.get(String(m.to)); if (p) send(p, { t: "msg", from: c.id, d: m.d }); }
        else for (const p of r.players.values()) if (p !== c) send(p, { t: "msg", from: c.id, d: m.d });
      } else send(r.host, { t: "msg", from: c.id, d: m.d });
    }
  }
}

const server = http.createServer((req, res) => {
  const path = (req.url || "/").split("?")[0];
  if (path === "/" || path === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "access-control-allow-origin": "*", "cache-control": "no-store" });
    return res.end(`ok rooms=${rooms.size} clients=${clients.size} houli=${hTotal} shards=${shards.length}`);
  }
  res.writeHead(404); res.end("not found");
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
const hwss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });
server.on("upgrade", (req, sock, head) => {
  const p = (req.url || "/").split("?")[0];
  if (p === "/ws") wss.handleUpgrade(req, sock, head, (ws) => wss.emit("connection", ws, req));
  else if (p === "/houli") hwss.handleUpgrade(req, sock, head, (ws) => hwss.emit("connection", ws, req));
  else { sock.write("HTTP/1.1 404 Not Found\r\n\r\n"); sock.destroy(); }
});
// ---- 后里騎跡 shared open world (separate protocol, path /houli) ----
const HMAX = 100; const shards = []; let hTotal = 0;
const num = (v, lo, hi) => { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0; };
const hsend = (c, o) => { try { if (c.ws.readyState === 1) c.ws.send(typeof o === "string" ? o : JSON.stringify(o)); } catch {} };
function hprof(c, m) {
  c.n = String(m.n ?? "騎士").replace(/[\u0000-\u001f<>]/g, "").slice(0, 10) || "騎士";
  c.ch = m.ch === "f" ? "f" : "m"; c.co = num(m.co, 0, 3) | 0; c.v = ["bike", "scooter", "car"].includes(m.v) ? m.v : "bike";
}
hwss.on("connection", (ws) => {
  const c = { ws, id: rid(), alive: true, shard: null, x: 0, y: 0, h: 0, s: 0, n: "騎士", ch: "m", co: 0, v: "bike", seen: false };
  ws.on("message", (data) => {
    let m; const raw = data.toString(); if (raw.length > 2000) return; try { m = JSON.parse(raw); } catch { return; } if (!m) return;
    c.alive = true;
    if (m.t === "hello" && !c.shard) {
      hprof(c, m);
      let sh = shards.find((s) => s.size < HMAX); if (!sh) { sh = new Map(); shards.push(sh); }
      sh.set(c.id, c); c.shard = sh; hTotal++;
      hsend(c, { t: "welcome", id: c.id, shard: shards.indexOf(sh) + 1 });
    } else if (!c.shard) return;
    else if (m.t === "s") { c.x = num(m.x, -5000, 5000); c.y = num(m.y, -5000, 5000); c.h = num(m.h, -100, 100); c.s = num(m.s, -100, 100); c.seen = true; }
    else if (m.t === "p") hprof(c, m);
    else if (m.t === "e") { const k = String(m.k ?? "").slice(0, 8); const o = JSON.stringify({ t: "e", id: c.id, k }); for (const p of c.shard.values()) if (p !== c) hsend(p, o); }
    else if (m.t === "pong") return;
  });
  ws.on("pong", () => { c.alive = true; });
  ws.on("close", () => { if (c.shard) { c.shard.delete(c.id); hTotal--; const o = JSON.stringify({ t: "bye", id: c.id }); for (const p of c.shard.values()) hsend(p, o); } });
  ws.on("error", () => {});
});
setInterval(() => {
  for (let i = 0; i < shards.length; i++) {
    const sh = shards[i]; if (!sh.size) continue;
    const r1 = (v) => Math.round(v * 10) / 10;
    const all = [...sh.values()].filter((p) => p.seen).map((p) => [p.id, r1(p.x), r1(p.y), Math.round(p.h * 100) / 100, r1(p.s), p.n, p.ch, p.co, p.v]);
    const o = JSON.stringify({ t: "w", n: sh.size, tot: hTotal, sh: i + 1, p: all });
    for (const p of sh.values()) hsend(p, o);
  }
}, 100);
setInterval(() => {
  for (const sh of shards) for (const c of sh.values()) { if (!c.alive) { try { c.ws.terminate(); } catch {} continue; } c.alive = false; try { c.ws.ping(); } catch {} }
}, 20000);
wss.on("connection", (ws) => {
  const c = { ws, id: rid(), name: "", room: null, alive: true, g: "m", color: 0 };
  clients.add(c);
  ws.on("message", (data) => { try { onMessage(c, data.toString()); } catch (e) { console.error(e); } });
  ws.on("pong", () => { c.alive = true; });
  ws.on("close", () => { clients.delete(c); leave(c); });
  ws.on("error", () => {});
});
setInterval(() => {
  for (const c of clients) {
    if (!c.alive) { try { c.ws.terminate(); } catch {} continue; }
    c.alive = false; send(c, { t: "ping" }); try { c.ws.ping(); } catch {}
  }
}, 20000);
const port = Number(process.env.PORT || 10000);
server.listen(port, () => console.log(`relay listening on :${port}`));
