/**
 * TRYHARD ACADEMY - Game Engine
 * Pure JavaScript 2D Arena Base
 * VERSÃO CORRIGIDA - HOST AUTHORITATIVE MULTIPLAYER
 * Todas as correções de colisão, dano, bots e sincronização aplicadas
 */

import { ParticlePool, Trail, ScreenShake, Lighting } from './effects';

export interface Point {
    x: number;
    y: number;
}

export type GraphicQuality = 'low' | 'medium' | 'high';

export class Projectile {
    pos: Point = { x: 0, y: 0 };
    vel: Point = { x: 0, y: 0 };
    radius: number = 4;
    color: string = '#fff';
    glowColor: string = '#fff';
    active: boolean = false;
    owner: 'player' | 'bot' | 'remote' = 'player';
    ownerId?: string;
    trail: Trail;

    constructor() {
        this.trail = new Trail(10, '#fff', 2);
    }

    init(x: number, y: number, angle: number, owner: 'player' | 'bot' | 'remote' = 'player', ownerId?: string) {
        this.pos.x = x;
        this.pos.y = y;
        const speed = owner === 'bot' ? 6 : 10;
        this.vel.x = Math.cos(angle) * speed;
        this.vel.y = Math.sin(angle) * speed;
        this.radius = 4;
        this.color = owner === 'player' ? '#00f2ff' : (owner === 'bot' ? '#ff4d00' : '#bc13fe'); 
        this.glowColor = this.color;
        this.owner = owner;
        this.ownerId = ownerId;
        this.active = true;
        this.trail.color = this.color;
        this.trail.points = []; // Reset trail
    }

    update(bounds: { width: number, height: number }, dt: number) {
        if (!this.active) return;
        this.pos.x += this.vel.x * (dt / 16);
        this.pos.y += this.vel.y * (dt / 16);
        this.trail.update(this.pos.x, this.pos.y);

        if (this.pos.x < -50 || this.pos.x > bounds.width + 50 || 
            this.pos.y < -50 || this.pos.y > bounds.height + 50) {
            this.active = false;
        }
    }

