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

// --- BUTTON DECOUPLING INFRASTRUCTURE ---
function triggerLocalAiArena() {
    isMultiplayerActive = false;
    document.getElementById('opponent-deck-label').innerText = "AI OPPONENT";
    document.getElementById('opponent-score-label').innerText = "AI CORE";
    aiIntelHTML.innerText = "LOCAL TRAINING ARENA";
    
    // Clear menu array and wake loop frame
    document.getElementById('skin-lobby-overlay').style.display = 'none';
    isArenaActive = true;
}

function triggerOnlineMultiplayer() {
    document.getElementById('start-multiplayer-btn').innerText = "INITIALIZING PORT...";
    // Micro-task isolation step to resolve INP issues completely
    setTimeout(() => {
        setupMultiplayerMatch();
    }, 50);
}

function launchMultiplayerArena() {
    isMultiplayerActive = true;
    document.getElementById('opponent-deck-label').innerText = "OPPONENT PLAYER";
    document.getElementById('opponent-score-label').innerText = "RIVAL";
    aiIntelHTML.innerText = "ONLINE ROOM ACTIVE • MATCH ENGAGED";
    
    document.getElementById('skin-lobby-overlay').style.display = 'none';
    isArenaActive = true;
}

function setupMultiplayerMatch() {
    const urlParams = new URLSearchParams(window.location.search);
    let roomId = urlParams.get('room');
    
    if (!roomId) {
        roomId = Math.floor(100000 + Math.random() * 900000).toString();
        myPlayerIdentity = "player1";
    } else {
        myPlayerIdentity = "player2";
    }
    currentMatchRoomId = roomId;

    const publicClusterUrl = `wss://demo.piesocket.com/v3/${currentMatchRoomId}?api_key=VCXCEuvK8oxSI1Gs2J6gDWmXoxwRQQwYFa6e61Ls&notify_self=0`;
    wsChannel = new WebSocket(publicClusterUrl);

    wsChannel.onopen = () => {
        document.getElementById('start-multiplayer-btn').innerText = "PLAY WITH A FRIEND (ONLINE)";
        const absoluteInviteUrl = `${window.location.origin}${window.location.pathname}?room=${currentMatchRoomId}`;
        document.getElementById("share-link-input").value = absoluteInviteUrl;
        
        if (myPlayerIdentity === "player1") {
            document.getElementById("multiplayer-link-modal").style.display = "flex";
            aiIntelHTML.innerText = "WAITING FOR OPPONENT LOBBY ARRIVAL...";
        } else {
            wsChannel.send(JSON.stringify({ type: "PRESENCE_ENTER" }));
            launchMultiplayerArena();
        }
    };

    wsChannel.onmessage = (event) => {
        const networkPayload = JSON.parse(event.data);
        if (networkPayload.type === "PRESENCE_ENTER" && myPlayerIdentity === "player1") {
            document.getElementById("multiplayer-link-modal").style.display = "none";
            wsChannel.send(JSON.stringify({ type: "PRESENCE_ACK" }));
            launchMultiplayerArena();
        }
        else if (networkPayload.type === "PRESENCE_ACK" && myPlayerIdentity === "player2") {
            launchMultiplayerArena();
        }
        else if (networkPayload.type === "GESTURE_SUBMIT") {
            if (networkPayload.sender !== myPlayerIdentity) {
                opponentLastSubmittedMove = networkPayload.gesture;
                evaluateMultiplayerNetworkMatch();
            }
        }
    };

    wsChannel.onerror = () => {
        document.getElementById('start-multiplayer-btn').innerText = "CONNECTION FAILURE. RETRY.";
    };
}

function copyInviteLink() {
    const copyTargetInput = document.getElementById("share-link-input");
    copyTargetInput.select();
    navigator.clipboard.writeText(copyTargetInput.value);
    alert("Link copied!");
}

function cancelMultiplayer() {
    if (wsChannel) wsChannel.close();
    document.getElementById("multiplayer-link-modal").style.display = "none";
    document.getElementById('start-multiplayer-btn').innerText = "PLAY WITH A FRIEND (ONLINE)";
}

let hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.55, minTrackingConfidence: 0.55 });
hands.onResults(onResults);

