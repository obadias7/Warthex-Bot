/**
 * Warthex-Bot v1.1
 * It keeps a Minecraft Bedrock server (Falix) online, counting like a player in the server.
 * It just looks around- It doesn't walk.
 */
require('dotenv').config();
const bedrock = require('bedrock-protocol');
const http = require('http');

// ─── Config (env ou defaults) ───────────────────────────────────────────────
const config = {
  host: process.env.MC_HOST || 'obsidianorb.falix.pro',
  port: Number(process.env.MC_PORT || 21188),
  username: process.env.MC_USERNAME || 'WarthexBot_24h',
  offline: String(process.env.MC_OFFLINE || 'true').toLowerCase() !== 'false',
  // versão real do servidor (ex: 1.21.130 ou 1.26.0) — NÃO uses "auto"
  version: process.env.MC_VERSION || '1.21.130',
  httpPort: Number(process.env.PORT || process.env.HTTP_PORT || 3000),
  lookIntervalMs: Number(process.env.LOOK_INTERVAL_MS || 25000),
  reconnectBaseMs: Number(process.env.RECONNECT_BASE_MS || 5000),
  reconnectMaxMs: Number(process.env.RECONNECT_MAX_MS || 60000)
};

// ─── Estado ─────────────────────────────────────────────────────────────────
let client = null;
let connected = false;
let reconnectAttempt = 0;
let reconnectTimer = null;
let lookTimer = null;
let startedAt = Date.now();
let lastJoinAt = null;
let lastDisconnectReason = null;
let position = { x: 0, y: 64, z: 0 };
let runtimeId = 0;
let yaw = 0;
let pitch = 0;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function statusJson() {
  return {
    bot: config.username,
    target: `\( {config.host}: \){config.port}`,
    connected,
    uptime_sec: Math.floor((Date.now() - startedAt) / 1000),
    last_join: lastJoinAt,
    last_disconnect: lastDisconnectReason,
    reconnect_attempt: reconnectAttempt,
    version: config.version,
    offline: config.offline
  };
}

// ─── HTTP (keep-alive do host + status) ─────────────────────────────────────
const server = http.createServer((req, res) => {
  if (req.url === '/status' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(statusJson(), null, 2));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(connected ? 'Warthex-Bot ONLINE' : 'Warthex-Bot connecting...');
});

server.listen(config.httpPort, () => {
  log(`HTTP ok na porta ${config.httpPort}  →  /status`);
});

// ─── Anti-AFK: só olhar (rotação), sem mover posição ────────────────────────
function stopLooking() {
  if (lookTimer) {
    clearInterval(lookTimer);
    lookTimer = null;
  }
}

function startLooking() {
  stopLooking();
  lookTimer = setInterval(() => {
    if (!client || !connected) return;
    try {
      const delta = 15 + Math.floor(Math.random() * 26);
      yaw = (yaw + delta) % 360;
      pitch = Math.max(-20, Math.min(20, pitch + (Math.random() * 6 - 3)));
      sendLookOnly();
    } catch (e) {
      log(`Look error: ${e.message}`);
    }
  }, config.lookIntervalMs);
}

function sendLookOnly() {
  if (!client || !connected) return;

  const yawRad = (yaw * Math.PI) / 180;
  const pitchRad = (pitch * Math.PI) / 180;

  try {
    client.queue('player_auth_input', {
      pitch: pitchRad,
      yaw: yawRad,
      position: position,
      move_vector: { x: 0, z: 0 },
      head_yaw: yawRad,
      input_data: {},
      input_mode: 'mouse',
      play_mode: 'normal',
      interaction_model: 'touch',
      tick: BigInt(0),
      delta: { x: 0, y: 0, z: 0 },
      analogue_move_vector: { x: 0, z: 0 }
    });
    return;
  } catch (_) {}

  try {
    client.queue('move_player', {
      runtime_id: runtimeId || 1,
      position: position,
      pitch: pitch,
      yaw: yaw,
      head_yaw: yaw,
      mode: 'rotation',
      on_ground: true,
      ridden_runtime_id: 0,
      tick: BigInt(0)
    });
  } catch (e) {}
}

// ─── Conexão ────────────────────────────────────────────────────────────────
function clearReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  clearReconnect();
  stopLooking();
  connected = false;

  const exp = Math.min(
    config.reconnectMaxMs,
    config.reconnectBaseMs * Math.pow(1.5, Math.min(reconnectAttempt, 10))
  );
  const jitter = Math.floor(Math.random() * 1000);
  const wait = Math.floor(exp + jitter);
  reconnectAttempt += 1;

  log(`Reconectar em \( {wait}ms (tentativa # \){reconnectAttempt})...`);
  reconnectTimer = setTimeout(connect, wait);
}

function connect() {
  clearReconnect();

  if (client) {
    try {
      client.removeAllListeners();
      client.close();
    } catch (_) {}
    client = null;
  }

  log(`Conectando → \( {config.host}: \){config.port} como \( {config.username} (ver= \){config.version}, offline=${config.offline})`);

  const opts = {
    host: config.host,
    port: config.port,
    username: config.username,
    offline: config.offline,
    version: config.version
  };

  try {
    client = bedrock.createClient(opts);
  } catch (e) {
    log(`Falha ao criar client: ${e.message}`);
    scheduleReconnect();
    return;
  }

  client.on('join', () => {
    connected = true;
    reconnectAttempt = 0;
    lastJoinAt = new Date().toISOString();
    log(`✅ CONECTADO — ${config.username} conta como jogador ativo`);
    startLooking();
  });

  client.on('spawn', () => {
    log('Spawn recebido');
    if (connected) startLooking();
  });

  client.on('move_player', (packet) => {
    try {
      if (packet.position) {
        position = {
          x: packet.position.x,
          y: packet.position.y,
          z: packet.position.z
        };
      }
      if (typeof packet.runtime_id === 'number') runtimeId = packet.runtime_id;
    } catch (_) {}
  });

  client.on('start_game', (packet) => {
    try {
      if (packet.runtime_entity_id != null) {
        runtimeId = Number(packet.runtime_entity_id);
      }
      if (packet.player_position) {
        position = {
          x: packet.player_position.x,
          y: packet.player_position.y,
          z: packet.player_position.z
        };
      }
    } catch (_) {}
  });

  client.on('disconnect', (packet) => {
    lastDisconnectReason = packet;
    log(`Desconectado: ${JSON.stringify(packet)}`);
    scheduleReconnect();
  });

  client.on('close', () => {
    log('Conexão fechada');
    if (connected || reconnectAttempt === 0) {
      lastDisconnectReason = lastDisconnectReason || 'close';
      scheduleReconnect();
    }
  });

  client.on('error', (err) => {
    log(`Erro: ${err.message || err}`);
  });
}

// ─── Arranque ───────────────────────────────────────────────────────────────
connect();

process.on('SIGINT', () => {
  log('SIGINT — a sair...');
  stopLooking();
  clearReconnect();
  try {
    if (client) client.close();
  } catch (_) {}
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  log(`uncaughtException: ${err.message}`);
  scheduleReconnect();
});
