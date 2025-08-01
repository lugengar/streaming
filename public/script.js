const video = document.getElementById('video');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${protocol}://${window.location.host}`);
let peerConnection;

async function startStream() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  video.srcObject = stream;

  ws.send(JSON.stringify({ type: 'broadcaster' }));

  ws.onmessage = async (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'watcher') {
      peerConnection = new RTCPeerConnection();
      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: 'offer', sdp: offer }));
    }

    if (message.type === 'answer') {
      const desc = new RTCSessionDescription(message.sdp);
      await peerConnection.setRemoteDescription(desc);
    }

    if (message.type === 'candidate') {
      const candidate = new RTCIceCandidate(message.candidate);
      await peerConnection.addIceCandidate(candidate);
    }

    if (message.type === 'chat') {
      addChatMessage(`${message.from}: ${message.message}`);
    }
  };
}

function sendChat() {
  const msg = chatInput.value.trim();
  if (!msg) return;
  ws.send(JSON.stringify({ type: 'chat', message: msg }));
  addChatMessage(`Yo: ${msg}`);
  chatInput.value = '';
}

function addChatMessage(msg) {
  const div = document.createElement('div');
  div.textContent = msg;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
