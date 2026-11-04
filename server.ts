// 攀巔 2D — WebSocket relay server (Deno). Entrypoint: server.ts
// Rooms live in memory of a single isolate. Host is authoritative; server only routes.
type Client = { ws: WebSocket; id: string; name: string; room?: Room; alive: boolean };
type Room = { code: string; host: Client; players: Map<string, Client>; started: boolean };

const MAX = 4;
const rooms = new Map<string, Room>();
const send = (c: Client, o: unknown) => { try { if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(o)); } catch { /* ignore */ } };
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");

function newCode(): string | null {
  for (let i = 0; i < 200; i++) {
    const c = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    if (!rooms.has(c)) return c;
  }
  return null;
}

function leave(c: Client) {
  const r = c.room;
  if (!r) return;
  c.room = undefined;
  r.players.delete(c.id);
  if (r.host === c) {
    rooms.delete(r.code);
    for (const p of r.players.values()) { send(p, { t: "host-left" }); p.room = undefined; try { p.ws.close(); } catch { /**/ } }
  } else send(r.host, { t: "peer-leave", id: c.id });
}

function onMessage(c: Client, raw: string) {
  let m: Record<string, unknown>;
  try { m = JSON.parse(raw); } catch { return; }
  if (!m || typeof m.t !== "string" || raw.length > 64_000) return;
  c.alive = true;
  const name = String(m.name ?? "玩家").slice(0, 8);
  switch (m.t) {
    case "pong": return;
    case "create": {
      if (c.room) leave(c);
      const code = newCode();
      if (!code) return send(c, { t: "error", e: "nocode" });
      c.name = name;
      const r: Room = { code, host: c, players: new Map([[c.id, c]]), started: false };
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
      const p = r.players.get(String(m.id)); if (p && p !== c) { leave(p); try { p.ws.close(); } catch { /**/ } }
      return;
    }
    case "msg": {
      const r = c.room; if (!r) return;
      if (r.host === c) {
        if (m.to) { const p = r.players.get(String(m.to)); if (p) send(p, { t: "msg", from: c.id, d: m.d }); }
        else for (const p of r.players.values()) if (p !== c) send(p, { t: "msg", from: c.id, d: m.d });
      } else send(r.host, { t: "msg", from: c.id, d: m.d });
      return;
    }
  }
}

const clients = new Set<Client>();
setInterval(() => {
  for (const c of clients) {
    if (!c.alive) { try { c.ws.close(); } catch { /**/ } continue; }
    c.alive = false; send(c, { t: "ping" });
  }
}, 20_000);

const port = Number(Deno.env.get("PORT") ?? 8000);
Deno.serve({ port }, (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/ws") {
    if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") return new Response("expected websocket", { status: 426 });
    const { socket, response } = Deno.upgradeWebSocket(req);
    const c: Client = { ws: socket, id: rid(), name: "", alive: true };
    socket.onopen = () => clients.add(c);
    socket.onmessage = (e) => { try { onMessage(c, String(e.data)); } catch (err) { console.error(err); } };
    socket.onclose = () => { clients.delete(c); leave(c); };
    socket.onerror = () => {};
    return response;
  }
  if (url.pathname === "/") return new Response(`ok rooms=${rooms.size} clients=${clients.size}`, { headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response("not found", { status: 404 });
});
