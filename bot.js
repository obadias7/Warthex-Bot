const bedrock = require('bedrock-protocol');
const config = {
  host: 'obsidianorb.falix.pro',
  port: 20036,
  username: 'WarthexBot_24h',
  offline: true,
  version: 'auto'
};

function log(m){console.log(`[${new Date().toISOString()}] ${m}`)}

function connect(){
  log(`Conectando em ${config.host}:${config.port} como ${config.username}...`);
  const client = bedrock.createClient(config);
  client.on('join', ()=>log(`✅ CONECTADO! ${config.username} online!`));
  client.on('disconnect', (p)=>{log(`Desconectado: ${JSON.stringify(p)}`); setTimeout(connect,5000)});
  client.on('close', ()=>{log('Fechado, reconectando...'); setTimeout(connect,5000)});
  client.on('error', (e)=>log(`Erro: ${e.message}`));
}
connect();

require('http').createServer((_,r)=>r.end('Bot online')).listen(process.env.PORT||3000, ()=>log('Web OK'));
