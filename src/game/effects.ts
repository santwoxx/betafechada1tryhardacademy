/**
 * TRYHARD ACADEMY - Visual Effects System
 * Advanced Particles, Trails, and Lighting
 */

import { Point, GraphicQuality } from './engine';

export class EffectParticle {
    pos: Point = { x: 0, y: 0 };
    vel: Point = { x: 0, y: 0 };
    life: number = 0;
    maxLife: number = 1;
    color: string = '#fff';
    size: number = 2;
    active: boolean = false;
    glow: boolean = false;

    init(x: number, y: number, vx: number, vy: number, life: number, color: string, size: number, glow: boolean) {
        this.pos.x = x;
        this.pos.y = y;
        this.vel.x = vx;
        this.vel.y = vy;
        this.life = life;
        this.maxLife = life;
        this.color = color;
        this.size = size;
        this.glow = glow;
        this.active = true;
    }

    update(dt: number) {
        if (!this.active) return;
        this.pos.x += this.vel.x * (dt / 16);
        this.pos.y += this.vel.y * (dt / 16);
        this.life -= dt / 1000;
        if (this.life <= 0) this.active = false;
    }

    draw(ctx: CanvasRenderingContext2D, quality: GraphicQuality) {
        if (!this.active) return;
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        
        if (quality === 'high' && this.glow) {
            ctx.shadowBlur = 8;
            ctx.shadowColor = this.color;
        }

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

export class ParticlePool {
    private pool: EffectParticle[] = [];
    private maxSize: number = 500;

    constructor(size: number = 500) {
        this.maxSize = size;
        for (let i = 0; i < size; i++) {
            this.pool.push(new EffectParticle());
        }
    }

    spawn(x: number, y: number, color: string, count: number = 1, speed: number = 2, glow: boolean = true) {
        let spawned = 0;
        for (let i = 0; i < this.pool.length && spawned < count; i++) {
            if (!this.pool[i].active) {
                const angle = Math.random() * Math.PI * 2;
                const s = Math.random() * speed + 1;
                this.pool[i].init(
                    x, y, 
                    Math.cos(angle) * s, 
                    Math.sin(angle) * s, 
                    0.5 + Math.random() * 0.5, 
                    color, 
                    1 + Math.random() * 2,
                    glow
                );
                spawned++;
            }
        }
    }

    update(dt: number) {
        for (const p of this.pool) {
            if (p.active) p.update(dt);
        }
    }

    draw(ctx: CanvasRenderingContext2D, quality: GraphicQuality, viewport: { x: number, y: number, w: number, h: number }) {
        if (quality === 'low') return;
        for (const p of this.pool) {
            if (p.active) {
                // Culling
                if (p.pos.x > viewport.x && p.pos.x < viewport.x + viewport.w &&
                    p.pos.y > viewport.y && p.pos.y < viewport.y + viewport.h) {
                    p.draw(ctx, quality);
                }
            }
        }
    }
}

export class Trail {
    points: Point[] = [];
    maxLength: number = 10;
    color: string = '#fff';
    width: number = 2;

    constructor(maxLength: number, color: string, width: number) {
        this.maxLength = maxLength;
        this.color = color;
        this.width = width;
    }

    update(x: number, y: number) {
        this.points.unshift({ x, y });
        if (this.points.length > this.maxLength) {
            this.points.pop();
        }
    }

    draw(ctx: CanvasRenderingContext2D, quality: GraphicQuality) {
        if (this.points.length < 2 || quality === 'low') return;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }

        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if (quality === 'high') {
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
        }
        
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.restore();
    }
}

export class ScreenShake {
    intensity: number = 0;
    decay: number = 0.9;

    shake(amount: number) {
        this.intensity = amount;
    }

    update() {
        this.intensity *= this.decay;
        if (this.intensity < 0.1) this.intensity = 0;
    }

    apply(ctx: CanvasRenderingContext2D) {
        if (this.intensity > 0) {
            const x = (Math.random() - 0.5) * this.intensity;
            const y = (Math.random() - 0.5) * this.intensity;
            ctx.translate(x, y);
        }
    }
}

export const Lighting = {
    drawGlow: (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) => {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.globalCompositeOperation = 'screen';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }
};