    draw(ctx: CanvasRenderingContext2D, quality: GraphicQuality = 'high') {
        if (!this.active) return;
        this.trail.draw(ctx, quality);
        ctx.save();
        if (quality !== 'low') {
            ctx.shadowBlur = quality === 'medium' ? 5 : 15;
            ctx.shadowColor = this.glowColor;
        }
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

export class ProjectilePool {
    private pool: Projectile[] = [];
    
    constructor(size: number = 100) {
        for (let i = 0; i < size; i++) {
            this.pool.push(new Projectile());
        }
    }

    spawn(x: number, y: number, angle: number, owner: 'player' | 'bot' | 'remote' = 'player', ownerId?: string) {
        const p = this.pool.find(p => !p.active);
        if (p) {
            p.init(x, y, angle, owner, ownerId);
            return p;
        }
        return null;
    }

    update(bounds: { width: number, height: number }, dt: number) {
        this.pool.forEach(p => p.update(bounds, dt));
    }

    draw(ctx: CanvasRenderingContext2D, quality: GraphicQuality, viewport: { x: number, y: number, w: number, h: number }) {
        this.pool.forEach(p => {
            if (p.active) {
                // Culling
                if (p.pos.x > viewport.x - 50 && p.pos.x < viewport.x + viewport.w + 50 &&
                    p.pos.y > viewport.y - 50 && p.pos.y < viewport.y + viewport.h + 50) {
                    p.draw(ctx, quality);
                }
            }
        });
    }

    getActive() {
        return this.pool.filter(p => p.active);
    }
}

export class Star {
    pos: Point;
    radius: number = 20;
    color: string = '#ffea00'; // Neon Yellow
    glowColor: string = '#ffea00';
    isDead: boolean = false;
    pulse: number = 0;

    constructor(x: number, y: number) {
        this.pos = { x, y };
    }

    update() {
        this.pulse += 0.05;
    }

    draw(ctx: CanvasRenderingContext2D, quality: GraphicQuality = 'high') {
        ctx.save();
        const scale = 1 + Math.sin(this.pulse) * 0.1;
        ctx.translate(this.pos.x, this.pos.y);
        ctx.scale(scale, scale);

        if (quality !== 'low') {
            ctx.shadowBlur = quality === 'medium' ? 8 : 20;
            ctx.shadowColor = this.glowColor;
        }
        
        ctx.beginPath();
        const spikes = 5;
        const outerRadius = this.radius;
        const innerRadius = this.radius / 2;
        let rot = Math.PI / 2 * 3;
        let x = 0;
        let y = 0;
        const step = Math.PI / spikes;

        ctx.moveTo(0, -outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = Math.cos(rot) * outerRadius;
            y = Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = Math.cos(rot) * innerRadius;
            y = Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(0, -outerRadius);
        ctx.closePath();
        
        ctx.fillStyle = 'rgba(255, 234, 0, 0.3)';
        ctx.fill();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = this.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 0, 0);

        ctx.restore();
    }
}

export class Bot {
    pos: Point;
    vel: Point;
    radius: number = 20;
    speed: number = 0.4;
    friction: number = 0.95;
    color: string = '#ff4d00'; // Neon Orange
    glowColor: string = '#ff4d00';
    angle: number = 0;
    lives: number = 1;
    isDead: boolean = false;
    shootCooldown: number = 0;
    maxShootCooldown: number = 1500 + Math.random() * 1000;
    targetAngle: number = 0;
    changeDirTimer: number = 0;
    trail: Trail;

    constructor(x: number, y: number) {
        this.pos = { x, y };
        this.vel = { x: 0, y: 0 };
        this.trail = new Trail(15, 'rgba(255, 77, 0, 0.3)', 15);
    }

    update(playerPos: Point, bounds: { width: number, height: number }, time: number): number | null {
        this.changeDirTimer -= 16; // Approx ms per frame
        if (this.changeDirTimer <= 0) {
            this.targetAngle = Math.random() * Math.PI * 2;
            this.changeDirTimer = 1000 + Math.random() * 2000;
        }

        // Pursuit logic (gentle)
        const dx = playerPos.x - this.pos.x;
        const dy = playerPos.y - this.pos.y;
        const distSq = dx * dx + dy * dy;
        const pursuitAngle = Math.atan2(dy, dx);

        // Blend random movement with pursuit
        const moveX = Math.cos(this.targetAngle) * 0.7 + Math.cos(pursuitAngle) * 0.3;
        const moveY = Math.sin(this.targetAngle) * 0.7 + Math.sin(pursuitAngle) * 0.3;

        this.vel.x += moveX * this.speed;
        this.vel.y += moveY * this.speed;

        this.vel.x *= this.friction;
        this.vel.y *= this.friction;

        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;
        this.trail.update(this.pos.x, this.pos.y);

        this.angle = Math.atan2(this.vel.y, this.vel.x);

        // Bounds
        if (this.pos.x < this.radius) { this.pos.x = this.radius; this.vel.x *= -1; }
        if (this.pos.x > bounds.width - this.radius) { this.pos.x = bounds.width - this.radius; this.vel.x *= -1; }
        if (this.pos.y < this.radius) { this.pos.y = this.radius; this.vel.y *= -1; }
        if (this.pos.y > bounds.height - this.radius) { this.pos.y = bounds.height - this.radius; this.vel.y *= -1; }

        // Shooting logic
        if (time > this.shootCooldown && distSq < 250000) { // 500px squared
            this.shootCooldown = time + this.maxShootCooldown;
            // Add some "human error" to the angle
            const error = (Math.random() - 0.5) * 0.4;
            return pursuitAngle + error;
        }

        return null;
    }

    draw(ctx: CanvasRenderingContext2D, quality: GraphicQuality = 'high') {
        this.trail.draw(ctx, quality);
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);
        if (quality !== 'low') {
            ctx.shadowBlur = quality === 'medium' ? 5 : 15;
            ctx.shadowColor = this.glowColor;
        }

        // Draw Triangle/Arrow shape for bots
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius, this.radius * 0.8);
        ctx.lineTo(-this.radius * 0.5, 0);
        ctx.lineTo(-this.radius, -this.radius * 0.8);
        ctx.closePath();

        ctx.fillStyle = 'rgba(255, 77, 0, 0.2)';
        ctx.fill();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }
}

export class Player {
    pos: Point;
    vel: Point;
    radius: number;
    speed: number;
    friction: number;
    color: string;
    glowColor: string;
    angle: number;
    shootCooldown: number = 0;
    maxShootCooldown: number = 200; // ms
    lives: number = 3;
    ammo: number = 3;
    nickname: string = '';
    trophies: number = 0;
    trail: Trail;

