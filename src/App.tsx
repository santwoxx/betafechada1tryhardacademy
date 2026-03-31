import React, { useEffect, useRef, useState, useCallback, Component, ReactNode } from 'react';
import { Game, Projectile, RemotePlayer, GraphicQuality, Point } from './game/engine';
import { Heart, Zap, Settings, Trophy, Users, X, Crown, Volume2, VolumeX, Timer, Star, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './firebase';
import { AudioManager } from './game/audio';
import { MathEngine, Question } from './game/mathEngine';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { 
  ref,
  set,
  update,
  onValue,
  push,
  onChildAdded,
  get,
  query,
  orderByChild,
  equalTo,
  limitToLast,
  serverTimestamp,
  remove,
  onDisconnect
} from 'firebase/database';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface DatabaseErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleDatabaseError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: DatabaseErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Database Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) message = `Firebase Error: ${parsed.error}`;
      } catch (e) {
        message = this.state.error.message || message;
      }

      return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black p-8 text-center">
          <div className="max-w-md">
            <h2 className="text-red-500 text-2xl font-bold mb-4">Application Error</h2>
            <p className="text-white/70 mb-8">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-500 text-white rounded-lg font-bold"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const joystickRef = useRef<HTMLDivElement>(null);
  const [isTouch, setIsTouch] = useState(false);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'lobby'>('menu');
  const [showModal, setShowModal] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | 'timeout' | null>(null);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(8);
  const [stats, setStats] = useState({ lives: 3, ammo: 3, kills: 0 });
  const [nickname, setNickname] = useState(localStorage.getItem('nickname') || 'Player');
  const [quality, setQuality] = useState<GraphicQuality>((localStorage.getItem('quality') as GraphicQuality) || 'high');
  const [user, setUser] = useState<any>(null);
  const [room, setRoom] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [matchmakingStatus, setMatchmakingStatus] = useState<string>('');
  const [playerData, setPlayerData] = useState<any>(null);
  const [soundEnabled, setSoundEnabled] = useState(AudioManager.getInstance().isEnabled());
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number } | null>(null);
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickHandlePos, setJoystickHandlePos] = useState({ x: 0, y: 0 });
  const [isShootingMobile, setIsShootingMobile] = useState(false);
  const [particles, setParticles] = useState<{ id: string | number; x: number; y: number; color: string }[]>([]);
  const lastSyncTimeRef = useRef<number>(0);
  const lastSentStateRef = useRef<{ pos: Point; vel: Point; lives: number; ammo: number } | null>(null);

  const userRef = useRef(user);
  const roomRef = useRef(room);
  const nicknameRef = useRef(nickname);
  const playerDataRef = useRef(playerData);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    nicknameRef.current = nickname;
  }, [nickname]);

  useEffect(() => {
    playerDataRef.current = playerData;
  }, [playerData]);

  // Audio Unlock on first interaction
  useEffect(() => {
    const handleInteraction = () => {
      AudioManager.getInstance().unlock();
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
    window.addEventListener('pointerdown', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    return () => {
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  // Sync quality to game instance and localStorage
  useEffect(() => {
    localStorage.setItem('quality', quality);
    if (gameRef.current) {
      gameRef.current.setQuality(quality);
    }
  }, [quality]);

  // Background music management
  useEffect(() => {
    if (gameState === 'playing') {
      AudioManager.getInstance().playBgm('game_bgm');
    } else {
      AudioManager.getInstance().playBgm('menu_bgm');
    }
  }, [gameState]);

  // Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const playerRef = ref(db, `players/${u.uid}`);
        try {
          const playerSnap = await get(playerRef);
          if (!playerSnap.exists()) {
            await set(playerRef, {
              uid: u.uid,
              nickname: nickname,
              trophies: 0,
              lastUpdate: serverTimestamp()
            });
          } else {
            const data = playerSnap.val();
            setPlayerData(data);
            if (data.nickname) setNickname(data.nickname);
          }
        } catch (error) {
          handleDatabaseError(error, OperationType.GET, `players/${u.uid}`);
        }
      } else {
        signInAnonymously(auth).catch(err => console.error("Anonymous login error:", err));
      }
    });

    return unsubscribe;
  }, []);

  // Leaderboard listener
  useEffect(() => {
    if (!user) return;
    const leaderboardRef = query(ref(db, 'players'), orderByChild('trophies'), limitToLast(10));
    const unsubscribe = onValue(leaderboardRef, (snapshot) => {
      const players: any[] = [];
      snapshot.forEach((childSnapshot) => {
        players.push({ ...childSnapshot.val(), uid: childSnapshot.key });
      });
      setLeaderboard(players.reverse());
    }, (error) => {
      handleDatabaseError(error, OperationType.LIST, 'players');
    });
    return unsubscribe;
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
      if ((error as any).code === 'auth/admin-restricted-operation') {
        alert("Login is restricted. Please ensure Google Auth is enabled in Firebase Console.");
      }
    }
  };

  useEffect(() => {
    if (showModal || showGameOver || gameState !== 'playing') {
      if (gameRef.current) gameRef.current.setShooting(false);
      setIsShootingMobile(false);
    }
  }, [showModal, showGameOver, gameState]);

  const updateStats = useCallback(() => {
    if (gameRef.current) {
      setStats({
        lives: gameRef.current.player.lives,
        ammo: gameRef.current.player.ammo,
        kills: gameRef.current.kills
      });

      if (gameRef.current.isMultiplayer && userRef.current && roomRef.current) {
        const now = Date.now();
        if (now - lastSyncTimeRef.current >= 50) {
          const player = gameRef.current.player;
          const currentState = {
            pos: { x: Number(player.pos.x.toFixed(1)), y: Number(player.pos.y.toFixed(1)) },
            vel: { x: Number(player.vel.x.toFixed(1)), y: Number(player.vel.y.toFixed(1)) },
            lives: player.lives,
            ammo: player.ammo,
            nickname: nicknameRef.current,
            trophies: playerDataRef.current?.trophies || 0
          };

          const lastState = lastSentStateRef.current;
          const hasChanged = !lastState ||
            Math.abs(currentState.pos.x - lastState.pos.x) > 0.5 ||
            Math.abs(currentState.pos.y - lastState.pos.y) > 0.5 ||
            Math.abs(currentState.vel.x - lastState.vel.x) > 0.2 ||
            Math.abs(currentState.vel.y - lastState.vel.y) > 0.2 ||
            currentState.lives !== lastState.lives ||
            currentState.ammo !== lastState.ammo;

          if (hasChanged) {
            lastSyncTimeRef.current = now;
            lastSentStateRef.current = currentState as any;
            
            const playerRef = ref(db, `rooms/${roomRef.current.id}/players/${userRef.current.uid}`);
            update(playerRef, {
              ...currentState,
              lastUpdate: serverTimestamp()
            }).catch(error => {
              console.warn('Sync failed:', error.message);
            });
          }
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!canvasRef.current || gameState !== 'playing') return;

    const game = new Game(canvasRef.current);
    const isMobileDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    game.isMobile = isMobileDevice;
    setIsTouch(isMobileDevice);
    gameRef.current = game;
    
    if (userRef.current) {
      game.setQuality(quality);
      (game.player as any).uid = userRef.current.uid;
      (game.player as any).nickname = nicknameRef.current;
      (game.player as any).trophies = playerDataRef.current?.trophies || 0;
    }

    // ===================== ONPLAYERHIT CORRIGIDO =====================
    game.onPlayerHit = (victimId: string, damage: number, killerId: string) => {
      if (!game.isMultiplayer || !game.isHost || !roomRef.current) return;

      const victimRef = ref(db, `rooms/${roomRef.current.id}/players/${victimId}`);

      get(victimRef).then(snapshot => {
        if (snapshot.exists()) {
          const currentData = snapshot.val();
          const currentLives = currentData.lives || 3;
          const newLives = Math.max(0, currentLives - damage);

          update(victimRef, { 
            lives: newLives,
            lastHitBy: killerId,
            lastUpdate: serverTimestamp()
          }).catch(err => console.error("Erro ao atualizar vida:", err));
        }
      }).catch(err => console.error("Erro ao buscar vida da vítima:", err));
    };

    game.onStarCollected = () => {
      const q = MathEngine.getInstance().generateQuestion();
      setCurrentQuestion(q);
      setTimeLeft(q.difficulty === 'hard' ? 10 : q.difficulty === 'medium' ? 8 : 6);
      setShowModal(true);
    };

    game.onShoot = (p: Projectile) => {
      AudioManager.getInstance().play('shoot');
      if (roomRef.current && userRef.current) {
        const projectilesRef = ref(db, `rooms/${roomRef.current.id}/projectiles`);
        const newProjRef = push(projectilesRef);
        set(newProjRef, {
          id: newProjRef.key,
          ownerId: p.ownerId || userRef.current.uid,
          ownerType: p.owner,
          pos: { x: Math.round(p.pos.x * 10) / 10, y: Math.round(p.pos.y * 10) / 10 },
          vel: { x: Math.round(p.vel.x * 10) / 10, y: Math.round(p.vel.y * 10) / 10 },
          createdAt: serverTimestamp()
        }).catch(error => handleDatabaseError(error, OperationType.WRITE, `rooms/${roomRef.current!.id}/projectiles/${newProjRef.key}`));

        setTimeout(() => remove(newProjRef).catch(() => {}), 1800);
      }
    };

    game.onGameOver = async () => {
      AudioManager.getInstance().play('death');
      setShowGameOver(true);
      if (game.isMultiplayer && userRef.current && roomRef.current) {
        const playerRef = ref(db, `players/${userRef.current.uid}`);
        const newTrophies = Math.max(0, (playerDataRef.current?.trophies || 0) - 1);
        try {
          await update(playerRef, { trophies: newTrophies });
          setPlayerData({ ...playerDataRef.current, trophies: newTrophies });
          remove(ref(db, `rooms/${roomRef.current.id}/players/${userRef.current.uid}`));
        } catch (error) {
          handleDatabaseError(error, OperationType.UPDATE, `players/${userRef.current.uid}`);
        }
      }
    };

    let multiplayerCleanup: (() => void) | null = null;

    if (roomRef.current) {
      game.isMultiplayer = true;
      game.isHost = roomRef.current.hostId === userRef.current!.uid || 
                    roomRef.current.players?.[0] === userRef.current!.uid;

      // Listen for local player lives
      const myLivesRef = ref(db, `rooms/${roomRef.current.id}/players/${userRef.current!.uid}/lives`);
      const livesUnsubscribe = onValue(myLivesRef, (snapshot) => {
        if (snapshot.exists()) {
          const remoteLives = snapshot.val();
          if (game.player.lives !== remoteLives) {
            game.player.lives = remoteLives;
            if (remoteLives <= 0 && !game.gameOver) {
              game.gameOver = true;
              game.onGameOver?.();
            }
          }
        }
      });

      // Listen for ALL players in the room
      const roomPlayersRef = ref(db, `rooms/${roomRef.current.id}/players`);
      const playersUnsubscribe = onValue(roomPlayersRef, (snapshot) => {
        if (snapshot.exists()) {
          const playersData = snapshot.val();
          for (const uid in playersData) {
            if (uid !== userRef.current!.uid) {
              const data = playersData[uid];
              let remote = game.remotePlayers.get(uid);
              if (!remote) {
                remote = new RemotePlayer(uid, data.nickname || 'Opponent', data.trophies || 0, data.pos?.x || 400, data.pos?.y || 300);
                game.remotePlayers.set(uid, remote);
              }
              remote.updateFromRemote(data);

              if (data.lives <= 0 && !game.gameOver) {
                game.gameOver = true;
                game.paused = true;
                AudioManager.getInstance().play('victory');
                setShowVictory(true);

                const playerRef = ref(db, `players/${userRef.current!.uid}`);
                const newTrophies = (playerDataRef.current?.trophies || 0) + 3;
                update(playerRef, { trophies: newTrophies }).then(() => {
                  setPlayerData({ ...playerDataRef.current, trophies: newTrophies });
                });
              }
            }
          }
          game.remotePlayers.forEach((_, uid) => {
            if (!playersData[uid]) {
              game.remotePlayers.delete(uid);
            }
          });
        }
      });

      // Host updates bots
      let botsUnsubscribe: (() => void) | null = null;
      if (game.isHost) {
        game.onBotUpdate = (bots) => {
          update(ref(db, `rooms/${roomRef.current!.id}/bots`), bots);
        };
      } else {
        const botsRef = ref(db, `rooms/${roomRef.current.id}/bots`);
        botsUnsubscribe = onValue(botsRef, (snapshot) => {
          if (snapshot.exists()) {
            const botsData = snapshot.val();
            if (Array.isArray(botsData)) {
              botsData.forEach((data: any, i: number) => {
                game.updateBotFromRemote(i, data);
              });
            }
          }
        });
      }

      // Listen for remote projectiles
      const projRef = ref(db, `rooms/${roomRef.current.id}/projectiles`);
      const projUnsubscribe = onChildAdded(projRef, (snapshot) => {
        const data = snapshot.val();
        if (data.ownerId !== userRef.current!.uid && data.pos && data.vel) {
          const angle = Math.atan2(data.vel.y, data.vel.x);
          game.projectilePool.spawn(data.pos.x, data.pos.y, angle, data.ownerType || 'remote', data.ownerId);
        }
      });

      multiplayerCleanup = () => {
        livesUnsubscribe();
        playersUnsubscribe();
        projUnsubscribe();
        if (botsUnsubscribe) botsUnsubscribe();
        remove(ref(db, `rooms/${roomRef.current!.id}/players/${userRef.current!.uid}`));
        get(roomPlayersRef).then(snap => {
          if (!snap.exists() || Object.keys(snap.val() || {}).length === 0) {
            remove(ref(db, `rooms/${roomRef.current!.id}`));
          }
        });
      };

      (game as any)._multiplayerCleanup = multiplayerCleanup;
    }

    game.start();

    const handleResize = () => game.resize();
    window.addEventListener('resize', handleResize);

    const statsInterval = setInterval(updateStats, 50);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(statsInterval);
      if (multiplayerCleanup) {
        multiplayerCleanup();
      }
      if ((game as any)._multiplayerCleanup) delete (game as any)._multiplayerCleanup;
      gameRef.current = null;
    };
  }, [gameState]);

  // Reconnection logic
  useEffect(() => {
    const lastRoomId = localStorage.getItem('lastRoomId');
    if (lastRoomId && user && gameState === 'menu') {
      const roomRefLocal = ref(db, `rooms/${lastRoomId}`);
      get(roomRefLocal).then(snapshot => {
        if (snapshot.exists() && snapshot.val().status === 'playing') {
          const myPlayerRef = ref(db, `rooms/${lastRoomId}/players/${user.uid}`);
          get(myPlayerRef).then(pSnap => {
            if (pSnap.exists()) {
              const data = snapshot.val();
              setRoom({ id: lastRoomId, ...data, players: Object.keys(data.players || {}) });
              setGameState('playing');
            } else {
              localStorage.removeItem('lastRoomId');
            }
          });
        } else {
          localStorage.removeItem('lastRoomId');
        }
      });
    }
  }, [user, gameState]);

  const handleStartGame = () => {
    setRoom(null);
    setGameState('playing');
  };

  const handleMultiplayer = async () => {
    if (!user) return;
    setGameState('lobby');
    setMatchmakingStatus('Procurando jogador...');

    const timeoutId = setTimeout(() => {
      setMatchmakingStatus('Nenhum jogador encontrado. Tente novamente.');
      setTimeout(() => {
        setGameState('menu');
        setRoom(null);
      }, 2000);
    }, 15000);

    try {
      const roomsRef = ref(db, 'rooms');
      const roomsQuery = query(roomsRef, orderByChild('status'), equalTo('waiting'));
      const snapshot = await get(roomsQuery);

      let roomFound = false;
      if (snapshot.exists()) {
        const rooms = snapshot.val();
        const sortedRoomIds = Object.keys(rooms).sort((a, b) => rooms[a].createdAt - rooms[b].createdAt);
        
        for (const roomId of sortedRoomIds) {
          const roomData = rooms[roomId];
          const players = roomData.players ? Object.keys(roomData.players) : [];
          
          if (players.length < 2) {
            clearTimeout(timeoutId);
            const playerRef = ref(db, `rooms/${roomId}/players/${user.uid}`);
            await set(playerRef, {
              uid: user.uid,
              nickname,
              trophies: playerData?.trophies || 0,
              lives: 3,
              ammo: 10,
              pos: { x: 400, y: 300 },
              lastUpdate: serverTimestamp()
            });

            onDisconnect(playerRef).remove();

            await update(ref(db, `rooms/${roomId}`), { status: 'playing' });
            
            setRoom({ id: roomId, ...roomData, players: [...players, user.uid], status: 'playing' });
            localStorage.setItem('lastRoomId', roomId);
            setMatchmakingStatus('Conectado!');
            roomFound = true;
            setTimeout(() => setGameState('playing'), 1000);
            break;
          }
        }
      }

      if (!roomFound) {
        const newRoomRef = push(roomsRef);
        const roomId = newRoomRef.key;
        const newRoomData = {
          id: roomId,
          status: 'waiting',
          createdAt: serverTimestamp(),
          hostId: user.uid
        };
        
        await set(newRoomRef, newRoomData);
        
        const playerRef = ref(db, `rooms/${roomId}/players/${user.uid}`);
        await set(playerRef, {
          uid: user.uid,
          nickname,
          trophies: playerData?.trophies || 0,
          lives: 3,
          ammo: 10,
          pos: { x: 100, y: 100 },
          lastUpdate: serverTimestamp()
        });

        onDisconnect(playerRef).remove();
        onDisconnect(newRoomRef).remove();

        setRoom({ ...newRoomData, players: [user.uid] });
        localStorage.setItem('lastRoomId', roomId);
        
        const roomStatusRef = ref(db, `rooms/${roomId}/status`);
        const statusUnsubscribe = onValue(roomStatusRef, (snapshot) => {
          const status = snapshot.val();
          if (status === 'playing') {
            clearTimeout(timeoutId);
            setMatchmakingStatus('Conectado!');
            statusUnsubscribe();
            get(ref(db, `rooms/${roomId}`)).then(snap => {
              const data = snap.val();
              setRoom({ id: roomId, ...data, players: Object.keys(data.players || {}) });
              setTimeout(() => setGameState('playing'), 1000);
            });
          }
        });
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Matchmaking error:", error);
      setMatchmakingStatus('Erro ao conectar');
    }
  };

  const saveSettings = async () => {
    localStorage.setItem('nickname', nickname);
    localStorage.setItem('quality', quality);
    if (gameRef.current) {
      gameRef.current.setQuality(quality);
    }
    if (user) {
      try {
        await update(ref(db, `players/${user.uid}`), { nickname });
      } catch (error) {
        handleDatabaseError(error, OperationType.UPDATE, `players/${user.uid}`);
      }
    }
    setShowSettings(false);
  };

  const handleRestart = async () => {
    if (gameRef.current) {
      gameRef.current.reset();
      setShowGameOver(false);
      updateStats();
      
      if (gameRef.current.isMultiplayer && user && room) {
        setGameState('menu');
      }
    }
  };

  const handleAnswer = (option: number | null) => {
    if (!currentQuestion || !gameRef.current) return;

    const isCorrect = option === currentQuestion.answer;
    const isTimeout = option === null;

    if (isCorrect) {
      setFeedback('correct');
      AudioManager.getInstance().play('correct');
      
      const newParticles = Array.from({ length: 12 }).map((_, i) => ({
        id: `success-${Date.now()}-${i}-${Math.random()}`,
        x: Math.random() * 100 - 50,
        y: Math.random() * 100 - 50,
        color: ['#00f2ff', '#bc13fe', '#22c55e'][Math.floor(Math.random() * 3)]
      }));
      setParticles(newParticles);
      
      const newCombo = combo + 1;
      setCombo(newCombo);
      
      const ammoBonus = 5;
      gameRef.current.player.ammo += ammoBonus;
      
      const ammoParticles = Array.from({ length: 8 }).map((_, i) => ({
        id: `ammo-${Date.now()}-${i}-${Math.random()}`,
        x: Math.random() * 100 - 50,
        y: Math.random() * 100 - 50,
        color: '#ffea00'
      }));
      setParticles(prev => [...prev, ...ammoParticles]);
      
      MathEngine.getInstance().recordPerformance(true, currentQuestion.difficulty);
    } else {
      setFeedback(isTimeout ? 'timeout' : 'wrong');
      AudioManager.getInstance().play('wrong');
      setCombo(0);
      gameRef.current.player.lives -= 1;
      
      MathEngine.getInstance().recordPerformance(false, currentQuestion.difficulty);
    }

    setTimeout(() => {
      setFeedback(null);
      setParticles([]);
      setShowModal(false);
      if (gameRef.current) {
        if (gameRef.current.player.lives <= 0) {
          gameRef.current.gameOver = true;
          setShowGameOver(true);
        } else {
          gameRef.current.paused = false;
        }
      }
      updateStats();
    }, isCorrect ? 1000 : 3000);
  };

  useEffect(() => {
    let timer: any;
    if (showModal && !feedback && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleAnswer(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showModal, feedback, timeLeft]);

  const handleJoystick = (clientX: number, clientY: number) => {
    if (!joystickPos || !gameRef.current) return;

    const dx = clientX - joystickPos.x;
    const dy = clientY - joystickPos.y;
    const maxRadius = 50;

    const mag = Math.sqrt(dx * dx + dy * dy);
    const normalizedX = dx / (mag || 1);
    const normalizedY = dy / (mag || 1);

    const finalMag = Math.min(mag, maxRadius);
    const moveX = normalizedX * finalMag;
    const moveY = normalizedY * finalMag;

    setJoystickHandlePos({ x: moveX, y: moveY });

    const inputX = moveX / maxRadius;
    const inputY = moveY / maxRadius;
    
    if (mag < 10) {
      gameRef.current.setJoystickInput(0, 0);
    } else {
      gameRef.current.setJoystickInput(inputX, inputY);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (gameRef.current && !showModal && gameState === 'playing') {
      gameRef.current.setShooting(true, e.clientX, e.clientY);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (gameRef.current && gameState === 'playing') {
      gameRef.current.updateMousePos(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = () => {
    if (gameRef.current) {
      gameRef.current.setShooting(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (showModal || gameState !== 'playing') return;
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const isLeftHalf = touch.clientX < window.innerWidth / 2;

      if (isLeftHalf && !joystickActive) {
        setJoystickPos({ x: touch.clientX, y: touch.clientY });
        setJoystickActive(true);
        setJoystickHandlePos({ x: 0, y: 0 });
      } else if (!isLeftHalf) {
        if (gameRef.current) {
          gameRef.current.updateMousePos(touch.clientX, touch.clientY);
        }
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (gameState !== 'playing') return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      
      if (joystickActive && joystickPos && touch.clientX < window.innerWidth / 2) {
        handleJoystick(touch.clientX, touch.clientY);
      } else if (touch.clientX >= window.innerWidth / 2) {
        if (gameRef.current) {
          gameRef.current.updateMousePos(touch.clientX, touch.clientY);
        }
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      
      if (joystickActive && joystickPos && touch.clientX < window.innerWidth / 2) {
        setJoystickActive(false);
        setJoystickPos(null);
        setJoystickHandlePos({ x: 0, y: 0 });
        if (gameRef.current) gameRef.current.setJoystickInput(0, 0);
      }
    }

    if (e.touches.length === 0) {
      setJoystickActive(false);
      setJoystickPos(null);
      setJoystickHandlePos({ x: 0, y: 0 });
      if (gameRef.current) {
        gameRef.current.setJoystickInput(0, 0);
      }
    }
  };

  return (
    <ErrorBoundary>
      <div 
        id="game-container"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
      <AnimatePresence>
        {gameState === 'menu' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#050505] overflow-hidden"
          >
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <div className="w-full h-full" style={{ 
                backgroundImage: 'linear-gradient(rgba(0, 242, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 242, 255, 0.1) 1px, transparent 1px)',
                backgroundSize: '50px 50px'
              }} />
            </div>

            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="relative z-10 text-center mb-16"
            >
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/5 p-2 px-4 rounded-full border border-white/10 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-[#ffea00]" />
                  <span className="text-xs font-bold text-white uppercase tracking-widest">{nickname}</span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#00f2ff]" />
                  <span className="text-xs font-bold text-[#00f2ff]">{playerData?.trophies || 0}</span>
                </div>
              </div>

              <h1 className="text-7xl md:text-9xl font-black uppercase tracking-tighter text-white italic">
                TRYHARD<br/>
                <span className="text-[#bc13fe] drop-shadow-[0_0_20px_rgba(188,19,254,0.8)]">ACADEMY</span>
              </h1>
              <p className="text-[#00f2ff] tracking-[0.5em] uppercase text-sm mt-4 font-bold opacity-80">The Ultimate Math Arena</p>
            </motion.div>

            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col gap-4 w-full max-w-xs relative z-10"
            >
              {!user ? (
                <button
                  onClick={handleLogin}
                  className="group relative p-4 bg-white text-black rounded-xl font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                >
                  Entrar com Google
                </button>
              ) : (
                <>
                  <button
                    onClick={handleStartGame}
                    className="group relative p-4 bg-[#bc13fe] hover:bg-[#d042ff] text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(188,19,254,0.4)] hover:scale-105 active:scale-95"
                  >
                    Jogar Offline
                    <div className="absolute inset-0 rounded-xl border-2 border-white/20 group-hover:border-white/40 transition-colors" />
                  </button>

                  <button
                    onClick={handleMultiplayer}
                    className="group relative p-4 bg-[#00f2ff] hover:bg-[#42f2ff] text-black rounded-xl font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(0,242,255,0.3)] hover:scale-105 active:scale-95"
                  >
                    Multiplayer Online
                    <div className="absolute inset-0 rounded-xl border-2 border-black/10" />
                  </button>
                </>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setShowLeaderboard(true)}
                  className="flex-1 p-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <Trophy className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Ranking</span>
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex-1 p-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Ajustes</span>
                </button>
                <button
                  onClick={() => setSoundEnabled(AudioManager.getInstance().toggle())}
                  className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all flex items-center justify-center"
                  title={soundEnabled ? 'Som Ligado' : 'Som Desligado'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 1 }}
              className="absolute bottom-8 text-[10px] text-white uppercase tracking-[0.3em]"
            >
              © 2026 TRYHARD STUDIOS • ALPHA ACCESS
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {gameState === 'playing' && (
        <>
          <div className="ui-overlay flex flex-col gap-4">
            <div>
              <h1 className="text-2xl">Tryhard Academy</h1>
              <p className="text-xs opacity-50">Arena Alpha v0.2</p>
            </div>
            
            <div className="flex gap-6 items-center bg-black/40 p-3 rounded-xl border border-white/10 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                <span className="text-xl font-mono">{stats.lives}</span>
              </div>
              <div className={`flex items-center gap-2 transition-all ${stats.ammo === 0 ? 'text-red-500 animate-pulse scale-110' : ''}`}>
                <Zap className={`w-5 h-5 ${stats.ammo === 0 ? 'text-red-500 fill-red-500' : 'text-yellow-400 fill-yellow-400'}`} />
                <span className="text-xl font-mono">{stats.ammo}</span>
                {stats.ammo === 0 && <span className="text-[8px] font-black uppercase tracking-tighter ml-1">Sem Munição</span>}
              </div>
              <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                <span className="text-[10px] uppercase tracking-[0.2em] opacity-40 font-bold">Eliminações</span>
                <span className="text-2xl font-mono text-[#00f2ff] drop-shadow-[0_0_8px_rgba(0,242,255,0.5)]">{stats.kills}</span>
              </div>

              <button 
                onClick={() => setSoundEnabled(AudioManager.getInstance().toggle())}
                className="p-2 bg-black/40 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all"
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <canvas ref={canvasRef} />

          {isTouch && (
            <>
              {joystickActive && joystickPos && (
                <div 
                  className="fixed pointer-events-none z-[150]"
                  style={{ 
                    left: joystickPos.x, 
                    top: joystickPos.y,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <div className="w-24 h-24 rounded-full border-2 border-white/20 bg-white/5 backdrop-blur-sm flex items-center justify-center">
                    <motion.div 
                      className="w-10 h-10 rounded-full bg-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.5)]"
                      animate={{ x: joystickHandlePos.x, y: joystickHandlePos.y }}
                      transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                    />
                  </div>
                </div>
              )}

              <div 
                className="fixed bottom-12 right-12 z-[150] pointer-events-auto"
                onTouchStart={(e) => {
                  e.preventDefault();
                  setIsShootingMobile(true);
                  if (gameRef.current) gameRef.current.setShooting(true);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  setIsShootingMobile(false);
                  if (gameRef.current) gameRef.current.setShooting(false);
                }}
                onTouchCancel={(e) => {
                  e.preventDefault();
                  setIsShootingMobile(false);
                  if (gameRef.current) gameRef.current.setShooting(false);
                }}
              >
                <motion.div 
                  className={`w-28 h-28 rounded-full border-4 flex items-center justify-center transition-all ${
                    isShootingMobile ? 'bg-[#bc13fe] border-white scale-110 shadow-[0_0_30px_rgba(188,19,254,0.6)]' : 'bg-[#bc13fe]/20 border-[#bc13fe] scale-100'
                  }`}
                  animate={{ scale: isShootingMobile ? 1.1 : 1 }}
                >
                  <Zap className={`w-12 h-12 ${isShootingMobile ? 'text-white' : 'text-[#bc13fe]'}`} />
                </motion.div>
                <div className="text-[10px] text-center mt-2 font-black uppercase tracking-widest text-[#bc13fe] opacity-50">Ataque</div>
              </div>
            </>
          )}
        </>
      )}

      {/* Todo o resto da UI (lobby, settings, leaderboard, victory, gameover, modal) permanece exatamente igual */}
      <AnimatePresence>
        {gameState === 'lobby' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-[#050505]/95 backdrop-blur-xl"
          >
            <div className="relative">
              <div className="w-24 h-24 border-4 border-[#00f2ff]/20 border-t-[#00f2ff] rounded-full animate-spin" />
              <Users className="absolute inset-0 m-auto w-8 h-8 text-[#00f2ff] animate-pulse" />
            </div>
            <h2 className="mt-8 text-2xl font-black uppercase tracking-widest text-white">{matchmakingStatus}</h2>
            <p className="mt-2 text-white/40 text-xs uppercase tracking-[0.3em]">Preparando sua arena...</p>
            
            <button 
              onClick={() => setGameState('menu')}
              className="mt-12 text-white/30 hover:text-white text-[10px] uppercase tracking-widest border border-white/10 p-2 px-6 rounded-full transition-all"
            >
              Cancelar
            </button>
          </motion.div>
        )}

        {/* ... (todo o resto do return permanece idêntico ao que você enviou) ... */}

        {showModal && currentQuestion && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          >
            {/* ... todo o conteúdo do modal permanece exatamente igual ... */}
          </motion.div>
        )}
      </AnimatePresence>

      {isTouch && (
        <div className="fixed inset-0 z-[140] pointer-events-none" />
      )}
      </div>
    </ErrorBoundary>
  );
}