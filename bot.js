const bedrock = require('bedrock-protocol');

const config = {
  host: '168.119.78.155',
  port: 20036,
  username: 'WarthexBot_24h',
  offline: true,
  version: 'auto',
  connectTimeout: 10000,
  keepAlive: true
};

let client = null;
let reconnectAttempts = 0;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function connect() {
  log(`Conectando ao ${config.host}:${config.port} como ${config.username}`);
  
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

  client.on('disconnect', (packet) => {
    log(`❌ Desconectado: ${JSON.stringify(packet)}`);
    handleReconnect();
  });

  client.on('close', () => {
    log('Conexão fechada.');
    handleReconnect();
  });

  client.on('error', (err) => {
    log(`⚠️ Erro: ${err.message}`);
  });
}

function handleReconnect() {
  reconnectAttempts++;
  const delay = Math.min(5000 * Math.pow(1.5, reconnectAttempts - 1), 30000);
  log(`🔄 Reconectando em ${Math.round(delay/1000)}s... (tentativa #${reconnectAttempts})`);
  setTimeout(connect, delay);
}

process.on('uncaughtException', (err) => {
  log(`Uncaught Exception: ${err.message}`);
  handleReconnect();
});

connect();

const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end(`WarthexBot_24h rodando! Uptime: ${Math.floor(process.uptime())}s`);
}).listen(PORT, () => log(`Web keepalive na porta ${PORT}`));
