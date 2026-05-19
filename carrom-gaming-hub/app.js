const canvas = document.getElementById('carromBoard');
const ctx = canvas.getContext('2d');
const aimLabel = document.getElementById('aim-label');
const powerLabel = document.getElementById('power-label');

// Game parameters configuration values
const FRICTION = 0.985;
const POCKET_RADIUS = 22;
const pockets = [
    { x: 30, y: 30 }, { x: 470, y: 30 },
    { x: 30, y: 470 }, { x: 470, y: 470 }
];

let striker = { x: 250, y: 400, radius: 15, vx: 0, vy: 0, baseColor: '#00e5ff' };
let coins = [];
let isCharging = false;
let chargeTimer = 0;
let mouseX = 250, mouseY = 250;

// Generate center cluster carrom men positioning array matrix
function initCoins() {
    coins = [];
    const centerX = 250, centerY = 250;
    const spacing = 24;
    
    // Core center configurations arrangement layout arrays
    const positions = [
        {dx: 0, dy: 0, c: '#ffeb3b'}, // Queen (Gold)
        {dx: -spacing, dy: 0, c: '#ffffff'}, {dx: spacing, dy: 0, c: '#ffffff'},
        {dx: 0, dy: -spacing, c: '#ffffff'}, {dx: 0, dy: spacing, c: '#ffffff'},
        {dx: -spacing/1.5, dy: -spacing/1.5, c: '#111'}, {dx: spacing/1.5, dy: -spacing/1.5, c: '#111'},
        {dx: -spacing/1.5, dy: spacing/1.5, c: '#111'}, {dx: spacing/1.5, dy: spacing/1.5, c: '#111'}
    ];
    
    positions.forEach(p => {
        coins.push({ x: centerX + p.dx, y: centerY + p.dy, radius: 11, vx: 0, vy: 0, color: p.c });
    });
}

// Draw game components frames logic
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw layout target baselines lines loops strings
    ctx.strokeStyle = 'rgba(109, 76, 65, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(70, 70, 360, 360);
    ctx.strokeRect(85, 385, 330, 20); // Bottom base slider line tracking bounds
    
    // Render target pockets holes circles layouts
    pockets.forEach(p => {
        ctx.fillStyle = '#111625';
        ctx.beginPath(); ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 3; ctx.stroke();
    });

    // Draw coins tokens
    coins.forEach(c => {
        ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.stroke();
    });

    // Draw active striker disc controller element
    ctx.fillStyle = striker.baseColor; ctx.beginPath(); ctx.arc(striker.x, striker.y, striker.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

    // Render targeting aiming vector ray line arrays tracks loops
    if (isCharging && striker.vx === 0 && striker.vy === 0) {
        let dx = mouseX - striker.x; let dy = mouseY - striker.y;
        let angle = Math.atan2(dy, dx);
        aimLabel.innerText = `${Math.abs(Math.round(angle * (180 / Math.PI)))}°`;
        
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)'; ctx.lineWidth = 3; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(striker.x, striker.y);
        ctx.lineTo(striker.x + Math.cos(angle) * 120, striker.y + Math.sin(angle) * 120); ctx.stroke();
        ctx.setLineDash([]);
    }
}

function updatePhysics() {
    let objects = [striker, ...coins];
    
    // Movement calculation tracking metrics paths loops
    objects.forEach(obj => {
        obj.x += obj.vx; obj.y += obj.vy;
        obj.vx *= FRICTION; obj.vy *= FRICTION;
        if (Math.abs(obj.vx) < 0.05) obj.vx = 0; if (Math.abs(obj.vy) < 0.05) obj.vy = 0;

        // Border elastic rebound edge bounce verification limits arrays
        if (obj.x < 30 + obj.radius) { obj.x = 30 + obj.radius; obj.vx *= -1; }
        if (obj.x > 470 - obj.radius) { obj.x = 470 - obj.radius; obj.vx *= -1; }
        if (obj.y < 30 + obj.radius) { obj.y = 30 + obj.radius; obj.vy *= -1; }
        if (obj.y > 470 - obj.radius) { obj.y = 470 - obj.radius; obj.vy *= -1; }
        
        // Pocket fall detection check parameter maps loops strings
        pockets.forEach(p => {
            let dist = Math.hypot(obj.x - p.x, obj.y - p.y);
            if (dist < POCKET_RADIUS) {
                if (obj === striker) {
                    // Reset striker parameters vector matrixes arrays instantly upon scratch
                    setTimeout(() => { striker.x = 250; striker.y = 400; striker.vx = 0; striker.vy = 0; }, 500);
                } else {
                    coins = coins.filter(c => c !== obj);
                }
            }
        });
    });

    // Rigid body circle-to-circle vector reflection collision engine
    for (let i = 0; i < objects.length; i++) {
        for (let j = i + 1; j < objects.length; j++) {
            let o1 = objects[i]; let o2 = objects[j];
            let dist = Math.hypot(o2.x - o1.x, o2.y - o1.y);
            if (dist < o1.radius + o2.radius) {
                let overlap = (o1.radius + o2.radius) - dist;
                let nx = (o2.x - o1.x) / dist; let ny = (o2.y - o1.y) / dist;
                o1.x -= nx * overlap * 0.5; o1.y -= ny * overlap * 0.5;
                o2.x += nx * overlap * 0.5; o2.y += ny * overlap * 0.5;
                let kx = o1.vx - o2.vx; let ky = o1.vy - o2.vy;
                let p = 2 * (nx * kx + ny * ky) / 2;
                o1.vx -= p * nx; o1.vy -= p * ny; o2.vx += p * nx; o2.vy += p * ny;
            }
        }
    }
}

// Interactive event action trackers tracking state pipelines
canvas.addEventListener('mousedown', (e) => {
    if (striker.vx === 0 && striker.vy === 0) {
        isCharging = true; chargeTimer = 0;
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left; mouseY = e.clientY - rect.top;
});

window.addEventListener('mouseup', () => {
    if (isCharging) {
        isCharging = false;
        let powerLevel = 1;
        if (chargeTimer > 30 && chargeTimer <= 60) powerLevel = 2;
        if (chargeTimer > 60) powerLevel = 3;
        
        let impulseVelocity = powerLevel * 7.5;
        let dx = mouseX - striker.x; let dy = mouseY - striker.y;
        let angle = Math.atan2(dy, dx);
        
        striker.vx = Math.cos(angle) * impulseVelocity;
        striker.vy = Math.sin(angle) * impulseVelocity;
        
        playArcadeSound('shoot');
        powerLabel.innerText = "LEVEL 0"; striker.baseColor = '#00e5ff';
    }
});

function gameLoop() {
    if (isCharging) {
        chargeTimer++;
        if (chargeTimer <= 30) { powerLabel.innerText = "LEVEL 1 • LOW"; striker.baseColor = '#22c55e'; }
        else if (chargeTimer > 30 && chargeTimer <= 60) { powerLabel.innerText = "LEVEL 2 • MID"; striker.baseColor = '#eab308'; }
        else { powerLabel.innerText = "LEVEL 3 • MAX BLAST!"; striker.baseColor = '#ef4444'; }
        if (chargeTimer % 10 === 0) playArcadeSound('tick');
    }
    updatePhysics(); drawBoard(); requestAnimationFrame(gameLoop);
}

initCoins(); gameLoop();