    constructor(x: number, y: number) {
        this.pos = { x, y };
        this.vel = { x: 0, y: 0 };
        this.radius = 25;
        this.speed = 0.8;
        this.friction = 0.92;
        this.color = '#bc13fe'; // Neon Purple
        this.glowColor = '#bc13fe';
        this.angle = 0;
        this.trail = new Trail(20, 'rgba(188, 19, 254, 0.3)', 20);
    }

    canShoot(time: number): boolean {
        return time > this.shootCooldown && this.ammo > 0;
    }

    shoot(time: number, target: Point): number | null {
        if (!this.canShoot(time)) return null;

        this.ammo--;
        this.shootCooldown = time + this.maxShootCooldown;
        const angle = Math.atan2(target.y - this.pos.y, target.x - this.pos.x);
        
        this.vel.x -= Math.cos(angle) * 2;
        this.vel.y -= Math.sin(angle) * 2;

        return angle;
    }

    update(input: { x: number, y: number }, bounds: { width: number, height: number }) {
        this.vel.x += input.x * this.speed;
        this.vel.y += input.y * this.speed;

        this.vel.x *= this.friction;
        this.vel.y *= this.friction;

        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;
        this.trail.update(this.pos.x, this.pos.y);

        if (Math.abs(this.vel.x) > 0.1 || Math.abs(this.vel.y) > 0.1) {
            this.angle = Math.atan2(this.vel.y, this.vel.x);
        }

        if (this.pos.x < this.radius) {
            this.pos.x = this.radius;
            this.vel.x *= -0.5;
        }
        if (this.pos.x > bounds.width - this.radius) {
            this.pos.x = bounds.width - this.radius;
            this.vel.x *= -0.5;
        }
        if (this.pos.y < this.radius) {
            this.pos.y = this.radius;
            this.vel.y *= -0.5;
        }
        if (this.pos.y > bounds.height - this.radius) {
            this.pos.y = bounds.height - this.radius;
            this.vel.y *= -0.5;
        }
    }

    draw(ctx: CanvasRenderingContext2D, quality: GraphicQuality = 'high') {
        this.trail.draw(ctx, quality);
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);

        if (quality !== 'low') {
            ctx.shadowBlur = quality === 'medium' ? 10 : 20;
            ctx.shadowColor = this.glowColor;
        }

        ctx.beginPath();
        const sides = 6;
        for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI) / sides;
            const x = this.radius * Math.cos(angle);
            const y = this.radius * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();

        ctx.fillStyle = 'rgba(188, 19, 254, 0.2)';
        ctx.fill();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
        ctx.strokeStyle = '#00f2ff';
        ctx.stroke();

        ctx.restore();

        // Draw Nickname and Trophies
        if (this.nickname) {
            ctx.save();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.nickname, this.pos.x, this.pos.y - this.radius - 20);
            
            ctx.fillStyle = '#ffea00';
            ctx.font = '10px Arial';
            ctx.fillText(`👑 ${this.trophies || 0}`, this.pos.x, this.pos.y - this.radius - 8);
            ctx.restore();
        }
    }
}

export class RemotePlayer extends Player {
    uid: string;
    nickname: string;
    trophies: number;
    targetPos: Point;
    targetVel: Point;
    lerpFactor: number = 0.18;

    constructor(uid: string, nickname: string, trophies: number, x: number, y: number) {
        super(x, y);
        this.uid = uid;
        this.nickname = nickname;
        this.trophies = trophies;
        this.color = '#00f2ff'; // Cyan for remote players
        this.targetPos = { x, y };
        this.targetVel = { x: 0, y: 0 };
    }

    updateFromRemote(data: any) {
        if (data.pos) this.targetPos = data.pos;
        if (data.vel) this.targetVel = data.vel;
        if (data.lives !== undefined) this.lives = data.lives;
        if (data.ammo !== undefined) this.ammo = data.ammo;
        if (data.nickname) this.nickname = data.nickname;
        if (data.trophies !== undefined) this.trophies = data.trophies;
    }

    updateInterpolation() {
        // Smoothly interpolate towards target position and velocity
        this.pos.x += (this.targetPos.x - this.pos.x) * this.lerpFactor;
        this.pos.y += (this.targetPos.y - this.pos.y) * this.lerpFactor;
        
        this.vel.x += (this.targetVel.x - this.vel.x) * this.lerpFactor;
        this.vel.y += (this.targetVel.y - this.vel.y) * this.lerpFactor;

        if (Math.abs(this.vel.x) > 0.1 || Math.abs(this.vel.y) > 0.1) {
            this.angle = Math.atan2(this.vel.y, this.vel.x);
        }
    }
}

