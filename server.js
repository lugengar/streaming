const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

// Solo permitir tu dominio

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
app.use(cors({
  origin: 'https://barbiniwebdesign.com.ar'
}));

const streams = {}; // { streamId: { broadcasterWs, title, name, watchers: { watcherId: ws } } }

wss.on('connection', (ws, req) => {
  const streamId = new URL(req.url, `http://${req.headers.host}`).searchParams.get('id');
  ws.streamId = streamId;

  ws.on('message', (message) => {
    const msg = JSON.parse(message);

    if (msg.type === 'broadcaster') {
      streams[streamId] = streams[streamId] || {};
      streams[streamId].broadcasterWs = ws;
      streams[streamId].name = msg.name || 'Streamer desconocido';
      streams[streamId].watchers = {};
      console.log(`Stream ${streamId} iniciado por ${streams[streamId].name}`);
    }

    if (msg.type === 'setTitle') {
      streams[streamId] = streams[streamId] || {};
      streams[streamId].title = msg.title || 'Sin título';
      console.log(`Título stream ${streamId} seteado a: ${streams[streamId].title}`);
    }

    if (msg.type === 'watcher' && streams[streamId]?.broadcasterWs) {
      const watcherId = msg.watcherId || `w${Date.now()}`;
      streams[streamId].watchers[watcherId] = ws;
    
      ws.watcherId = watcherId;
      ws.otherClient = streams[streamId].broadcasterWs;
    
      streams[streamId].broadcasterWs.send(JSON.stringify({ type: 'watcher', watcherId }));
    
      // 👉 Enviar cantidad de viewers
      const viewerCount = Object.keys(streams[streamId].watchers).length;
      streams[streamId].broadcasterWs.send(JSON.stringify({ type: 'viewerCount', count: viewerCount }));
    
      // 👉 Enviar a todos los watchers también (opcional)
      for (const wId in streams[streamId].watchers) {
        streams[streamId].watchers[wId].send(JSON.stringify({ type: 'viewerCount', count: viewerCount }));
      }
    
      console.log(`Watcher ${watcherId} conectado. Viewers: ${viewerCount}`);
    }
    

    if (msg.type === 'offer') {
      if (streams[streamId]?.watchers[msg.watcherId]) {
        streams[streamId].watchers[msg.watcherId].send(JSON.stringify({ type: 'offer', sdp: msg.sdp }));
      }
    }

    if (msg.type === 'answer') {
      if (streams[streamId]?.broadcasterWs) {
        streams[streamId].broadcasterWs.send(JSON.stringify({ type: 'answer', sdp: msg.sdp, watcherId: msg.watcherId }));
      }
    }

    if (msg.type === 'candidate') {
      if (msg.watcherId && streams[streamId]?.watchers[msg.watcherId]) {
        streams[streamId].watchers[msg.watcherId].send(JSON.stringify({ type: 'candidate', candidate: msg.candidate }));
      } else if (streams[streamId]?.broadcasterWs) {
        streams[streamId].broadcasterWs.send(JSON.stringify({ type: 'candidate', candidate: msg.candidate, watcherId: msg.watcherId }));
      }
    }

    if (msg.type === 'chat') {
      // Reenviar chat a broadcaster y watchers, con nombre
      if (ws === streams[streamId]?.broadcasterWs) {
        // Desde streamer a watchers
        for (const wId in streams[streamId].watchers) {
          if (streams[streamId].watchers[wId] !== ws) {
            streams[streamId].watchers[wId].send(JSON.stringify({ type: 'chat', from: streams[streamId].name, message: msg.message }));
          }
        }
      } else {
        // Desde watcher a broadcaster y otros watchers
        const fromName = msg.from || ws.watcherId;
        if (streams[streamId]?.broadcasterWs && streams[streamId].broadcasterWs !== ws) {
          streams[streamId].broadcasterWs.send(JSON.stringify({ type: 'chat', from: fromName, message: msg.message }));
        }
        for (const wId in streams[streamId].watchers) {
          if (streams[streamId].watchers[wId] !== ws) {
            streams[streamId].watchers[wId].send(JSON.stringify({ type: 'chat', from: fromName, message: msg.message }));
          }
        }
      }
    }

    if (msg.type === 'endStream') {
      // El streamer cerró el stream
      if (streams[streamId]) {
        for (const wId in streams[streamId].watchers) {
          streams[streamId].watchers[wId].send(JSON.stringify({ type: 'endStream' }));
          streams[streamId].watchers[wId].close();
        }
        delete streams[streamId];
        console.log(`Stream ${streamId} finalizado.`);
      }
    }
  });

  ws.on('close', () => {
    if (ws === streams[streamId]?.broadcasterWs) {
      // El streamer se desconectó
      if (streams[streamId]) {
        for (const wId in streams[streamId].watchers) {
          streams[streamId].watchers[wId].send(JSON.stringify({ type: 'endStream' }));
          streams[streamId].watchers[wId].close();
        }
        delete streams[streamId];
        console.log(`Stream ${streamId} finalizado (broadcaster desconectado).`);
      }
    } else if (ws.watcherId && streams[streamId]?.watchers) {
      delete streams[streamId].watchers[ws.watcherId];
      console.log(`Watcher ${ws.watcherId} desconectado de stream ${streamId}`);
    
      // 👉 Enviar cantidad actualizada de viewers
      if (streams[streamId]?.broadcasterWs) {
        const viewerCount = Object.keys(streams[streamId].watchers).length;
        streams[streamId].broadcasterWs.send(JSON.stringify({ type: 'viewerCount', count: viewerCount }));
    
        // 👉 También a los watchers restantes (opcional)
        for (const wId in streams[streamId].watchers) {
          streams[streamId].watchers[wId].send(JSON.stringify({ type: 'viewerCount', count: viewerCount }));
        }
      }
    }
    
  });
});

app.get('/streams', (req, res) => {
  const lista = Object.entries(streams).map(([id, data]) => ({
    id,
    title: data.title || 'Sin título',
    streamerName: data.name || 'Streamer desconocido'
  }));
  res.json(lista);
});

//app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor escuchando en http://localhost:${PORT}`));
