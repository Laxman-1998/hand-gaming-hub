const videoElement = document.getElementById('webcam');
const mainCanvas = document.getElementById('output-canvas');
const mainCtx = mainCanvas.getContext('2d');
const lobbyCanvas = document.getElementById('lobby-mirror-canvas');
const lobbyCtx = lobbyCanvas.getContext('2d');
const lobbyLoaderText = document.getElementById('lobby-loader');
const statusCardBox = document.getElementById('status-card-box');
const statusMain = document.getElementById('battle-status-main');
const statusSub = document.getElementById('battle-status-sub');
const countdownNumberHTML = document.getElementById('battle-countdown-number');
const detectedGestureHTML = document.getElementById('detected-gesture');
const aiIntelHTML = document.getElementById('ai-intelligence-status');
const streakBannerHTML = document.getElementById('streak-banner');
const streakCountHTML = document.getElementById('streak-count');
const userScoreHTML = document.getElementById('user-score');
const aiScoreHTML = document.getElementById('ai-score');
const userScoreBox = document.getElementById('user-score-box');
const aiScoreBox = document.getElementById('ai-score-box');
const lobbyGhostHTML = document.getElementById('lobby-ghost-hand');
const arenaGhostHTML = document.getElementById('player-hand-avatar');
const aiEmojiHTML = document.getElementById('ai-emoji');
const playerCard = document.getElementById('player-card');
const aiCard = document.getElementById('ai-card');
const particleHTML = document.getElementById('score-particle');

let userScore = 0, aiScore = 0, winStreak = 0;
let isCountingDown = false, isArenaActive = false;
let currentDetectedGesture = "None", selectedSkin = 'neon';
let playerMoveHistory = [], lerpX = 0, lerpY = 0, lockedAiChoice = null;

let wsChannel = null, currentMatchRoomId = null, isMultiplayerActive = false;
let myPlayerIdentity = null, opponentLastSubmittedMove = null, myLastSubmittedMove = null;
let hasArenaLaunched = false, isConnectingToLobby = false;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playArcadeSound(type) {
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;
        if (type === 'tick') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(600, now);
            gain.gain.setValueAtTime(0.12, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
            osc.start(now); osc.stop(now + 0.08);
        } else if (type === 'shoot') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(160, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.22);
            gain.gain.setValueAtTime(0.25, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
            osc.start(now); osc.stop(now + 0.22);
        } else if (type === 'win') {
            osc.type = 'triangle'; osc.frequency.setValueAtTime(420, now);
            osc.frequency.setValueAtTime(640, now + 0.08);
            osc.frequency.setValueAtTime(950, now + 0.16);
            gain.gain.setValueAtTime(0.18, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
        } else if (type === 'lose') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(260, now);
            osc.frequency.linearRampToValueAtTime(70, now + 0.38);
            gain.gain.setValueAtTime(0.18, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.38);
            osc.start(now); osc.stop(now + 0.38);
        }
    } catch (e) {}
}

