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

// ─── PRODUCTION PUSHER CLIENT SYNC STACK ───
let pusherClient = null;
let networkChannel = null;
let currentMatchRoomId = null;
let isMultiplayerActive = false;
let myPlayerIdentity = null;
let opponentLastSubmittedMove = null;
let myLastSubmittedMove = null;
let hasArenaLaunched = false;

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

function triggerLocalAiArena() {
    isMultiplayerActive = false;
    document.getElementById('opponent-deck-label').innerText = "AI OPPONENT";
    document.getElementById('opponent-score-label').innerText = "AI CORE";
    aiIntelHTML.innerText = "LOCAL TRAINING ARENA";
    document.getElementById('skin-lobby-overlay').style.display = 'none';
    isArenaActive = true;
}

function triggerOnlineMultiplayer() {
    document.getElementById('start-multiplayer-btn').innerText = "CONNECTING GRID...";
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

// ─── UNBLOCKED PUSHER INFRASTRUCTURE ENGINE IMPLEMENTATION ───
function setupMultiplayerMatch() {
    const btn = document.getElementById('start-multiplayer-btn');
    const urlParams = new URLSearchParams(window.location.search);
    let roomId = urlParams.get('room');

    if (!roomId) {
        roomId = Math.floor(100000 + Math.random() * 900000).toString();
        myPlayerIdentity = "host";
    } else {
        myPlayerIdentity = "guest";
    }
    currentMatchRoomId = roomId;

    // Secure multi-tenant global clusters routing through standard web port protocols (unblockable)
    pusherClient = new Pusher('de529dfaa6c6ca5e7b23', {
        cluster: 'ap2',
        forceTLS: true
    });

    networkChannel = pusherClient.subscribe(`room-${roomId}`);

    networkChannel.bind('pusher:subscription_succeeded', () => {
        btn.innerText = "CONNECTED";
        const inviteLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
        document.getElementById("share-link-input").value = inviteLink;

        if (myPlayerIdentity === "host") {
            document.getElementById("multiplayer-link-modal").style.display = "flex";
            aiIntelHTML.innerText = "WAITING FOR RIVAL...";
        } else {
            // Guest triggers execution sync event to host across pipeline parameters
            setTimeout(() => {
                networkChannel.trigger(`client-sync-event`, { type: "PLAYER_JOINED" });
            }, 300);
            launchMultiplayerArena();
        }
    });

    networkChannel.bind('client-sync-event', (data) => {
        if (data.type === "PLAYER_JOINED" && myPlayerIdentity === "host") {
            document.getElementById("multiplayer-link-modal").style.display = "none";
            networkChannel.trigger(`client-sync-event`, { type: "START_GAME" });
            launchMultiplayerArena();
        }
        else if (data.type === "START_GAME" && myPlayerIdentity === "guest") {
            launchMultiplayerArena();
        }
        else if (data.type === "PLAYER_MOVE") {
            if (data.player !== myPlayerIdentity) {
                opponentLastSubmittedMove = data.move;
                evaluateMultiplayerNetworkMatch();
            }
        }
    });
}

function copyInviteLink() {
    const link = document.getElementById("share-link-input").value;
    navigator.clipboard.writeText(link).then(() => {
        alert("Invite link copied!");
    });
}

function cancelMultiplayer() {
    if (pusherClient) pusherClient.unsubscribe(`room-${currentMatchRoomId}`);
    document.getElementById("multiplayer-link-modal").style.display = "none";
    document.getElementById('start-multiplayer-btn').innerText = "PLAY WITH A FRIEND (ONLINE)";
    hasArenaLaunched = false;
}

let hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.55, minTrackingConfidence: 0.55 });
hands.onResults(onResults);

function onResults(results) {
    if (mainCanvas.width !== videoElement.videoWidth) {
        const w = videoElement.videoWidth || 640; const h = videoElement.videoHeight || 480;
        mainCanvas.width = w; mainCanvas.height = h;
    }
    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    lobbyCtx.clearRect(0, 0, lobbyCanvas.width, lobbyCanvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        lobbyLoaderText.style.display = "none";
        currentDetectedGesture = detectGesture(results.multiHandLandmarks[0]);
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
                if (!currentDetectedGesture.includes(" ")) { isCountingDown = false; return; }
                myLastSubmittedMove = currentDetectedGesture.split(" ")[1];
                
                networkChannel.trigger(`client-sync-event`, {
                    type: "PLAYER_MOVE",
                    player: myPlayerIdentity,
                    move: myLastSubmittedMove
                });
                
                statusMain.innerText = "MOVE SUBMITTED";
                statusSub.innerText = "WAITING FOR RIVAL REVEAL...";
                evaluateMultiplayerNetworkMatch();
            } else {
                executeBattleSnap();
            }
        }
    }, 750);
}

function executeBattleSnap() {
    if (currentDetectedGesture === "No hand detected" || currentDetectedGesture === "Analyzing...") {
        statusMain.innerText = "TIMEOUT"; statusSub.innerText = "HOLD HAND STEADY";
        isCountingDown = false; return;
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
    myLastSubmittedMove = null; opponentLastSubmittedMove = null;
}

function evaluateWinner(playerMove, enemyMove) {
    if (playerMove === enemyMove) {
        statusMain.innerText = "DRAW"; statusSub.innerText = `${playerMove} vs ${enemyMove}`;
    } else if (
        (playerMove === "ROCK" && enemyMove === "SCISSORS") ||
        (playerMove === "PAPER" && enemyMove === "ROCK") ||
        (playerMove === "SCISSORS" && enemyMove === "PAPER")
    ) {
        userScore++; userScoreHTML.innerText = userScore;
        statusMain.innerText = "YOU WIN"; statusSub.innerText = `${playerMove} beats ${enemyMove}`;
        playArcadeSound('win');
    } else {
        aiScore++; aiScoreHTML.innerText = aiScore;
        statusMain.innerText = "YOU LOSE"; statusSub.innerText = `${enemyMove} beats ${playerMove}`;
        playArcadeSound('lose');
    }
    setTimeout(() => { isCountingDown = false; }, 1800);
}

function detectGesture(landmarks) {
    const i = landmarks[8].y < landmarks[6].y, m = landmarks[12].y < landmarks[10].y, r = landmarks[16].y < landmarks[14].y, p = landmarks[20].y < landmarks[18].y;
    if (i && m && r && p) return "🖐️ PAPER";
    if (i && m && !r && !p) return "✌️ SCISSORS";
    if (!i && !m && !r && !p) return "✊ ROCK";
    return "Analyzing...";
}

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
    } catch(err) { lobbyLoaderText.innerText = "CAMERA ACCESS DENIED"; }
}
startCamera();
