const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let broadcaster;

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const msg = JSON.parse(message);

    if (msg.type === 'broadcaster') {
      broadcaster = ws;
    } else if (msg.type === 'watcher' && broadcaster) {
      ws.otherClient = broadcaster;
      broadcaster.otherClient = ws;
      broadcaster.send(JSON.stringify({ type: 'watcher' }));
    } else if (msg.type === 'offer') {
      ws.otherClient.send(JSON.stringify({ type: 'offer', sdp: msg.sdp }));
    } else if (msg.type === 'answer') {
      ws.otherClient.send(JSON.stringify({ type: 'answer', sdp: msg.sdp }));
    } else if (msg.type === 'candidate') {
      ws.otherClient.send(JSON.stringify({ type: 'candidate', candidate: msg.candidate }));
    } else if (msg.type === 'chat') {
      // Reenviar mensajes de chat entre broadcaster y watcher
      if (ws === broadcaster && ws.otherClient) {
        ws.otherClient.send(JSON.stringify({ type: 'chat', from: 'Streamer', message: msg.message }));
      } else if (ws !== broadcaster && broadcaster) {
        broadcaster.send(JSON.stringify({ type: 'chat', from: 'Viewer', message: msg.message }));
      }
    }
  });
  ws.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'endStream') {
      alert('El stream ha finalizado.'); // ❌ Error: alert no existe en Node.js
      ws.close();
      video.srcObject = null; // ❌ Error: video no existe en Node.js
    }
  };
  
  
  ws.on('close', () => {
    if (ws === broadcaster) {
      broadcaster = null;
    }
  });
});

app.use(express.static('public'));

server.listen(3000, () => console.log('Servidor en http://localhost:3000'));
