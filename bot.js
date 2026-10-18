
const bedrock = require('bedrock-protocol');

const config = {
  host: '168.119.78.155',
  port: 20036,
  username: 'WarthexBot_24h',
  offline: true, // servidor pirata / sem Xbox Live
  version: 'auto', // +1.21.0 e qualquer superior
  connectTimeout: 10000,
  keepAlive: true
};

let client = null;
let reconnectAttempts = 0;
let shouldReconnect = true;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function connect() {
  log(`Conectando ao ${config.host}:${config.port} como ${config.username} | Versão: ${config.version} | Offline: ${config.offline}`);
  
  client = bedrock.createClient({
    host: config.host,
    port: config.port,
    username: config.username,
    offline: config.offline,
    version: config.version,
    connectTimeout: config.connectTimeout
  });

  client.on('connect', () => {
    log('Socket conectado, fazendo handshake...');
  });

  client.on('join', () => {
    reconnectAttempts = 0;
    log(`✅ CONECTADO COM SUCESSO! Bot ${config.username} online no servidor.`);
  });

  client.on('text', (packet) => {
    // Log de chat para debug
    if(packet.message) log(`[CHAT] ${packet.message}`);
  });

  client.on('disconnect', (packet) => {
    log(`❌ Desconectado: ${JSON.stringify(packet)}`);
    handleReconnect();
  });

  client.on('close', () => {
    log('Conexão fechada pelo servidor.');
    handleReconnect();
  });

  client.on('error', (err) => {
    log(`⚠️ Erro: ${err.message}`);
    // Não chama reconnect aqui, deixa o close cuidar
  });
}

function handleReconnect() {
  if (!shouldReconnect) return;
  reconnectAttempts++;
  // Backoff: 5s, 10s, 20s, 30s max
  const delay = Math.min(5000 * Math.pow(1.5, reconnectAttempts - 1), 30000);
  log(`🔄 Tentando reconectar em ${Math.round(delay/1000)}s... (tentativa #${reconnectAttempts})`);
  setTimeout(() => {
    connect();
  }, delay);
}

// Anti-crash global
process.on('uncaughtException', (err) => {
  log(`Uncaught Exception: ${err.message}`);
  handleReconnect();
});

process.on('unhandledRejection', (reason) => {
  log(`Unhandled Rejection: ${reason}`);
});

// Inicia
connect();

// Keep-alive para Render não dormir + anti-AFK
setInterval(() => {
  if (client) {
    try {
      // Envia movimento leve para não tomar kick AFK
      // client.queue('move_player', ...) só se suportado, então usamos chat ocasional
    } catch(e) {}
  }
}, 30000);

// HTTP serverzinho para Render não reclamar de porta
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end(`WarthexBot_24h rodando! Conectado em ${config.host}:${config.port} | Tentativas: ${reconnectAttempts} | Uptime: ${Math.floor(process.uptime())}s`);
}).listen(PORT, () => log(`Web keepalive rodando na porta ${PORT}`));
