const videoElement = document.getElementById('webcam');
const canvas = document.getElementById('carromBoard');
const ctx = canvas.getContext('2d');
const aimLabel = document.getElementById('aim-label');
const powerLabel = document.getElementById('power-label');

// --- VECTOR PHYSICS CONSTANTS ---
const FRICTION = 0.982;
const POCKET_RADIUS = 24;
const pockets = [
    { x: 32, y: 32 }, { x: 468, y: 32 },
    { x: 32, y: 468 }, { x: 468, y: 468 }
];

let striker = { x: 250, y: 410, radius: 16, vx: 0, vy: 0, color: '#00e5ff' };
let coins = [];
let isCharging = false;
let chargeTimer = 0;
let targetAimAngle = -Math.PI / 2;

// Web Camera tracking parameters maps
let isHandDetected = false;
let trackedHandX = 250;
let trackedHandY = 410;

// Initialize carrom board pieces cluster layout array matrix
function initBoardPieces() {
    coins = [];
    const centerX = 250, centerY = 250, spacing = 25;
    
    // Core structural positioning layers
    const structures = [
        {dx: 0, dy: 0, c: '#e11d48'}, // The Red Queen Token
        {dx: -spacing, dy: 0, c: '#ffffff'}, {dx: spacing, dy: 0, c: '#ffffff'},
        {dx: 0, dy: -spacing, c: '#ffffff'}, {dx: 0, dy: spacing, c: '#ffffff'},
        {dx: -spacing, dy: -spacing, c: '#0f172a'}, {dx: spacing, dy: -spacing, c: '#0f172a'},
        {dx: -spacing, dy: spacing, c: '#0f172a'}, {dx: spacing, dy: spacing, c: '#0f172a'}
    ];
    structures.forEach(p => {
        coins.push({ x: centerX + p.dx, y: centerY + p.dy, radius: 12, vx: 0, vy: 0, color: p.c });
    });
}

// Render graphical elements to the canvas bounds loop
function drawCarromBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw wood frame baseline targets boundaries
    ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 4;
    ctx.strokeRect(15, 15, 470, 470);
    
    // Draw baselines track paths maps lines strings
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.2)'; ctx.lineWidth = 2;
    ctx.strokeRect(75, 75, 350, 350);
    ctx.fillStyle = 'rgba(14, 165, 233, 0.1)';
    ctx.fillRect(85, 400, 330, 20); // The slider baseline channel indicator path

    // Draw pocket dropzones layout holes configuration arcs
    pockets.forEach(p => {
        ctx.fillStyle = '#020617'; ctx.beginPath(); ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 3; ctx.stroke();
    });

    // Draw carrom men tokens discs vectors array loop
    coins.forEach(c => {
        ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.5; ctx.stroke();
    });

    // Draw active striker entity disc element
    ctx.fillStyle = striker.color; ctx.beginPath(); ctx.arc(striker.x, striker.y, striker.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke();

    // Render targeting aiming vector laser line array tracks loop
    if (isCharging && striker.vx === 0 && striker.vy === 0) {
        aimLabel.innerText = `${Math.abs(Math.round(targetAimAngle * (180 / Math.PI)))}°`;
        ctx.strokeStyle = striker.color; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(striker.x, striker.y);
        ctx.lineTo(striker.x + Math.cos(targetAimAngle) * 150, striker.y + Math.sin(targetAimAngle) * 150);
        ctx.stroke(); ctx.setLineDash([]);
    }
}

function processVectorPhysics() {
    let entities = [striker, ...coins];
    
    entities.forEach(obj => {
        obj.x += obj.vx; obj.y += obj.vy;
        obj.vx *= FRICTION; obj.vy *= FRICTION;
        
        if (Math.abs(obj.vx) < 0.04) obj.vx = 0;
        if (Math.abs(obj.vy) < 0.04) obj.vy = 0;

        // Wall rebounding reflection bounds limits
        if (obj.x < 35 + obj.radius) { obj.x = 35 + obj.radius; obj.vx *= -1; }
        if (obj.x > 465 - obj.radius) { obj.x = 465 - obj.radius; obj.vx *= -1; }
        if (obj.y < 35 + obj.radius) { obj.y = 35 + obj.radius; obj.vy *= -1; }
        if (obj.y > 465 - obj.radius) { obj.y = 465 - obj.radius; obj.vy *= -1; }

        // Hole pocketing verification logic metrics paths
        pockets.forEach(p => {
            if (Math.hypot(obj.x - p.x, obj.y - p.y) < POCKET_RADIUS) {
                if (obj === striker) {
                    setTimeout(() => { striker.x = 250; striker.y = 410; striker.vx = 0; striker.vy = 0; }, 600);
                } else {
                    coins = coins.filter(c => c !== obj);
                }
            }
        });
    });

    // Rigid body reflection circle elastic collisions loops
    for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
            let e1 = entities[i], e2 = entities[j];
            let distance = Math.hypot(e2.x - e1.x, e2.y - e1.y);
            if (distance < e1.radius + e2.radius) {
                let overlap = (e1.radius + e2.radius) - distance;
                let nx = (e2.x - e1.x) / distance, ny = (e2.y - e1.y) / distance;
                
                e1.x -= nx * overlap * 0.5; e1.y -= ny * overlap * 0.5;
                e2.x += nx * overlap * 0.5; e2.y += ny * overlap * 0.5;
                
                let kx = e1.vx - e2.vx, ky = e1.vy - e2.vy;
                let impulse = 2 * (nx * kx + ny * ky) / 2;
                e1.vx -= impulse * nx; e1.vy -= impulse * ny;
                e2.vx += impulse * nx; e2.vy += impulse * ny;
            }
        }
    }
}

