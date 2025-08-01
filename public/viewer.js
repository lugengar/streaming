const video = document.getElementById('remoteVideo');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${protocol}://${window.location.host}`);
let peerConnection;
function playVideo() {
  const video = document.getElementById('remoteVideo');
  video.play();
  document.getElementById('playButton').style.display = 'none';
}

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'watcher' }));
};

ws.onmessage = async (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'offer') {
    peerConnection = new RTCPeerConnection();

    peerConnection.ontrack = event => {
      video.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
      }
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    ws.send(JSON.stringify({ type: 'answer', sdp: answer }));
  }

  if (message.type === 'candidate') {
    const candidate = new RTCIceCandidate(message.candidate);
    await peerConnection.addIceCandidate(candidate);
  }

  if (message.type === 'chat') {
    addChatMessage(`${message.from}: ${message.message}`);
  }
};

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
