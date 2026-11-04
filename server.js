// 攀巔 2D — WebSocket relay server (Node 20+, ws). Host is authoritative; server only routes.
const http = require("http");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const MAX = 4;
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
  } else send(r.host, { t: "peer-leave", id: c.id });
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
      rooms.set(code, r); c.room = r;
      return send(c, { t: "created", code, id: c.id });
    }
    case "join": {
      const code = String(m.code ?? "");
      if (!/^\d{4}$/.test(code)) return send(c, { t: "error", e: "bad" });
      const r = rooms.get(code);
      if (!r) return send(c, { t: "error", e: "notfound" });
      if (r.players.size >= MAX) return send(c, { t: "error", e: "full" });
      if (r.started) return send(c, { t: "error", e: "started" });
      if (c.room) leave(c);
      c.name = name; c.room = r; r.players.set(c.id, c);
      send(c, { t: "joined", code, id: c.id, hostId: r.host.id });
      return send(r.host, { t: "peer-join", id: c.id, name });
    }
    case "started": if (c.room && c.room.host === c) c.room.started = true; return;
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
    return res.end(`ok rooms=${rooms.size} clients=${clients.size}`);
  }
  res.writeHead(404); res.end("not found");
});
const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 64 * 1024 });
wss.on("connection", (ws) => {
  const c = { ws, id: rid(), name: "", room: null, alive: true };
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