// ─── MEDIAPIPE GESTURE RESOLUTION ROUTERS CONTROL INTERFACE ───
let hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });
hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        lobbyLoaderText.style.display = "none";
        isHandDetected = true;
        
        const landmarks = results.multiHandLandmarks[0];
        // Capture tracking node coordinates mapping indices accurately
        trackedHandX = (1 - landmarks[9].x) * canvas.width;
        trackedHandY = landmarks[9].y * canvas.height;

        // Evaluate custom gesture fingerprint states
        const indexOpen = landmarks[8].y < landmarks[6].y;
        const middleOpen = landmarks[12].y < landmarks[10].y;
        const ringOpen = landmarks[16].y < landmarks[14].y;
        const pinkyOpen = landmarks[20].y < landmarks[18].y;

        const isPointingFinger = indexOpen && !middleOpen && !ringOpen && !pinkyOpen;
        const isOpenHand = indexOpen && middleOpen && ringOpen && pinkyOpen;

        if (striker.vx === 0 && striker.vy === 0) {
            if (isOpenHand) {
                // Layer 1: Open hand locks position slider tracking parameters bounds strings
                isCharging = false;
                striker.x = Math.max(85, Math.min(385, trackedHandX));
                striker.y = 410; // Lock cleanly into baseline rail channel tracks
                powerLabel.innerText = "SLIDING AIM POSITION...";
            } 
            else if (isPointingFinger) {
                // Layer 2 & 3: Pointing finger triggers vector trajectory aim calculation loops
                if (!isCharging) { isCharging = true; chargeTimer = 0; }
                targetAimAngle = Math.atan2(trackedHandY - striker.y, trackedHandX - striker.x);
            }
            else if (isCharging && !isPointingFinger && !isOpenHand) {
                // Layer 4: Snapping finger triggers physical force execution releases metrics paths
                executeStrikerRelease();
            }
        }
    } else {
        isHandDetected = false;
        if (isCharging) { executeStrikerRelease(); }
    }
});

function executeStrikerRelease() {
    isCharging = false;
    let powerLevel = 1;
    if (chargeTimer > 35 && chargeTimer <= 70) powerLevel = 2;
    if (chargeTimer > 70) powerLevel = 3;
    
    let magnitudeImpulseVec = powerLevel * 8.5;
    striker.vx = Math.cos(targetAimAngle) * magnitudeImpulseVec;
    striker.vy = Math.sin(targetAimAngle) * magnitudeImpulseVec;
    
    playArcadeSound('shoot');
    powerLabel.innerText = "STRIKE DISPATCHED!"; striker.color = '#00e5ff';
    chargeTimer = 0;
}

// ─── ENGINE ANIMATION RUN PIPELINES LOOP TRACKS ───
function mainProcessingLoop() {
    if (isCharging && striker.vx === 0 && striker.vy === 0) {
        chargeTimer++;
        if (chargeTimer <= 35) { powerLabel.innerText = "LEVEL 1 • TACTICAL PRECISION TAP"; striker.color = '#22c55e'; }
        else if (chargeTimer > 35 && chargeTimer <= 70) { powerLabel.innerText = "LEVEL 2 • FORCE REBOUND CLEAR"; striker.color = '#eab308'; }
        else { powerLabel.innerText = "LEVEL 3 • MAX BLAST BREAK SHOT!"; striker.color = '#ef4444'; }
        if (chargeTimer % 12 === 0) playArcadeSound('tick');
    }
    processVectorPhysics(); drawCarromBoard(); requestAnimationFrame(mainProcessingLoop);
}

async function startCameraStreams() {
    try {
        videoElement.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        await new Camera(videoElement, { onFrame: async () => { await hands.send({ image: videoElement }); }, width: 640, height: 480 }).start();
        lobbyLoaderText.innerText = "AI HAND RECOGNITION ACTIVE • WAVE HAND";
    } catch (err) { lobbyLoaderText.innerText = "CAMERA HARDWARE SECURITY DENIED"; }
}

initBoardPieces(); startCameraStreams(); mainProcessingLoop();