import { AudioManager } from './audio';

export class Game {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    player: Player;
    remotePlayers: Map<string, RemotePlayer> = new Map();
    projectilePool: ProjectilePool;
    pool: ParticlePool;
    shake: ScreenShake;
    stars: Star[] = [];
    bots: Bot[] = [];
    quality: GraphicQuality = 'high';
    keys: { [key: string]: boolean } = {};
    joystickInput: Point = { x: 0, y: 0 };
    gridOffset: number = 0;
    lastTime: number = 0;
    isShooting: boolean = false;
    shootTimer: number = 0;
    shootInterval: number = 200; // ms
    mousePos: Point = { x: 0, y: 0 };
    paused: boolean = false;
    gameOver: boolean = false;
    isMultiplayer: boolean = false;
    isHost: boolean = false;
    isMobile: boolean = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    onStarCollected?: () => void;
    onGameOver?: () => void;
    onShoot?: (projectile: Projectile) => void;
    onBotUpdate?: (bots: any[]) => void;
    onPlayerHit?: (victimId: string, damage: number, killerId: string) => void;
    starSpawnTimer: number = 0;
    kills: number = 0;
    fps: number = 60;
    fpsHistory: number[] = [];

    private lastHitTimestamps: Map<string, number> = new Map(); // proteção contra double-hit

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false })!; // Performance optimization
        this.player = new Player(canvas.width / 2, canvas.height / 2);
        this.projectilePool = new ProjectilePool(100);
        this.pool = new ParticlePool(500);
        this.shake = new ScreenShake();

        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
        window.addEventListener('blur', () => {
            this.keys = {};
            this.isShooting = false;
            this.joystickInput = { x: 0, y: 0 };
        });
        
        this.loop = this.loop.bind(this);
    }

    reset() {
        this.player = new Player(this.canvas.width / 2, this.canvas.height / 2);
        this.projectilePool = new ProjectilePool(100);
        this.pool = new ParticlePool(500);
        this.stars = [];
        this.bots = [];
        this.kills = 0;
        this.gameOver = false;
        this.paused = false;
        this.starSpawnTimer = 0;
        this.lastHitTimestamps.clear();
    }

    setQuality(quality: GraphicQuality) {
        this.quality = quality;
    }

    setJoystickInput(x: number, y: number) {
        this.joystickInput = { x, y };
    }

    setShooting(shooting: boolean, x?: number, y?: number) {
        this.isShooting = shooting;
        if (x !== undefined && y !== undefined) {
            this.mousePos = { x, y };
        }
    }

    updateMousePos(x: number, y: number) {
        this.mousePos = { x, y };
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.player.pos.x = Math.min(this.player.pos.x, this.canvas.width - this.player.radius);
        this.player.pos.y = Math.min(this.player.pos.y, this.canvas.height - this.player.radius);
    }

    private getInput() {
        let ix = 0;
        let iy = 0;

        if (this.keys['KeyW'] || this.keys['ArrowUp']) iy -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) iy += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) ix -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) ix += 1;

        if (ix !== 0 && iy !== 0) {
            const mag = Math.sqrt(ix * ix + iy * iy);
            ix /= mag;
            iy /= mag;
        }

        if (Math.abs(this.joystickInput.x) > 0.1 || Math.abs(this.joystickInput.y) > 0.1) {
            return this.joystickInput;
        }

        return { x: ix, y: iy };
    }

    private drawGrid() {
        const spacing = 60;
        this.gridOffset = (this.gridOffset + 0.8) % spacing;

        // Parallax effect based on player movement
        const px = this.player.pos.x * 0.05;
        const py = this.player.pos.y * 0.05;

        this.ctx.strokeStyle = 'rgba(0, 242, 255, 0.1)';
        this.ctx.lineWidth = 1;

        for (let x = -spacing + (this.gridOffset - px) % spacing; x < this.canvas.width + spacing; x += spacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = -spacing + (this.gridOffset - py) % spacing; y < this.canvas.height + spacing; y += spacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
        
        // Vignette / Bloom fake
        const grad = this.ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, 0,
            this.canvas.width / 2, this.canvas.height / 2, this.canvas.width * 0.9
        );
        grad.addColorStop(0, 'rgba(5, 5, 5, 0)');
        grad.addColorStop(1, 'rgba(5, 5, 5, 0.9)');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    private spawnStar() {
        const margin = 50;
        const x = margin + Math.random() * (this.canvas.width - margin * 2);
        const y = margin + Math.random() * (this.canvas.height - margin * 2);
        this.stars.push(new Star(x, y));
    }

    private spawnBot() {
        const margin = 50;
        let x, y;
        // Spawn away from player
        do {
            x = margin + Math.random() * (this.canvas.width - margin * 2);
            y = margin + Math.random() * (this.canvas.height - margin * 2);
        } while (Math.sqrt((x - this.player.pos.x)**2 + (y - this.player.pos.y)**2) < 300);
        
        this.bots.push(new Bot(x, y));
    }

    private spawnParticles(x: number, y: number, color: string, count: number = 10, speed: number = 2, glow: boolean = true) {
        if (this.quality === 'low') return;
        this.pool.spawn(x, y, color, count, speed, glow);
    }

    private updateQualityScaling(dt: number) {
        const currentFps = 1000 / dt;
        this.fpsHistory.push(currentFps);
        if (this.fpsHistory.length > 60) this.fpsHistory.shift();
        
        const avgFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
        
        // Auto-scale quality if FPS drops significantly
        if (avgFps < 30 && this.quality === 'high') {
            this.quality = 'medium';
            this.fpsHistory = [];
        } else if (avgFps < 20 && this.quality === 'medium') {
            this.quality = 'low';
            this.fpsHistory = [];
        }
    }

    private getAimAssistAngle(currentAngle: number): number {
        if (!this.isMobile) return currentAngle;

        let nearestTarget: Point | null = null;
        let minDistSq = 90000; // 300px radius squared

        // Check bots
        this.bots.forEach(bot => {
            if (bot.isDead) return;
            const dx = bot.pos.x - this.player.pos.x;
            const dy = bot.pos.y - this.player.pos.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < minDistSq) {
                minDistSq = distSq;
                nearestTarget = bot.pos;
            }
        });

        // Check remote players
        this.remotePlayers.forEach(remote => {
            const dx = remote.pos.x - this.player.pos.x;
            const dy = remote.pos.y - this.player.pos.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < minDistSq) {
                minDistSq = distSq;
                nearestTarget = remote.pos;
            }
        });

        if (nearestTarget) {
            const targetAngle = Math.atan2(nearestTarget.y - this.player.pos.y, nearestTarget.x - this.player.pos.x);
            // Lerp angle slightly towards target (0.3 strength)
            let diff = targetAngle - currentAngle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            return currentAngle + diff * 0.3;
        }

        return currentAngle;
    }

    updateBotFromRemote(id: number, data: any) {
        let bot = this.bots[id];
        if (!bot) {
            bot = new Bot(data.pos.x, data.pos.y);
            this.bots[id] = bot;
        }
        bot.pos = data.pos;
        bot.angle = data.angle;
        bot.isDead = data.isDead;
        bot.lives = data.lives;
    }

    private update(dt: number, time: number) {
        this.updateQualityScaling(dt);
        this.shake.update();

        // Spawning
        this.starSpawnTimer += dt;
        if (this.starSpawnTimer > 3000 && this.stars.length < 3) {
            this.spawnStar();
            this.starSpawnTimer = 0;
        }
        while (this.bots.length < 4) {
            this.spawnBot();
        }

        const input = this.getInput();
        this.player.update(input, { width: this.canvas.width, height: this.canvas.height });

        // Shooting logic
        if (this.isShooting && this.player.ammo > 0) {
            this.shootTimer += dt;
            if (this.shootTimer >= this.shootInterval) {
                const rawAngle = Math.atan2(this.mousePos.y - this.player.pos.y, this.mousePos.x - this.player.pos.x);
                const angle = this.getAimAssistAngle(rawAngle);
                const p = this.projectilePool.spawn(this.player.pos.x, this.player.pos.y, angle, 'player', (this.player as any).uid);
                if (p) {
                    this.player.ammo--;
                    AudioManager.getInstance().play('shoot');
                    this.spawnParticles(p.pos.x, p.pos.y, p.color, 5, 1, false);
                    if (this.onShoot) this.onShoot(p);
                    if (this.quality === 'high') this.shake.shake(2);
                    if (this.isMobile && window.navigator.vibrate) window.navigator.vibrate(10);
                }
                this.shootTimer = 0;
            }
        } else {
            this.shootTimer = this.shootInterval; // Ready to shoot immediately
        }

        // Update Bots - SOMENTE HOST controla e sincroniza bots
        if (!this.isMultiplayer || this.isHost) {
            this.bots.forEach((bot, index) => {
                const angle = bot.update(this.player.pos, { width: this.canvas.width, height: this.canvas.height }, time);
                if (angle !== null) {
                    const p = this.projectilePool.spawn(bot.pos.x, bot.pos.y, angle as number, 'bot', `bot_${index}`);
                    if (p) {
                        this.spawnParticles(p.pos.x, p.pos.y, p.color, 3, 1, false);
                        if (this.onShoot) {
                            this.onShoot(p);
                        }
                    }
                }
            });
            
            if (this.isMultiplayer && this.isHost && this.onBotUpdate) {
                this.onBotUpdate(this.bots.map(b => ({
                    pos: b.pos,
                    angle: b.angle,
                    isDead: b.isDead,
                    lives: b.lives
                })));
            }
        }

        // Update Projectiles
        this.projectilePool.update({ width: this.canvas.width, height: this.canvas.height }, dt);
        this.remotePlayers.forEach(r => r.updateInterpolation());

        // Update Particles
        this.pool.update(dt);

        // ==================== COLISÕES - HOST AUTHORITATIVE ====================
        const activeProjectiles = this.projectilePool.getActive();
        const now = Date.now();

        activeProjectiles.forEach(p => {
            // Projectile vs Bots (host authority only)
            this.bots.forEach((bot, index) => {
                if (bot.isDead) return;
                const dx = p.pos.x - bot.pos.x;
                const dy = p.pos.y - bot.pos.y;
                const distSq = dx * dx + dy * dy;
                const minDist = p.radius + bot.radius;
                if (distSq < minDist * minDist) {
                    p.active = false;
                    this.spawnParticles(p.pos.x, p.pos.y, p.color, 15, 3);
                    if (this.quality === 'high') this.shake.shake(5);
                    
                    // Only host or offline mode updates bot lives
                    if (!this.isMultiplayer || this.isHost) {
                        bot.lives--;
                        if (bot.lives <= 0) {
                            bot.isDead = true;
                            this.spawnParticles(bot.pos.x, bot.pos.y, bot.color, 40, 5);
                            AudioManager.getInstance().play('death');
                            if (p.owner === 'player') this.kills++;
                            if (this.quality === 'high') this.shake.shake(15);
                        }
                    }
                }
            });

            // ==================== PLAYER VS PLAYER COLLISIONS ====================
            if (!this.isMultiplayer || this.isHost) {
                // Local player hit check
                {
                    const dxLocal = p.pos.x - this.player.pos.x;
                    const dyLocal = p.pos.y - this.player.pos.y;
                    const distSqLocal = dxLocal * dxLocal + dyLocal * dyLocal;
                    const minDistLocal = p.radius + this.player.radius;

                    if (distSqLocal < minDistLocal * minDistLocal) {
                        // Não acertar a si mesmo
                        if (p.ownerId !== (this.player as any).uid) {
                            const victimKey = `local_${(this.player as any).uid}`;
                            if (!this.lastHitTimestamps.has(victimKey) || now - this.lastHitTimestamps.get(victimKey)! > 150) {
                                this.lastHitTimestamps.set(victimKey, now);
                                p.active = false;
                                this.spawnParticles(p.pos.x, p.pos.y, p.color, 15, 3);
                                
                                if (this.isMultiplayer && this.isHost) {
                                    if (this.onPlayerHit) this.onPlayerHit((this.player as any).uid, 1, p.ownerId || 'unknown');
                                } else {
                                    this.player.lives--;
                                    if (this.quality === 'high') this.shake.shake(20);
                                    if (this.player.lives <= 0) {
                                        this.spawnParticles(this.player.pos.x, this.player.pos.y, this.player.color, 60, 6);
                                        this.gameOver = true;
                                        if (this.onGameOver) this.onGameOver();
                                    }
                                }
                            }
                        }
                    }
                }

                // Remote players hit check
                this.remotePlayers.forEach(remote => {
                    const dx = p.pos.x - remote.pos.x;
                    const dy = p.pos.y - remote.pos.y;
                    const distSq = dx * dx + dy * dy;
                    const minDist = p.radius + remote.radius;

                    if (distSq < minDist * minDist) {
                        // Não acertar o dono do projétil
                        if (p.ownerId !== remote.uid) {
                            const victimKey = `remote_${remote.uid}`;
                            if (!this.lastHitTimestamps.has(victimKey) || now - this.lastHitTimestamps.get(victimKey)! > 150) {
                                this.lastHitTimestamps.set(victimKey, now);
                                p.active = false;
                                this.spawnParticles(p.pos.x, p.pos.y, p.color, 15, 3);
                                
                                if (this.isMultiplayer && this.isHost) {
                                    if (this.onPlayerHit) this.onPlayerHit(remote.uid, 1, p.ownerId || 'unknown');
                                } else {
                                    remote.lives--;
                                }
                            }
                        }
                    }
                });
            } else {
                // Non-host: apenas efeitos visuais para hits no jogador local
                const dx = p.pos.x - this.player.pos.x;
                const dy = p.pos.y - this.player.pos.y;
                const distSq = dx * dx + dy * dy;
                const minDist = p.radius + this.player.radius;
                if (distSq < minDist * minDist && p.ownerId !== (this.player as any).uid) {
                    const victimKey = `local_${(this.player as any).uid}`;
                    if (!this.lastHitTimestamps.has(victimKey) || now - this.lastHitTimestamps.get(victimKey)! > 150) {
                        this.lastHitTimestamps.set(victimKey, now);
                        p.active = false;
                        this.spawnParticles(p.pos.x, p.pos.y, p.color, 15, 3);
                        if (this.quality === 'high') this.shake.shake(10);
                    }
                }
            }
        });

        // Player vs Stars
        this.stars.forEach(star => {
            if (star.isDead) return;
            star.update();
            const dx = this.player.pos.x - star.pos.x;
            const dy = this.player.pos.y - star.pos.y;
            const distSq = dx * dx + dy * dy;
            const minDist = this.player.radius + star.radius;
            if (distSq < minDist * minDist) {
                star.isDead = true;
                this.spawnParticles(star.pos.x, star.pos.y, star.color, 30, 4);
                if (this.onStarCollected) this.onStarCollected();
            }
        });

        // Cleanup
        this.stars = this.stars.filter(s => !s.isDead);
        this.bots = this.bots.filter(b => !b.isDead);

        // Limpeza periódica do anti-double-hit
        if (this.lastHitTimestamps.size > 20) {
            const cutoff = now - 1000;
            for (const [key, ts] of this.lastHitTimestamps) {
                if (ts < cutoff) this.lastHitTimestamps.delete(key);
            }
        }
    }

    private draw() {
        this.ctx.fillStyle = '#050505';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.shake.apply(this.ctx);

        this.drawGrid();

        // Lighting (High Quality)
        if (this.quality === 'high') {
            this.projectilePool.getActive().forEach(p => {
                Lighting.drawGlow(this.ctx, p.pos.x, p.pos.y, 40, p.color + '33');
            });
            this.stars.forEach(s => {
                Lighting.drawGlow(this.ctx, s.pos.x, s.pos.y, 60, s.color + '22');
            });
            Lighting.drawGlow(this.ctx, this.player.pos.x, this.player.pos.y, 80, this.player.color + '22');
        }

        this.stars.forEach(s => s.draw(this.ctx, this.quality));
        this.bots.forEach(b => b.draw(this.ctx, this.quality));
        this.remotePlayers.forEach(r => r.draw(this.ctx, this.quality));
        this.projectilePool.draw(this.ctx, this.quality, { x: 0, y: 0, w: this.canvas.width, h: this.canvas.height });
        this.player.draw(this.ctx, this.quality);
        this.pool.draw(this.ctx, this.quality, { x: 0, y: 0, w: this.canvas.width, h: this.canvas.height });

        this.ctx.restore();
    }

    loop(time: number) {
        if (this.paused || this.gameOver) {
            this.lastTime = time;
            requestAnimationFrame(this.loop);
            return;
        }

        const dt = time - this.lastTime;
        this.lastTime = time;
        if (dt > 100) { // Tab was inactive
            requestAnimationFrame(this.loop);
            return;
        }

        this.update(dt, time);
        this.draw();

        requestAnimationFrame(this.loop);
    }

    start() {
        this.resize();
        requestAnimationFrame(this.loop);
    }
}