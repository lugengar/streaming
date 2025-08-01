const video = document.getElementById('remoteVideo');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';

let ws;
let peerConnection;
let viewerName = '';

function playVideo() {
  viewerName = document.getElementById('viewerName').value.trim();
  if (!viewerName) {
    alert('Por favor ingresa tu nombre para ver el stream.');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const streamId = params.get('id');
  if (!streamId) {
    alert('No se encontró ID del stream en la URL.');
    return;
  }

  ws = new WebSocket(`${protocol}://${window.location.host}/?id=${streamId}`);

  ws.onopen = () => {
    console.log('WebSocket conectado como viewer.');
    ws.send(JSON.stringify({ type: 'watcher', watcherId: viewerName }));
  };

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'offer') {
      peerConnection = new RTCPeerConnection();

      peerConnection.ontrack = event => {
        video.srcObject = event.streams[0];
        video.play();
        document.getElementById('playButton').style.display = 'none';
      };

      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate, watcherId: viewerName }));
        }
      };

      await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: 'answer', sdp: answer, watcherId: viewerName }));
    }

    if (msg.type === 'candidate') {
      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
      }
    }

    if (msg.type === 'chat') {
      addChatMessage(`${msg.from}: ${msg.message}`);
    }

    if (msg.type === 'endStream') {
      video.srcObject = null;
      addChatMessage('📴 Transmisión finalizada.');
      ws.close();
    }
  };
}

function sendChat() {
  const msg = chatInput.value.trim();
  if (!msg) return;
  if (!viewerName) {
    alert('Debes ingresar un nombre para enviar mensajes.');
    return;
  }
  ws.send(JSON.stringify({ type: 'chat', message: msg, from: viewerName }));
  addChatMessage(`Yo (${viewerName}): ${msg}`);
  chatInput.value = '';
}

function addChatMessage(msg) {
  const div = document.createElement('div');
  div.textContent = msg;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