function onResults(results) {
    if (mainCanvas.width !== videoElement.videoWidth) {
        const w = videoElement.videoWidth || 640; const h = videoElement.videoHeight || 480;
        mainCanvas.width = w; mainCanvas.height = h;
        lobbyCanvas.width = w; lobbyCanvas.height = h;
    }
    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    lobbyCtx.clearRect(0, 0, lobbyCanvas.width, lobbyCanvas.height);

    const activeCtx = isArenaActive ? mainCtx : lobbyCtx;
    const activeCanvas = isArenaActive ? mainCanvas : lobbyCanvas;
    const activeGhost = isArenaActive ? arenaGhostHTML : lobbyGhostHTML;
    const activeWrapper = isArenaActive ? playerCard : document.querySelector('.mirror-box');

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        lobbyLoaderText.style.display = "none";
        const landmarks = results.multiHandLandmarks[0];
        currentDetectedGesture = detectGesture(landmarks);
        detectedGestureHTML.innerText = currentDetectedGesture;

        const dx = landmarks[9].x - landmarks[0].x;
        const dy = landmarks[9].y - landmarks[0].y;
        const sizeScaleNormalization = 0.35 / (Math.sqrt(dx*dx + dy*dy) || 0.35);

        if (selectedSkin === 'neon') {
            activeGhost.style.display = "none";
            renderMassiveNeonGauntlet(landmarks, activeCtx, activeCanvas, sizeScaleNormalization);
        } else if (selectedSkin === 'silhouette') {
            activeGhost.style.display = "none";
            renderMassiveSilhouette(landmarks, activeCtx, activeCanvas, sizeScaleNormalization);
        } else if (selectedSkin === 'comic') {
            const boundingGridBox = activeWrapper.getBoundingClientRect();
            lerpX += (((1 - landmarks[9].x) * boundingGridBox.width) - lerpX) * 0.32;
            lerpY += ((landmarks[9].y * boundingGridBox.height) - lerpY) * 0.32;
            activeGhost.style.left = `${lerpX - (isArenaActive ? 110 : 70)}px`;
            activeGhost.style.top = `${lerpY - (isArenaActive ? 110 : 70)}px`;
            activeGhost.style.display = "block";
            activeGhost.style.transform = `scale(${isArenaActive ? sizeScaleNormalization : 0.65 * sizeScaleNormalization})`;
            activeGhost.innerText = currentDetectedGesture.includes("ROCK") ? "✊" : currentDetectedGesture.includes("PAPER") ? "🖐️" : "✌️";
        }
        if (isArenaActive && !isCountingDown && currentDetectedGesture !== "Analyzing...") startBattleCountdown();
    } else {
        if (isArenaActive && !isCountingDown) {
            statusMain.innerText = "RAISE HAND";
            statusSub.innerText = isMultiplayerActive ? "HOLD HAND STEADY" : "TO CHALLENGE AI";
            countdownNumberHTML.style.display = "none";
        }
        detectedGestureHTML.innerText = "Looking for input...";
        currentDetectedGesture = "No hand detected";
        activeGhost.style.display = "none";
    }
}

function renderMassiveNeonGauntlet(landmarks, ctx, canvas, sizeMultiplier) {
    const center = landmarks[9]; const cx = center.x * canvas.width; const cy = center.y * canvas.height;
    ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = Math.min(24, 15 * sizeMultiplier);
    ctx.lineCap = "round"; ctx.shadowBlur = 25; ctx.shadowColor = '#0ea5e9';
    const boneLinks = [[0,1], [1,2], [2,3], [3,4], [0,5], [5,6], [6,7], [7,8], [5,9], [9,10], [10,11], [11,12], [9,13], [13,14], [14,15], [15,16], [13,17], [0,17], [17,18], [18,19], [19,20]];
    boneLinks.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(cx + (landmarks[a].x * canvas.width - cx) * sizeMultiplier, cy + (landmarks[a].y * canvas.height - cy) * sizeMultiplier);
        ctx.lineTo(cx + (landmarks[b].x * canvas.width - cx) * sizeMultiplier, cy + (landmarks[b].y * canvas.height - cy) * sizeMultiplier);
        ctx.stroke();
    });
    ctx.fillStyle = '#f472b6'; ctx.shadowColor = '#f472b6';
    landmarks.forEach(pt => {
        ctx.beginPath(); ctx.arc(cx + (pt.x * canvas.width - cx) * sizeMultiplier, cy + (pt.y * canvas.height - cy) * sizeMultiplier, Math.min(15, 9 * sizeMultiplier), 0, 2 * Math.PI); ctx.fill();
    });
    ctx.shadowBlur = 0;
}

