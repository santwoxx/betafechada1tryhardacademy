/**
 * TRYHARD ACADEMY - Audio Manager
 */

export class AudioManager {
    private static instance: AudioManager;
    private sounds: Map<string, HTMLAudioElement> = new Map();
    private enabled: boolean = true;
    private currentBgm: HTMLAudioElement | null = null;
    private unlocked: boolean = false;

    private constructor() {
        this.enabled = localStorage.getItem('tryhard_sound') !== 'false';
        
        // Preload sounds
        this.load('menu_bgm', 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3', true, 0.2);
        this.load('game_bgm', 'https://assets.mixkit.co/music/preview/mixkit-hip-hop-02-738.mp3', true, 0.15);
        this.load('shoot', 'https://assets.mixkit.co/sfx/preview/mixkit-laser-weapon-shot-1681.mp3', false, 0.1);
        this.load('correct', 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chime-2064.mp3', false, 0.3);
        this.load('wrong', 'https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3', false, 0.3);
        this.load('death', 'https://assets.mixkit.co/sfx/preview/mixkit-player-losing-or-failing-2042.mp3', false, 0.3);
        this.load('victory', 'https://assets.mixkit.co/sfx/preview/mixkit-video-game-win-2016.mp3', false, 0.4);
    }

    static getInstance() {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    /**
     * Unlocks audio on user interaction (required by browsers)
     */
    unlock() {
        if (this.unlocked) return;
        
        // Play a silent sound to unlock
        const silent = new Audio();
        silent.play().then(() => {
            this.unlocked = true;
            console.log("Audio unlocked");
            if (this.currentBgm && this.enabled) {
                this.currentBgm.play().catch(() => {});
            }
        }).catch(() => {});
    }

    private load(name: string, url: string, loop: boolean = false, volume: number = 0.5) {
        const audio = new Audio(url);
        audio.loop = loop;
        audio.volume = volume;
        audio.preload = 'auto';
        this.sounds.set(name, audio);
    }

    play(name: string) {
        if (!this.enabled) return;
        const sound = this.sounds.get(name);
        if (sound) {
            // For overlapping sounds like shooting, we use a small pool or clones
            if (name === 'shoot') {
                const clone = sound.cloneNode() as HTMLAudioElement;
                clone.volume = sound.volume;
                clone.play().catch(() => {});
            } else {
                sound.currentTime = 0;
                sound.play().catch(() => {});
            }
        }
    }

    playBgm(name: string) {
        if (this.currentBgm) {
            this.currentBgm.pause();
        }
        const sound = this.sounds.get(name);
        if (sound) {
            this.currentBgm = sound;
            if (this.enabled) {
                sound.play().catch(() => {});
            }
        }
    }

    toggle() {
        this.setEnabled(!this.enabled);
        return this.enabled;
    }

    setEnabled(enabled: boolean) {
        this.enabled = enabled;
        localStorage.setItem('tryhard_sound', String(enabled));
        if (!enabled) {
            if (this.currentBgm) this.currentBgm.pause();
        } else {
            if (this.currentBgm) this.currentBgm.play().catch(() => {});
        }
    }

    isEnabled() {
        return this.enabled;
    }
}