function selectSkin(skinName) {
    selectedSkin = skinName;
    document.querySelectorAll('.skin-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${skinName}`).classList.add('active');
    playArcadeSound('tick');
}

function safeSocketSend(payload) {
    if (!wsChannel || wsChannel.readyState !== WebSocket.OPEN) return;
    wsChannel.send(JSON.stringify(payload));
}

function triggerLocalAiArena() {
    isMultiplayerActive = false;
    document.getElementById('opponent-deck-label').innerText = "AI OPPONENT";
    document.getElementById('opponent-score-label').innerText = "AI CORE";
    aiIntelHTML.innerText = "LOCAL TRAINING ARENA";
    document.getElementById('skin-lobby-overlay').style.display = 'none';
    isArenaActive = true;
}

function triggerOnlineMultiplayer(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (isConnectingToLobby) return;
    isConnectingToLobby = true;

    const btn = document.getElementById('start-multiplayer-btn');
    btn.disabled = true;
    btn.innerText = "CONNECTING...";

    requestAnimationFrame(() => {
        setupMultiplayerMatch();
    });
}

function launchMultiplayerArena() {
    if (hasArenaLaunched) return;
    hasArenaLaunched = true;
    isMultiplayerActive = true;

    document.getElementById('opponent-deck-label').innerText = "OPPONENT PLAYER";
    document.getElementById('opponent-score-label').innerText = "RIVAL";
    aiIntelHTML.innerText = "ONLINE MATCH ACTIVE";
    document.getElementById('skin-lobby-overlay').style.display = 'none';
    isArenaActive = true;
}

function setupMultiplayerMatch() {
    const btn = document.getElementById('start-multiplayer-btn');
    const urlParams = new URLSearchParams(window.location.search);
    let roomId = urlParams.get('room');

    if (!roomId) {
        roomId = Math.random().toString(36).substring(2, 8);
        myPlayerIdentity = "host";
    } else {
        myPlayerIdentity = "guest";
    }
    currentMatchRoomId = roomId;
    console.log("ROOM ID:", roomId);

    // FIXED WEB-SOCKET GATEWAY: Pointing to a high-availability public broker channel
    wsChannel = new WebSocket(`wss://pubsub.apes.io/v1/room_${roomId}`);

    const timeout = setTimeout(() => {
        if (wsChannel.readyState !== WebSocket.OPEN) {
            btn.disabled = false;
            btn.innerText = "SERVER TIMEOUT - RETRY";
            isConnectingToLobby = false;
            try { wsChannel.close(); } catch(e){}
        }
    }, 8000);

    wsChannel.onopen = () => {
        clearTimeout(timeout);
        console.log("Socket connected cleanly.");
        btn.disabled = false;
        btn.innerText = "CONNECTED";
        isConnectingToLobby = false;

        const inviteLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
        document.getElementById("share-link-input").value = inviteLink;

        if (myPlayerIdentity === "host") {
            document.getElementById("multiplayer-link-modal").style.display = "flex";
            aiIntelHTML.innerText = "WAITING FOR OPPONENT...";
        } else {
            safeSocketSend({ type: "PLAYER_JOINED" });
            launchMultiplayerArena();
        }
    };

    wsChannel.onmessage = (event) => {
        let payload;
        try {
            payload = JSON.parse(event.data);
        } catch {
            return;
        }

        if (payload.type === "PLAYER_JOINED" && myPlayerIdentity === "host") {
            document.getElementById("multiplayer-link-modal").style.display = "none";
            safeSocketSend({ type: "START_GAME" });
            launchMultiplayerArena();
        }
        else if (payload.type === "START_GAME" && myPlayerIdentity === "guest") {
            launchMultiplayerArena();
        }
        else if (payload.type === "PLAYER_MOVE") {
            if (payload.player !== myPlayerIdentity) {
                opponentLastSubmittedMove = payload.move;
                evaluateMultiplayerNetworkMatch();
            }
        }
    };

    wsChannel.onerror = (err) => {
        console.error("Socket Error caught:", err);
        btn.disabled = false;
        btn.innerText = "CONNECTION FAILURE";
        isConnectingToLobby = false;
    };

    wsChannel.onclose = () => {
        console.warn("Socket Closed gracefully.");
        btn.disabled = false;
        btn.innerText = "PLAY WITH A FRIEND (ONLINE)";
        hasArenaLaunched = false;
        isConnectingToLobby = false;
        myLastSubmittedMove = null;
        opponentLastSubmittedMove = null;
    };
}

function copyInviteLink() {
    const link = document.getElementById("share-link-input").value;
    navigator.clipboard.writeText(link).then(() => {
        alert("Invite link copied!");
    }).catch(() => {
        alert(link);
    });
}

function cancelMultiplayer() {
    try { if (wsChannel) { wsChannel.close(); } } catch(e){}
    document.getElementById("multiplayer-link-modal").style.display = "none";
    hasArenaLaunched = false;
    isConnectingToLobby = false;
}

let hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.55, minTrackingConfidence: 0.55 });
hands.onResults(onResults);

function onResults(results) {
    if (mainCanvas.width !== videoElement.videoWidth) {
        const w = videoElement.videoWidth || 640;
        const h = videoElement.videoHeight || 480;
        mainCanvas.width = w; mainCanvas.height = h;
        lobbyCanvas.width = w; lobbyCanvas.height = h;
    }
    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    lobbyCtx.clearRect(0, 0, lobbyCanvas.width, lobbyCanvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        lobbyLoaderText.style.display = "none";
        const landmarks = results.multiHandLandmarks[0];
        currentDetectedGesture = detectGesture(landmarks);
        detectedGestureHTML.innerText = currentDetectedGesture;

        if (isArenaActive && !isCountingDown && currentDetectedGesture !== "Analyzing...") {
            startBattleCountdown();
        }
    } else {
        currentDetectedGesture = "No hand detected";
        detectedGestureHTML.innerText = "Looking for input...";
    }
}