function renderMassiveSilhouette(landmarks, ctx, canvas, sizeMultiplier) {
    const center = landmarks[9]; const cx = center.x * canvas.width; const cy = center.y * canvas.height;
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.min(65, 38 * sizeMultiplier);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.shadowBlur = 30; ctx.shadowColor = 'rgba(255,255,255,0.4)';
    [[0,1,2,3,4], [0,5,6,7,8], [0,9,10,11,12], [0,13,14,15,16], [0,17,18,19,20]].forEach(track => {
        ctx.beginPath();
        ctx.moveTo(cx + (landmarks[track[0]].x * canvas.width - cx) * sizeMultiplier, cy + (landmarks[track[0]].y * canvas.height - cy) * sizeMultiplier);
        for(let i=1; i<track.length; i++) ctx.lineTo(cx + (landmarks[track[i]].x * canvas.width - cx) * sizeMultiplier, cy + (landmarks[track[i]].y * canvas.height - cy) * sizeMultiplier);
        ctx.stroke();
    });
    ctx.shadowBlur = 0;
}

function startBattleCountdown() {
    isCountingDown = true;
    playerCard.classList.remove('pulse-win', 'pulse-lose');
    aiCard.classList.remove('pulse-win', 'pulse-lose');
    aiEmojiHTML.innerText = "✊";
    aiEmojiHTML.classList.remove('ai-slam'); aiEmojiHTML.classList.add('ai-jelly-bounce');
    let count = 3;
    statusSub.innerText = isMultiplayerActive ? "ONLINE COMBAT READY" : (userScore >= 3 ? "⚠️ AI IS ENRAGED" : "MATCH ENGAGED");
    countdownNumberHTML.style.display = "block";

    const interval = setInterval(() => {
        if (count > 0) {
            playArcadeSound('tick');
            countdownNumberHTML.innerText = count;
            statusMain.innerText = count === 3 ? "ROCK!" : count === 2 ? "PAPER!" : "SCISSORS!";
            if (count === 1 && !isMultiplayerActive) {
                const slots = ["ROCK", "PAPER", "SCISSORS"];
                if (userScore >= 3) {
                    const r = playerMoveHistory.filter(m => m === 'ROCK').length, p = playerMoveHistory.filter(m => m === 'PAPER').length, s = playerMoveHistory.filter(m => m === 'SCISSORS').length;
                    lockedAiChoice = (r > p && r > s) ? "PAPER" : (p > r && p > s) ? "SCISSORS" : (s > r && s > p) ? "ROCK" : slots[Math.floor(Math.random() * 3)];
                } else lockedAiChoice = slots[Math.floor(Math.random() * 3)];
            }
            count--;
        } else {
            clearInterval(interval);
            playArcadeSound('shoot');
            countdownNumberHTML.style.display = "none";
            if (isMultiplayerActive) {
                myLastSubmittedMove = currentDetectedGesture.split(" ")[1];
                wsChannel.send(JSON.stringify({ type: "GESTURE_SUBMIT", sender: myPlayerIdentity, gesture: myLastSubmittedMove }));
                statusMain.innerText = "SUBMITTED!"; statusSub.innerText = "WAITING FOR PEER REVEAL...";
                evaluateMultiplayerNetworkMatch();
            } else {
                statusMain.innerText = "SHOOT! 🔥";
                aiEmojiHTML.classList.remove('ai-jelly-bounce'); aiEmojiHTML.classList.add('ai-slam');
                executeBattleSnap();
            }
        }
    }, 750);
}

function executeBattleSnap() {
    if (currentDetectedGesture === "No hand detected" || currentDetectedGesture === "Analyzing...") {
        statusMain.innerText = "TIMEOUT!"; statusSub.innerText = "HOLD STEADY ON THE BEAT";
        winStreak = 0; updateStreakBadge();
        setTimeout(() => { isCountingDown = false; }, 2000);
        return;
    }
    const pureMove = currentDetectedGesture.split(" ")[1];
    playerMoveHistory.push(pureMove); if (playerMoveHistory.length > 5) playerMoveHistory.shift();
    const aiCounterDecision = lockedAiChoice || "ROCK";
    if (userScore >= 3) { statusCardBox.classList.add('ai-boss-rage-active'); aiIntelHTML.innerText = "AI System: Predictive Adaptation Engaged!"; }
    const aiChoice = [{ name: "ROCK", asset: "✊" }, { name: "PAPER", asset: "🖐️" }, { name: "SCISSORS", asset: "✌️" }].find(m => m.name === aiCounterDecision);
    aiEmojiHTML.innerText = aiChoice.asset;

    if (pureMove === aiChoice.name) { statusMain.innerText = "DRAW MATCH!"; statusSub.innerText = `BOTH INSTANCED ${pureMove}`; }
    else if ((pureMove === "ROCK" && aiChoice.name === "SCISSORS") || (pureMove === "PAPER" && aiChoice.name === "ROCK") || (pureMove === "SCISSORS" && aiChoice.name === "PAPER")) {
        userScore++; winStreak++; playArcadeSound('win'); statusMain.innerText = "YOU WIN!"; statusSub.innerText = `${pureMove} BEATS ${aiChoice.name}`;
        playerCard.classList.add('pulse-win'); updateStreakBadge(); animateScorePoint(aiCard, userScoreBox, () => { userScoreHTML.innerText = userScore; });
    } else {
        aiScore++; winStreak = 0; playArcadeSound('lose'); statusMain.innerText = "AI WINS!"; statusSub.innerText = `${aiChoice.name} CRUSHES ${pureMove}`;
        aiCard.classList.add('pulse-win'); updateStreakBadge(); animateScorePoint(playerCard, aiScoreBox, () => { aiScoreHTML.innerText = aiScore; });
    }
    lockedAiChoice = null; triggerNextRoundBreak();
}