function startBattleCountdown() {
    isCountingDown = true;
    let count = 3;
    countdownNumberHTML.style.display = "block";

    const interval = setInterval(() => {
        if (count > 0) {
            playArcadeSound('tick');
            countdownNumberHTML.innerText = count;
            statusMain.innerText = count === 3 ? "ROCK!" : count === 2 ? "PAPER!" : "SCISSORS!";
            count--;
        } else {
            clearInterval(interval);
            playArcadeSound('shoot');
            countdownNumberHTML.style.display = "none";

            if (isMultiplayerActive) {
                if (!currentDetectedGesture.includes(" ")) {
                    isCountingDown = false;
                    return;
                }
                myLastSubmittedMove = currentDetectedGesture.split(" ")[1];
                safeSocketSend({
                    type: "PLAYER_MOVE",
                    player: myPlayerIdentity,
                    move: myLastSubmittedMove
                });
                statusMain.innerText = "MOVE SUBMITTED";
                statusSub.innerText = "WAITING FOR OPPONENT";
                evaluateMultiplayerNetworkMatch();
            } else {
                executeBattleSnap();
            }
        }
    }, 750);
}

function executeBattleSnap() {
    if (currentDetectedGesture === "No hand detected" || currentDetectedGesture === "Analyzing...") {
        statusMain.innerText = "TIMEOUT";
        statusSub.innerText = "HOLD HAND STEADY";
        isCountingDown = false;
        return;
    }
    const pureMove = currentDetectedGesture.split(" ")[1];
    const slots = ["ROCK", "PAPER", "SCISSORS"];
    const aiMove = slots[Math.floor(Math.random() * 3)];

    aiEmojiHTML.innerText = aiMove === "ROCK" ? "✊" : aiMove === "PAPER" ? "🖐️" : "✌️";
    evaluateWinner(pureMove, aiMove);
}

function evaluateMultiplayerNetworkMatch() {
    if (!myLastSubmittedMove || !opponentLastSubmittedMove) return;
    aiEmojiHTML.innerText = opponentLastSubmittedMove === "ROCK" ? "✊" : opponentLastSubmittedMove === "PAPER" ? "🖐️" : "✌️";
    evaluateWinner(myLastSubmittedMove, opponentLastSubmittedMove);
    myLastSubmittedMove = null;
    opponentLastSubmittedMove = null;
}

function evaluateWinner(playerMove, enemyMove) {
    if (playerMove === enemyMove) {
        statusMain.innerText = "DRAW";
        statusSub.innerText = `${playerMove} vs ${enemyMove}`;
    } else if (
        (playerMove === "ROCK" && enemyMove === "SCISSORS") ||
        (playerMove === "PAPER" && enemyMove === "ROCK") ||
        (playerMove === "SCISSORS" && enemyMove === "PAPER")
    ) {
        userScore++;
        userScoreHTML.innerText = userScore;
        statusMain.innerText = "YOU WIN";
        statusSub.innerText = `${playerMove} beats ${enemyMove}`;
        playArcadeSound('win');
    } else {
        aiScore++;
        aiScoreHTML.innerText = aiScore;
        statusMain.innerText = "YOU LOSE";
        statusSub.innerText = `${enemyMove} beats ${playerMove}`;
        playArcadeSound('lose');
    }
    setTimeout(() => {
        isCountingDown = false;
    }, 1800);
}

function detectGesture(landmarks) {
    const i = landmarks[8].y < landmarks[6].y;
    const m = landmarks[12].y < landmarks[10].y;
    const r = landmarks[16].y < landmarks[14].y;
    const p = landmarks[20].y < landmarks[18].y;
    if (i && m && r && p) return "🖐️ PAPER";
    if (i && m && !r && !p) return "✌️ SCISSORS";
    if (!i && !m && !r && !p) return "✊ ROCK";
    return "Analyzing...";
}

window.addEventListener('beforeunload', () => {
    try { if (wsChannel) { wsChannel.close(); } } catch(e){}
});

async function startCamera() {
    try {
        videoElement.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        await new Camera(videoElement, { onFrame: async () => { await hands.send({ image: videoElement }); }, width: 640, height: 480 }).start();
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('room')) {
            lobbyLoaderText.innerText = "Joining Multiplayer Arena...";
            setupMultiplayerMatch();
        } else {
            lobbyLoaderText.innerText = "AI ONLINE • SELECT MODE";
        }
    } catch(err) {
        console.error(err);
        lobbyLoaderText.innerText = "CAMERA ACCESS DENIED";
    }
}
startCamera();