function evaluateMultiplayerNetworkMatch() {
    if (!myLastSubmittedMove || !opponentLastSubmittedMove) return;
    aiEmojiHTML.innerText = { ROCK: "✊", PAPER: "🖐️", SCISSORS: "✌️" }[opponentLastSubmittedMove] || "❓";
    if (myLastSubmittedMove === opponentLastSubmittedMove) { statusMain.innerText = "DRAW MATCH!"; statusSub.innerText = `BOTH INSTANCED ${myLastSubmittedMove}`; }
    else if ((myLastSubmittedMove === "ROCK" && opponentLastSubmittedMove === "SCISSORS") || (myLastSubmittedMove === "PAPER" && opponentLastSubmittedMove === "ROCK") || (myLastSubmittedMove === "SCISSORS" && opponentLastSubmittedMove === "PAPER")) {
        userScore++; winStreak++; playArcadeSound('win'); statusMain.innerText = "YOU WIN!"; statusSub.innerText = `${myLastSubmittedMove} BEATS ${opponentLastSubmittedMove}`;
        playerCard.classList.add('pulse-win'); updateStreakBadge(); animateScorePoint(aiCard, userScoreBox, () => { userScoreHTML.innerText = userScore; });
    } else {
        aiScore++; winStreak = 0; playArcadeSound('lose'); statusMain.innerText = "YOU LOSE!"; statusSub.innerText = `${opponentLastSubmittedMove} SMASHES ${myLastSubmittedMove}`;
        aiCard.classList.add('pulse-win'); updateStreakBadge(); animateScorePoint(playerCard, aiScoreBox, () => { aiScoreHTML.innerText = aiScore; });
    }
    myLastSubmittedMove = null; opponentLastSubmittedMove = null; triggerNextRoundBreak();
}

function updateStreakBadge() { if (winStreak >= 2) { streakCountHTML.innerText = winStreak; streakBannerHTML.className = "streak-badge-active"; } else streakBannerHTML.className = "streak-badge-hidden"; }
function animateScorePoint(fromElement, toElement, callback) {
    const fR = fromElement.getBoundingClientRect(), tR = toElement.getBoundingClientRect();
    particleHTML.className = "score-particle-fly"; particleHTML.style.left = `${fR.left + fR.width/2}px`; particleHTML.style.top = `${fR.top + fR.height/2}px`;
    setTimeout(() => { particleHTML.style.left = `${tR.left + tR.width/2}px`; particleHTML.style.top = `${tR.top + tR.height/2}px`; }, 50);
    setTimeout(() => { particleHTML.className = "score-particle-hidden"; toElement.classList.add('bump-score'); callback(); setTimeout(() => toElement.classList.remove('bump-score'), 400); }, 650);
}
function triggerNextRoundBreak() { setTimeout(() => { statusMain.innerText = "NEXT ROUND"; statusSub.innerText = isMultiplayerActive ? "KEEP HAND READY IN FRAME..." : "GET HAND READY..."; setTimeout(() => { isCountingDown = false; }, 1200); }, 2400); }
function detectGesture(landmarks) {
    const i = landmarks[8].y < landmarks[6].y, m = landmarks[12].y < landmarks[10].y, r = landmarks[16].y < landmarks[14].y, p = landmarks[20].y < landmarks[18].y;
    return (i && m && r && p) ? "🖐️ PAPER" : (i && m && !r && !p) ? "✌️ SCISSORS" : (!i && !m && !r && !p) ? "✊ ROCK" : "Analyzing...";
}

async function startCamera() {
    try {
        videoElement.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        await new Camera(videoElement, { onFrame: async () => { await hands.send({ image: videoElement }); }, width: 640, height: 480 }).start();
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('room')) { 
            lobbyLoaderText.innerText = "Entering Shared Network Arena..."; 
            setupMultiplayerMatch(); 
        } else { 
            lobbyLoaderText.innerText = "AI Online! Select Mode."; 
        }
    } catch (err) { lobbyLoaderText.innerText = "Camera Denied."; }
}
startCamera();
