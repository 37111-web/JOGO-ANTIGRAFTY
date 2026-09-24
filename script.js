/**
 * ============================================================================
 * FUGA DAS SOMBRAS - MOTOR PRINCIPAL DO JOGO (VANILLA JAVASCRIPT)
 * ============================================================================
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. GERENCIADOR DE ÁUDIO PROCEDURAL (WEB AUDIO API)
     ========================================================================== */
  class SoundFX {
    constructor() {
      this.ctx = null;
      this.isMuted = false;
      this.ambientGain = null;
      this.droneOsc1 = null;
      this.droneOsc2 = null;
      this.heartbeatTimer = null;
      this.heartbeatBpm = 60;
      this.isHeartbeatPlaying = false;
      this.lastStepTime = 0;
    }

    init() {
      if (this.ctx) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
        this.startAmbientDrone();
      } catch (e) {
        console.warn('Web Audio API não suportada neste navegador.', e);
      }
    }

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggleMute() {
      this.isMuted = !this.isMuted;
      if (this.ambientGain) {
        this.ambientGain.gain.setValueAtTime(this.isMuted ? 0 : 0.08, this.ctx.currentTime);
      }
      return this.isMuted;
    }

    startAmbientDrone() {
      if (!this.ctx || this.ambientGain) return;
      try {
        const now = this.ctx.currentTime;
        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.setValueAtTime(this.isMuted ? 0 : 0.08, now);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(140, now);

        this.droneOsc1 = this.ctx.createOscillator();
        this.droneOsc1.type = 'sawtooth';
        this.droneOsc1.frequency.setValueAtTime(55, now); // Nota A1

        this.droneOsc2 = this.ctx.createOscillator();
        this.droneOsc2.type = 'triangle';
        this.droneOsc2.frequency.setValueAtTime(58.5, now); // Batimento sutil

        this.droneOsc1.connect(filter);
        this.droneOsc2.connect(filter);
        filter.connect(this.ambientGain);
        this.ambientGain.connect(this.ctx.destination);

        this.droneOsc1.start();
        this.droneOsc2.start();
      } catch (err) {
        console.warn('Erro ao iniciar drone ambiente:', err);
      }
    }

    playFootstep() {
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      if (now - this.lastStepTime < 0.22) return;
      this.lastStepTime = now;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(80 + Math.random() * 30, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(250, now);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    }

    playHeartbeat(volume = 0.25) {
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      const playThump = (offset, freq, vol) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + offset);
        osc.frequency.exponentialRampToValueAtTime(28, now + offset + 0.12);

        gain.gain.setValueAtTime(vol, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + offset);
        osc.stop(now + offset + 0.15);
      };

      // Lub-dub (dois batimentos cardíacos)
      playThump(0, 65, volume);
      playThump(0.12, 55, volume * 0.7);
    }

    updateHeartbeat(distanceRatio) {
      // distanceRatio: 0 = muito perto, 1 = longe
      if (!this.ctx || this.isMuted) return;
      if (distanceRatio < 0.45) {
        // Monstro muito próximo
        const targetBpm = 60 + Math.floor((1 - distanceRatio / 0.45) * 110); // 60 a 170 BPM
        this.heartbeatBpm = targetBpm;
        if (!this.isHeartbeatPlaying) {
          this.isHeartbeatPlaying = true;
          this.triggerHeartbeatLoop();
        }
      } else {
        this.isHeartbeatPlaying = false;
        if (this.heartbeatTimer) {
          clearTimeout(this.heartbeatTimer);
          this.heartbeatTimer = null;
        }
      }
    }

    triggerHeartbeatLoop() {
      if (!this.isHeartbeatPlaying) return;
      const vol = Math.min(0.4, 0.12 + (this.heartbeatBpm - 60) / 110 * 0.28);
      this.playHeartbeat(vol);
      const intervalMs = (60 / this.heartbeatBpm) * 1000;
      this.heartbeatTimer = setTimeout(() => {
        this.triggerHeartbeatLoop();
      }, intervalMs);
    }

    playAlertSting() {
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.linearRampToValueAtTime(440, now + 0.35);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    }

    playItemPickup() {
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + idx * 0.06;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.22);
      });
    }

    playUnlockDoor() {
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.5);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.65);
    }

    playSmokeHiss() {
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 1.5;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.Q.setValueAtTime(2.5, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
    }

    playClueSound() {
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(659.25, now + 0.25);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    }

    playVictory() {
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      const chords = [
        { freq: 440, delay: 0 },
        { freq: 554.37, delay: 0.12 },
        { freq: 659.25, delay: 0.24 },
        { freq: 880, delay: 0.36 }
      ];
      chords.forEach(c => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(c.freq, now + c.delay);
        gain.gain.setValueAtTime(0.2, now + c.delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + c.delay + 1.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + c.delay);
        osc.stop(now + c.delay + 1.25);
      });
    }

    playDefeat() {
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 1.2);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 1.45);
    }

    stopAll() {
      this.isHeartbeatPlaying = false;
      if (this.heartbeatTimer) {
        clearTimeout(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
    }
  }

  /* ==========================================================================
     2. GERADOR PROCEDURAL DE LABIRINTO COM LOOPS DE FUGA
     ========================================================================== */
  class MazeGenerator {
    static generate(cols, rows) {
      // Cria grid preenchido com paredes (1)
      const grid = Array.from({ length: rows }, () => Array(cols).fill(1));

      // Algoritmo de DFS recursivo com pilha
      const stack = [];
      const startX = 1;
      const startY = 1;
      grid[startY][startX] = 0;
      stack.push({ x: startX, y: startY });

      while (stack.length > 0) {
        const current = stack[stack.length - 1];
        const neighbors = [];

        const directions = [
          { dx: 0, dy: -2 },
          { dx: 2, dy: 0 },
          { dx: 0, dy: 2 },
          { dx: -2, dy: 0 }
        ];

        for (const dir of directions) {
          const nx = current.x + dir.dx;
          const ny = current.y + dir.dy;
          if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && grid[ny][nx] === 1) {
            neighbors.push({ x: nx, y: ny, wallX: current.x + dir.dx / 2, wallY: current.y + dir.dy / 2 });
          }
        }

        if (neighbors.length > 0) {
          const chosen = neighbors[Math.floor(Math.random() * neighbors.length)];
          grid[chosen.wallY][chosen.wallX] = 0;
          grid[chosen.y][chosen.x] = 0;
          stack.push({ x: chosen.x, y: chosen.y });
        } else {
          stack.pop();
        }
      }

      // "Braiding": Remove paredes de ~20% dos becos sem saída para criar loops e caminhos alternativos
      for (let y = 1; y < rows - 1; y += 2) {
        for (let x = 1; x < cols - 1; x += 2) {
          if (grid[y][x] === 0) {
            let openNeighbors = 0;
            const wallsAround = [];
            if (grid[y - 1][x] === 0) openNeighbors++; else if (y - 1 > 0) wallsAround.push({ x, y: y - 1 });
            if (grid[y + 1][x] === 0) openNeighbors++; else if (y + 1 < rows - 1) wallsAround.push({ x, y: y + 1 });
            if (grid[y][x - 1] === 0) openNeighbors++; else if (x - 1 > 0) wallsAround.push({ x: x - 1, y });
            if (grid[y][x + 1] === 0) openNeighbors++; else if (x + 1 < cols - 1) wallsAround.push({ x: x + 1, y });

            // Se é um beco sem saída (apenas 1 vizinho aberto)
            if (openNeighbors === 1 && wallsAround.length > 0 && Math.random() < 0.25) {
              const wall = wallsAround[Math.floor(Math.random() * wallsAround.length)];
              grid[wall.y][wall.x] = 0;
            }
          }
        }
      }

      return grid;
    }

    // BFS para calcular distâncias a partir de um ponto
    static calculateDistances(grid, startX, startY) {
      const rows = grid.length;
      const cols = grid[0].length;
      const dist = Array.from({ length: rows }, () => Array(cols).fill(-1));
      const queue = [{ x: startX, y: startY }];
      dist[startY][startX] = 0;

      while (queue.length > 0) {
        const { x, y } = queue.shift();
        const neighbors = [
          { x: x + 1, y }, { x: x - 1, y },
          { x, y: y + 1 }, { x, y: y - 1 }
        ];

        for (const n of neighbors) {
          if (n.x >= 0 && n.x < cols && n.y >= 0 && n.y < rows) {
            if (grid[n.y][n.x] === 0 && dist[n.y][n.x] === -1) {
              dist[n.y][n.x] = dist[y][x] + 1;
              queue.push(n);
            }
          }
        }
      }
      return dist;
    }
  }

  /* ==========================================================================
     3. ALGORITMO DE BUSCA DE CAMINHO A* (A-STAR)
     ========================================================================== */
  class Pathfinding {
    static findPath(grid, start, target) {
      const cols = grid[0].length;
      const rows = grid.length;

      if (start.x === target.x && start.y === target.y) return [];
      if (grid[target.y][target.x] === 1) return [];

      const openSet = [];
      const closedSet = new Set();
      const nodeMap = new Map();

      const key = (x, y) => `${x},${y}`;

      const startNode = {
        x: start.x,
        y: start.y,
        g: 0,
        h: Math.abs(start.x - target.x) + Math.abs(start.y - target.y),
        f: 0,
        parent: null
      };
      startNode.f = startNode.g + startNode.h;

      openSet.push(startNode);
      nodeMap.set(key(start.x, start.y), startNode);

      let iterations = 0;
      const maxIterations = 3000; // Suporta mapas ampliados mantendo alta performance

      while (openSet.length > 0 && iterations++ < maxIterations) {
        // Encontra o nó com menor f
        let lowestIndex = 0;
        for (let i = 1; i < openSet.length; i++) {
          if (openSet[i].f < openSet[lowestIndex].f) lowestIndex = i;
        }

        const current = openSet.splice(lowestIndex, 1)[0];
        const currentKey = key(current.x, current.y);

        if (current.x === target.x && current.y === target.y) {
          // Reconstrói caminho
          const path = [];
          let temp = current;
          while (temp.parent) {
            path.push({ x: temp.x, y: temp.y });
            temp = temp.parent;
          }
          return path.reverse();
        }

        closedSet.add(currentKey);

        const neighbors = [
          { x: current.x, y: current.y - 1 },
          { x: current.x + 1, y: current.y },
          { x: current.x, y: current.y + 1 },
          { x: current.x - 1, y: current.y }
        ];

        for (const n of neighbors) {
          if (n.x < 0 || n.x >= cols || n.y < 0 || n.y >= rows) continue;
          if (grid[n.y][n.x] === 1) continue;
          const nKey = key(n.x, n.y);
          if (closedSet.has(nKey)) continue;

          const tentativeG = current.g + 1;
          let neighborNode = nodeMap.get(nKey);

          if (!neighborNode) {
            neighborNode = {
              x: n.x,
              y: n.y,
              g: tentativeG,
              h: Math.abs(n.x - target.x) + Math.abs(n.y - target.y),
              f: 0,
              parent: current
            };
            neighborNode.f = neighborNode.g + neighborNode.h;
            nodeMap.set(nKey, neighborNode);
            openSet.push(neighborNode);
          } else if (tentativeG < neighborNode.g) {
            neighborNode.g = tentativeG;
            neighborNode.f = neighborNode.g + neighborNode.h;
            neighborNode.parent = current;
          }
        }
      }
      return [];
    }
  }

  /* ==========================================================================
     4. CLASSE PRINCIPAL DO JOGO (GAME ENGINE)
     ========================================================================== */
  class ShadowEscapeGame {
    constructor() {
      // Canvas e Contextos
      this.canvas = document.getElementById('gameCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.minimapCanvas = document.getElementById('minimapCanvas');
      this.miniCtx = this.minimapCanvas.getContext('2d');

      // Sistema de Áudio
      this.audio = new SoundFX();

      // Configurações do Labirinto
      this.tileSize = 48;
      this.cols = 47;
      this.rows = 47;
      this.grid = [];
      this.difficulty = 'normal';

      // Estado do Jogo: 'menu' | 'playing' | 'victory' | 'gameover'
      this.gameState = 'menu';
      this.isPaused = false;
      this.isMinimapOpen = false;

      // Câmera do Jogo
      this.camera = { x: 0, y: 0, targetX: 0, targetY: 0 };

      // Jogador
      this.player = {
        x: 0,
        y: 0,
        radius: 13,
        collisionRadius: 10,
        speedWalk: 175,
        speedSprint: 275,
        currentSpeed: 175,
        vx: 0,
        vy: 0,
        angle: 0,
        health: 100,
        maxHealth: 100,
        stamina: 100,
        maxStamina: 100,
        isSprinting: false,
        isExhausted: false,
        isHiding: false,
        isMoving: false,
        currentHidingSpot: null,
        walkAnimTimer: 0,
        idleTimer: 0,
        distanceTraveled: 0
      };

      // Perseguidor (Stalker)
      this.stalker = {
        x: 0,
        y: 0,
        radius: 18,
        speed: 160,
        baseSpeed: 160,
        rageSpeed: 210,
        path: [],
        pathIndex: 0,
        pathUpdateTimer: 0,
        state: 'patrol', // 'patrol' | 'chase' | 'confused' | 'blinded'
        confusedTimer: 0,
        blindedTimer: 0,
        lastKnownPlayerPos: { x: 0, y: 0 },
        animPulse: 0
      };

      // Entidades do Labirinto
      this.exitDoor = { x: 0, y: 0, radius: 20, isUnlocked: false };
      this.keyItem = { x: 0, y: 0, collected: false, radius: 14 };
      this.items = [];       // { type, x, y, collected, radius }
      this.hidingSpots = []; // { x, y, width, height, occupied }
      this.clues = [];       // { x, y, text, read: false, radius: 16 }
      this.smokeClouds = []; // { x, y, radius, timer, maxDuration }
      this.particles = [];   // Partículas visuais de poeira e aura

      // Inventário e Buffs do Jogador
      this.inventory = {
        hasKey: false,
        smokeBombs: 1,
        buffs: {
          speed: 0,       // segundos restantes
          flashlight: 0,  // segundos restantes
          compass: 0      // segundos restantes
        }
      };

      // Estatísticas da Partida
      this.stats = {
        startTime: 0,
        elapsedTime: 0,
        itemsCollected: 0,
        cluesRead: 0,
        bestTime: localStorage.getItem('fuga_sombras_best_time') || null
      };

      // Controles e Entradas
      this.keys = {};
      this.touchJoy = { active: false, startX: 0, startY: 0, moveX: 0, moveY: 0, normX: 0, normY: 0 };

      // Elementos do DOM
      this.dom = {
        wrapper: document.getElementById('gameWrapper'),
        hud: document.getElementById('hud'),
        menuScreen: document.getElementById('menuScreen'),
        victoryScreen: document.getElementById('victoryScreen'),
        gameOverScreen: document.getElementById('gameOverScreen'),
        minimapContainer: document.getElementById('minimapContainer'),
        clueToast: document.getElementById('clueToast'),
        clueMessage: document.getElementById('clueMessage'),
        dangerOverlay: document.getElementById('dangerOverlay'),
        hidingDarkness: document.getElementById('hidingDarkness'),
        smokeOverlay: document.getElementById('smokeOverlay'),
        dangerAlert: document.getElementById('dangerAlert'),
        idleWarning: document.getElementById('idleWarning'),
        hidingAlert: document.getElementById('hidingAlert'),
        interactionPrompt: document.getElementById('interactionPrompt'),
        promptText: document.getElementById('promptText'),
        healthFill: document.getElementById('healthFill'),
        healthValue: document.getElementById('healthValue'),
        staminaFill: document.getElementById('staminaFill'),
        staminaValue: document.getElementById('staminaValue'),
        gameTimer: document.getElementById('gameTimer'),
        objectiveText: document.getElementById('objectiveText'),
        keyStatus: document.getElementById('keyStatus'),
        smokeCount: document.getElementById('smokeCount'),
        flashlightStatus: document.getElementById('flashlightStatus'),
        compassStatus: document.getElementById('compassStatus'),
        buffSpeed: document.getElementById('buffSpeed'),
        buffSpeedTimer: document.getElementById('buffSpeedTimer'),
        buffFlashlight: document.getElementById('buffFlashlight'),
        buffFlashlightTimer: document.getElementById('buffFlashlightTimer'),
        buffCompass: document.getElementById('buffCompass'),
        buffCompassTimer: document.getElementById('buffCompassTimer'),
        buffHidden: document.getElementById('buffHidden'),
        bestTimeDisplay: document.getElementById('bestTimeDisplay'),
        btnAudioToggle: document.getElementById('btnAudioToggle'),
        btnMinimapToggle: document.getElementById('btnMinimapToggle'),
        btnCloseMinimap: document.getElementById('btnCloseMinimap'),
        btnCloseClue: document.getElementById('btnCloseClue'),
        btnStartGame: document.getElementById('btnStartGame'),
        btnPlayAgain: document.getElementById('btnPlayAgain'),
        btnRetryGame: document.getElementById('btnRetryGame'),
        mobileControls: document.getElementById('mobileControls'),
        joystickZone: document.getElementById('touchJoystickZone'),
        joystickStick: document.getElementById('joystickStick'),
        btnMobileSprint: document.getElementById('btnMobileSprint'),
        btnMobileInteract: document.getElementById('btnMobileInteract'),
        btnMobileSmoke: document.getElementById('btnMobileSmoke')
      };

      // Inicialização
      this.initEvents();
      this.resizeCanvas();
      this.updateRecordsUI();

      // Loop do Jogo
      this.lastTime = performance.now();
      requestAnimationFrame(this.gameLoop.bind(this));
    }

    /* ========================================================================
       CONFIGURAÇÃO DE EVENTOS E CONTROLES
       ======================================================================== */
    initEvents() {
      window.addEventListener('resize', () => this.resizeCanvas());

      // Teclado
      window.addEventListener('keydown', (e) => {
        this.keys[e.key.toLowerCase()] = true;
        this.audio.resume();

        // Se estiver na tela de vitória ou derrota, qualquer tecla de confirmação volta ao menu
        if (this.gameState === 'victory' || this.gameState === 'gameover') {
          if (e.code === 'Space' || e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            this.returnToMenu();
            return;
          }
        }

        if (e.key === 'Shift') this.player.isSprinting = true;
        if (e.key.toLowerCase() === 'e') this.handleInteraction();
        if (e.code === 'Space') {
          e.preventDefault();
          this.useSmokeBomb();
        }
        if (e.key.toLowerCase() === 'm') this.toggleMinimap();
      });

      window.addEventListener('keyup', (e) => {
        this.keys[e.key.toLowerCase()] = false;
        if (e.key === 'Shift') this.player.isSprinting = false;
      });

      // Botões de Menu e HUD
      this.dom.btnStartGame.addEventListener('click', () => {
        this.audio.init();
        this.audio.resume();
        this.startNewGame();
      });

      this.dom.btnPlayAgain.addEventListener('click', () => {
        this.returnToMenu();
      });

      this.dom.btnRetryGame.addEventListener('click', () => {
        this.returnToMenu();
      });

      this.dom.btnAudioToggle.addEventListener('click', () => {
        const muted = this.audio.toggleMute();
        this.dom.btnAudioToggle.textContent = muted ? '🔇' : '🔊';
      });

      this.dom.btnMinimapToggle.addEventListener('click', () => this.toggleMinimap());
      this.dom.btnCloseMinimap.addEventListener('click', () => this.toggleMinimap(false));
      this.dom.btnCloseClue.addEventListener('click', () => this.dom.clueToast.classList.add('hidden'));

      // Seletor de Dificuldade
      document.querySelectorAll('.btn-diff').forEach(btn => {
        btn.addEventListener('click', (e) => {
          document.querySelectorAll('.btn-diff').forEach(b => b.classList.remove('active'));
          const target = e.currentTarget;
          target.classList.add('active');
          this.difficulty = target.dataset.difficulty;
        });
      });

      // Controles Virtuais Touch (Mobile/Tablet)
      this.initTouchControls();
    }

    initTouchControls() {
      const zone = this.dom.joystickZone;
      const stick = this.dom.joystickStick;
      const maxDist = 45;

      const handleTouchStart = (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = zone.getBoundingClientRect();
        this.touchJoy.active = true;
        this.touchJoy.startX = rect.left + rect.width / 2;
        this.touchJoy.startY = rect.top + rect.height / 2;
        this.audio.resume();
      };

      const handleTouchMove = (e) => {
        if (!this.touchJoy.active) return;
        e.preventDefault();
        const touch = e.touches[0];
        const dx = touch.clientX - this.touchJoy.startX;
        const dy = touch.clientY - this.touchJoy.startY;
        const dist = Math.min(Math.hypot(dx, dy), maxDist);
        const angle = Math.atan2(dy, dx);

        const moveX = Math.cos(angle) * dist;
        const moveY = Math.sin(angle) * dist;

        stick.style.transform = `translate(${moveX}px, ${moveY}px)`;
        this.touchJoy.normX = moveX / maxDist;
        this.touchJoy.normY = moveY / maxDist;
      };

      const handleTouchEnd = (e) => {
        this.touchJoy.active = false;
        this.touchJoy.normX = 0;
        this.touchJoy.normY = 0;
        stick.style.transform = `translate(0, 0)`;
      };

      zone.addEventListener('touchstart', handleTouchStart, { passive: false });
      zone.addEventListener('touchmove', handleTouchMove, { passive: false });
      zone.addEventListener('touchend', handleTouchEnd);
      zone.addEventListener('touchcancel', handleTouchEnd);

      // Botões mobile (Touch + Click para emuladores e híbridos)
      const toggleSprint = (e) => {
        if (e) e.preventDefault();
        this.player.isSprinting = !this.player.isSprinting;
        this.dom.btnMobileSprint.classList.toggle('active', this.player.isSprinting);
      };
      this.dom.btnMobileSprint.addEventListener('touchstart', toggleSprint);
      this.dom.btnMobileSprint.addEventListener('click', toggleSprint);

      const doInteract = (e) => {
        if (e) e.preventDefault();
        this.handleInteraction();
      };
      this.dom.btnMobileInteract.addEventListener('touchstart', doInteract);
      this.dom.btnMobileInteract.addEventListener('click', doInteract);

      const doSmoke = (e) => {
        if (e) e.preventDefault();
        this.useSmokeBomb();
      };
      this.dom.btnMobileSmoke.addEventListener('touchstart', doSmoke);
      this.dom.btnMobileSmoke.addEventListener('click', doSmoke);

      // Detecção de toque para exibir controles virtuais
      if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        this.dom.mobileControls.classList.remove('hidden');
      }
    }

    resizeCanvas() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.ctx.imageSmoothingEnabled = false;
    }

    updateRecordsUI() {
      if (this.stats.bestTime) {
        const mins = Math.floor(this.stats.bestTime / 60).toString().padStart(2, '0');
        const secs = (this.stats.bestTime % 60).toString().padStart(2, '0');
        this.dom.bestTimeDisplay.textContent = `${mins}:${secs}`;
      } else {
        this.dom.bestTimeDisplay.textContent = '--:--';
      }
    }

    toggleMinimap(forceState) {
      if (typeof forceState === 'boolean') {
        this.isMinimapOpen = forceState;
      } else {
        this.isMinimapOpen = !this.isMinimapOpen;
      }
      this.dom.minimapContainer.classList.toggle('hidden', !this.isMinimapOpen);
      if (this.isMinimapOpen) this.renderMinimap();
    }

    /* ========================================================================
       INÍCIO DE UMA NOVA PARTIDA
       ======================================================================== */
    startNewGame() {
      // Ajusta parâmetros de acordo com a dificuldade (mapa ampliado)
      if (this.difficulty === 'easy') {
        this.cols = 37;
        this.rows = 37;
        this.stalker.baseSpeed = 120;
      } else if (this.difficulty === 'hard') {
        this.cols = 57;
        this.rows = 57;
        this.stalker.baseSpeed = 185;
      } else {
        this.cols = 47;
        this.rows = 47;
        this.stalker.baseSpeed = 155;
      }
      this.stalker.speed = this.stalker.baseSpeed;

      // Gera o labirinto
      this.grid = MazeGenerator.generate(this.cols, this.rows);

      // Posiciona Jogador no início (1, 1)
      this.player.x = 1.5 * this.tileSize;
      this.player.y = 1.5 * this.tileSize;
      this.player.health = 100;
      this.player.stamina = 100;
      this.player.isHiding = false;
      this.player.isExhausted = false;
      this.player.isMoving = false;
      this.player.idleTimer = 0;
      this.player.distanceTraveled = 0;

      // Reseta inventário e buffs
      this.inventory = {
        hasKey: false,
        smokeBombs: this.difficulty === 'hard' ? 1 : 2,
        buffs: { speed: 0, flashlight: 0, compass: 0 }
      };

      // Reseta estatísticas
      this.stats.startTime = performance.now();
      this.stats.elapsedTime = 0;
      this.stats.itemsCollected = 0;
      this.stats.cluesRead = 0;

      // Encontra ponto mais distante para a Saída (usando BFS)
      const dists = MazeGenerator.calculateDistances(this.grid, 1, 1);
      let maxDist = -1;
      let exitTile = { x: this.cols - 2, y: this.rows - 2 };

      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          if (dists[y][x] > maxDist) {
            maxDist = dists[y][x];
            exitTile = { x, y };
          }
        }
      }

      this.exitDoor = {
        x: (exitTile.x + 0.5) * this.tileSize,
        y: (exitTile.y + 0.5) * this.tileSize,
        tileX: exitTile.x,
        tileY: exitTile.y,
        radius: 20,
        isUnlocked: false
      };

      // Posiciona o Perseguidor (Stalker) perto da saída ou canto oposto
      this.stalker.x = (exitTile.x + 0.5) * this.tileSize;
      this.stalker.y = (exitTile.y + 0.5) * this.tileSize;
      this.stalker.state = 'patrol';
      this.stalker.path = [];
      this.stalker.confusedTimer = 0;
      this.stalker.blindedTimer = 0;

      // Posiciona a Chave em um ponto intermediário distante
      let keyCandidates = [];
      for (let y = 1; y < this.rows - 1; y++) {
        for (let x = 1; x < this.cols - 1; x++) {
          if (this.grid[y][x] === 0 && dists[y][x] > maxDist * 0.45 && dists[y][x] < maxDist * 0.85) {
            keyCandidates.push({ x, y });
          }
        }
      }
      const chosenKey = keyCandidates[Math.floor(Math.random() * keyCandidates.length)] || { x: this.cols - 2, y: 1 };
      this.keyItem = {
        x: (chosenKey.x + 0.5) * this.tileSize,
        y: (chosenKey.y + 0.5) * this.tileSize,
        tileX: chosenKey.x,
        tileY: chosenKey.y,
        collected: false,
        radius: 14
      };

      // Distribui Esconderijos (Armários)
      this.hidingSpots = [];
      const numHiding = this.difficulty === 'easy' ? 16 : (this.difficulty === 'hard' ? 8 : 12);
      let freeTiles = [];
      for (let y = 1; y < this.rows - 1; y++) {
        for (let x = 1; x < this.cols - 1; x++) {
          if (this.grid[y][x] === 0 && (x !== 1 || y !== 1) && (x !== exitTile.x || y !== exitTile.y)) {
            freeTiles.push({ x, y });
          }
        }
      }
      freeTiles.sort(() => Math.random() - 0.5);

      for (let i = 0; i < Math.min(numHiding, freeTiles.length); i++) {
        const t = freeTiles.pop();
        this.hidingSpots.push({
          x: (t.x + 0.5) * this.tileSize,
          y: (t.y + 0.5) * this.tileSize,
          width: 32,
          height: 32,
          occupied: false
        });
      }

      // Distribui Itens pelo Labirinto
      this.items = [];
      const itemTypes = ['flashlight', 'energy', 'medkit', 'compass', 'smoke'];
      const totalItems = this.difficulty === 'easy' ? 24 : (this.difficulty === 'hard' ? 12 : 18);

      for (let i = 0; i < Math.min(totalItems, freeTiles.length); i++) {
        const t = freeTiles.pop();
        const type = itemTypes[i % itemTypes.length];
        this.items.push({
          type,
          x: (t.x + 0.5) * this.tileSize,
          y: (t.y + 0.5) * this.tileSize,
          collected: false,
          radius: 14
        });
      }

      // Distribui Dicas Misteriosas
      this.clues = [];
      const clueTexts = [
        "A Saída está selada nos confins mais distantes deste pesadelo.",
        "A criatura não consegue farejar você dentro dos armários de ferro.",
        "Não permaneça parado por muito tempo... ele sente a sua respiração!",
        "A Chave Dourada é necessária para quebrar os selos da porta final.",
        "A fumaça cega os sentidos da besta e limpa temporariamente o seu rastro.",
        "A bússola mágica sempre revela o caminho para o seu próximo objetivo."
      ];
      const numClues = Math.min(clueTexts.length, freeTiles.length);
      for (let i = 0; i < numClues; i++) {
        const t = freeTiles.pop();
        this.clues.push({
          x: (t.x + 0.5) * this.tileSize,
          y: (t.y + 0.5) * this.tileSize,
          text: clueTexts[i],
          read: false,
          radius: 16
        });
      }

      // Partículas e Efeitos
      this.particles = [];
      this.smokeClouds = [];

      // Atualiza Telas e HUD
      this.dom.menuScreen.classList.add('hidden');
      this.dom.victoryScreen.classList.add('hidden');
      this.dom.gameOverScreen.classList.add('hidden');
      this.dom.hud.classList.remove('hidden');
      this.dom.hidingDarkness.classList.remove('active');
      this.dom.dangerOverlay.classList.remove('active');
      this.dom.wrapper.classList.remove('shaking');

      this.gameState = 'playing';
      this.updateHUD();
      this.audio.startAmbientDrone();
    }

    /* ========================================================================
       SISTEMA DE INTERAÇÃO (TECLA E / TOUCH)
       ======================================================================== */
    handleInteraction() {
      if (this.gameState !== 'playing') return;

      // 1. Se já está escondido, sair do esconderijo
      if (this.player.isHiding) {
        this.player.isHiding = false;
        this.player.currentHidingSpot.occupied = false;
        this.player.currentHidingSpot = null;
        this.dom.hidingDarkness.classList.remove('active');
        this.dom.hidingAlert.classList.add('hidden');
        this.dom.buffHidden.classList.add('hidden');
        this.audio.playFootstep();
        return;
      }

      // 2. Verificar se está próximo de um Esconderijo
      for (const spot of this.hidingSpots) {
        const dist = Math.hypot(this.player.x - spot.x, this.player.y - spot.y);
        if (dist < 36 && !spot.occupied) {
          this.player.isHiding = true;
          this.player.currentHidingSpot = spot;
          spot.occupied = true;
          this.player.x = spot.x;
          this.player.y = spot.y;
          this.dom.hidingDarkness.classList.add('active');
          this.dom.hidingAlert.classList.remove('hidden');
          this.dom.buffHidden.classList.remove('hidden');
          this.audio.playFootstep();

          // Criatura perde o alvo imediato se estiver perseguindo
          if (this.stalker.state === 'chase') {
            this.stalker.state = 'confused';
            this.stalker.confusedTimer = 3.5;
            this.stalker.lastKnownPlayerPos = { x: this.player.x, y: this.player.y };
          }
          return;
        }
      }

      // 3. Verificar se está na Porta de Saída
      const exitDist = Math.hypot(this.player.x - this.exitDoor.x, this.player.y - this.exitDoor.y);
      if (exitDist < 42) {
        if (this.inventory.hasKey) {
          this.audio.playUnlockDoor();
          this.triggerVictory();
        } else {
          this.showClueToast("Portão Selado", "Este portão maciço está trancado por correntes ancestrais. Você precisa da Chave Dourada para abri-lo!");
        }
        return;
      }

      // 4. Verificar se está próximo de uma Dica
      for (const clue of this.clues) {
        const dist = Math.hypot(this.player.x - clue.x, this.player.y - clue.y);
        if (dist < 32) {
          if (!clue.read) {
            clue.read = true;
            this.stats.cluesRead++;
          }
          this.audio.playClueSound();
          this.showClueToast("Inscrição nas Paredes", clue.text);
          return;
        }
      }
    }

    useSmokeBomb() {
      if (this.gameState !== 'playing' || this.player.isHiding) return;
      if (this.inventory.smokeBombs <= 0) return;

      this.inventory.smokeBombs--;
      this.audio.playSmokeHiss();

      // Cria nuvem de fumaça na posição atual
      this.smokeClouds.push({
        x: this.player.x,
        y: this.player.y,
        radius: 120,
        timer: 6.5,
        maxDuration: 6.5
      });

      // Ativa efeito de névoa temporário
      this.dom.smokeOverlay.classList.add('active');
      setTimeout(() => {
        this.dom.smokeOverlay.classList.remove('active');
      }, 2500);

      // Desorienta a criatura se ela estiver próxima
      const distToMonster = Math.hypot(this.stalker.x - this.player.x, this.stalker.y - this.player.y);
      if (distToMonster < 260) {
        this.stalker.state = 'blinded';
        this.stalker.blindedTimer = 6.0;
        this.stalker.path = [];
      }

      this.updateHUD();
    }

    showClueToast(title, message) {
      document.getElementById('clueTitle').textContent = title;
      this.dom.clueMessage.textContent = `"${message}"`;
      this.dom.clueToast.classList.remove('hidden');

      // Fecha automaticamente após 8 segundos
      if (this.clueTimeout) clearTimeout(this.clueTimeout);
      this.clueTimeout = setTimeout(() => {
        this.dom.clueToast.classList.add('hidden');
      }, 8000);
    }

    /* ========================================================================
       LOOP DO JOGO E ATUALIZAÇÕES POR FRAME (DELTA TIME)
       ======================================================================== */
    gameLoop(timestamp) {
      const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
      this.lastTime = timestamp;

      if (this.gameState === 'playing') {
        this.update(dt);
      }

      this.render();
      requestAnimationFrame(this.gameLoop.bind(this));
    }

    update(dt) {
      this.stats.elapsedTime += dt;

      // Atualiza Buffs
      if (this.inventory.buffs.speed > 0) this.inventory.buffs.speed -= dt;
      if (this.inventory.buffs.flashlight > 0) this.inventory.buffs.flashlight -= dt;
      if (this.inventory.buffs.compass > 0) this.inventory.buffs.compass -= dt;

      // Atualiza Nuvens de Fumaça
      for (let i = this.smokeClouds.length - 1; i >= 0; i--) {
        const cloud = this.smokeClouds[i];
        cloud.timer -= dt;
        if (cloud.timer <= 0) {
          this.smokeClouds.splice(i, 1);
        }
      }

      this.updatePlayer(dt);
      this.updateStalker(dt);
      this.checkItemPickups();
      this.updateParticles(dt);
      this.updateCamera(dt);
      this.updateHUD();
    }

    /* ========================================================================
       ATUALIZAÇÃO DO JOGADOR
       ======================================================================== */
    updatePlayer(dt) {
      if (this.player.isHiding) {
        // Recupera stamina rapidamente enquanto escondido
        this.player.stamina = Math.min(this.player.maxStamina, this.player.stamina + 35 * dt);
        this.player.idleTimer = 0;
        return;
      }

      // Entrada de Movimento (Teclado ou Joystick Touch)
      let inputX = 0;
      let inputY = 0;

      if (this.keys['w'] || this.keys['arrowup']) inputY -= 1;
      if (this.keys['s'] || this.keys['arrowdown']) inputY += 1;
      if (this.keys['a'] || this.keys['arrowleft']) inputX -= 1;
      if (this.keys['d'] || this.keys['arrowright']) inputX += 1;

      // Integração com Touch Joystick
      if (this.touchJoy.active) {
        inputX = this.touchJoy.normX;
        inputY = this.touchJoy.normY;
      }

      const length = Math.hypot(inputX, inputY);
      const isMoving = length > 0.1;

      if (isMoving) {
        this.player.idleTimer = 0;
        this.dom.idleWarning.classList.add('hidden');

        // Ângulo para a lanterna e animação
        this.player.angle = Math.atan2(inputY, inputX);

        // Gerenciamento de Corrida e Stamina
        let speed = this.player.speedWalk;

        if (this.player.isSprinting && !this.player.isExhausted && this.player.stamina > 5) {
          speed = this.player.speedSprint;
          this.player.stamina = Math.max(0, this.player.stamina - 28 * dt);
          if (this.player.stamina <= 0) {
            this.player.isExhausted = true;
          }
        } else {
          this.player.stamina = Math.min(this.player.maxStamina, this.player.stamina + 14 * dt);
          if (this.player.stamina > 25) {
            this.player.isExhausted = false;
          }
        }

        // Bônus de Energético
        if (this.inventory.buffs.speed > 0) {
          speed *= 1.45;
        }

        this.player.currentSpeed = speed;

        // Movimentação suave com assistência em quinas e prevenção contra emperramento
        const prevX = this.player.x;
        const prevY = this.player.y;
        this.player.isMoving = true;

        this.movePlayerWithCollision(inputX / length, inputY / length, speed, dt);

        // Distância percorrida e som de passos
        const distStep = Math.hypot(this.player.x - prevX, this.player.y - prevY);
        this.player.distanceTraveled += distStep;
        if (distStep > 0.05) {
          this.player.walkAnimTimer += dt * (speed / 100);
          this.audio.playFootstep();
        }

        // Partículas sutis de poeira nas pegadas
        if (Math.random() < 0.2) {
          this.particles.push({
            x: this.player.x - Math.cos(this.player.angle) * 8,
            y: this.player.y - Math.sin(this.player.angle) * 8,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            radius: Math.random() * 2 + 1,
            color: 'rgba(148, 163, 184, 0.4)',
            life: 0.4,
            maxLife: 0.4
          });
        }
      } else {
        this.player.isMoving = false;
        // Recuperação de Stamina parado
        this.player.stamina = Math.min(this.player.maxStamina, this.player.stamina + 25 * dt);
        if (this.player.stamina > 25) this.player.isExhausted = false;

        // Penalidade de Inatividade (Idle Penalty)
        this.player.idleTimer += dt;
        if (this.player.idleTimer > 6.0) {
          this.dom.idleWarning.classList.remove('hidden');
          // Força o monstro a rastrear o jogador
          if (this.stalker.state !== 'blinded') {
            this.stalker.state = 'chase';
            this.stalker.speed = this.stalker.rageSpeed;
          }
        }
      }
    }

    // Movimentação suave com assistência em quinas e deslizamento em paredes
    movePlayerWithCollision(dirX, dirY, speed, dt) {
      const colRadius = this.player.collisionRadius || 10;
      const totalDist = speed * dt;
      const moveX = dirX * totalDist;
      const moveY = dirY * totalDist;

      // 1. Eixo X
      if (Math.abs(moveX) > 0.0001) {
        if (!this.checkWallCollision(this.player.x + moveX, this.player.y, colRadius)) {
          this.player.x += moveX;
        } else {
          // Assistência de quina: desliza suavemente em Y para entrar no corredor
          const cornerNudge = this.findCornerNudgeY(this.player.x + moveX, this.player.y, colRadius);
          if (cornerNudge !== 0 && Math.abs(dirY) < 0.4) {
            const nudgeDist = cornerNudge * speed * dt * 0.85;
            if (!this.checkWallCollision(this.player.x, this.player.y + nudgeDist, colRadius)) {
              this.player.y += nudgeDist;
            }
          }
          // Avanço contínuo até encostar na parede
          this.sweepAxisX(moveX, colRadius);
        }
      }

      // 2. Eixo Y
      if (Math.abs(moveY) > 0.0001) {
        if (!this.checkWallCollision(this.player.x, this.player.y + moveY, colRadius)) {
          this.player.y += moveY;
        } else {
          // Assistência de quina: desliza suavemente em X para entrar no corredor
          const cornerNudge = this.findCornerNudgeX(this.player.x, this.player.y + moveY, colRadius);
          if (cornerNudge !== 0 && Math.abs(dirX) < 0.4) {
            const nudgeDist = cornerNudge * speed * dt * 0.85;
            if (!this.checkWallCollision(this.player.x + nudgeDist, this.player.y, colRadius)) {
              this.player.x += nudgeDist;
            }
          }
          // Avanço contínuo até encostar na parede
          this.sweepAxisY(moveY, colRadius);
        }
      }

      // 3. Resolução ativa de penetração contra paredes
      this.resolveWallPenetration(this.player, colRadius);
    }

    findCornerNudgeY(targetX, curY, radius) {
      const offsets = [4, 8, 12, 16];
      for (const off of offsets) {
        if (!this.checkWallCollision(targetX, curY - off, radius)) return -1;
        if (!this.checkWallCollision(targetX, curY + off, radius)) return 1;
      }
      return 0;
    }

    findCornerNudgeX(curX, targetY, radius) {
      const offsets = [4, 8, 12, 16];
      for (const off of offsets) {
        if (!this.checkWallCollision(curX - off, targetY, radius)) return -1;
        if (!this.checkWallCollision(curX + off, targetY, radius)) return 1;
      }
      return 0;
    }

    sweepAxisX(desiredMoveX, radius) {
      const sign = Math.sign(desiredMoveX);
      let step = Math.abs(desiredMoveX);
      let currentX = this.player.x;
      for (let i = 0; i < 4; i++) {
        step /= 2;
        if (!this.checkWallCollision(currentX + sign * step, this.player.y, radius)) {
          currentX += sign * step;
        }
      }
      this.player.x = currentX;
    }

    sweepAxisY(desiredMoveY, radius) {
      const sign = Math.sign(desiredMoveY);
      let step = Math.abs(desiredMoveY);
      let currentY = this.player.y;
      for (let i = 0; i < 4; i++) {
        step /= 2;
        if (!this.checkWallCollision(this.player.x, currentY + sign * step, radius)) {
          currentY += sign * step;
        }
      }
      this.player.y = currentY;
    }

    resolveWallPenetration(entity, radius) {
      const minTileX = Math.floor((entity.x - radius - 2) / this.tileSize);
      const maxTileX = Math.floor((entity.x + radius + 2) / this.tileSize);
      const minTileY = Math.floor((entity.y - radius - 2) / this.tileSize);
      const maxTileY = Math.floor((entity.y + radius + 2) / this.tileSize);

      for (let ty = minTileY; ty <= maxTileY; ty++) {
        for (let tx = minTileX; tx <= maxTileX; tx++) {
          if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows || this.grid[ty][tx] === 1) {
            const nearestX = Math.max(tx * this.tileSize, Math.min(entity.x, (tx + 1) * this.tileSize));
            const nearestY = Math.max(ty * this.tileSize, Math.min(entity.y, (ty + 1) * this.tileSize));
            const distX = entity.x - nearestX;
            const distY = entity.y - nearestY;
            const distSq = distX * distX + distY * distY;
            if (distSq < radius * radius && distSq > 0.0001) {
              const dist = Math.sqrt(distSq);
              const overlap = radius - dist;
              entity.x += (distX / dist) * overlap;
              entity.y += (distY / dist) * overlap;
            } else if (distSq <= 0.0001) {
              const tileCenterX = (tx + 0.5) * this.tileSize;
              const tileCenterY = (ty + 0.5) * this.tileSize;
              const pushX = entity.x - tileCenterX || 1;
              const pushY = entity.y - tileCenterY || 0;
              const pushLen = Math.hypot(pushX, pushY);
              entity.x += (pushX / pushLen) * 1.5;
              entity.y += (pushY / pushLen) * 1.5;
            }
          }
        }
      }
    }

    // Colisão Circular do Jogador com o Grid de Paredes
    checkWallCollision(x, y, radius) {
      const minTileX = Math.floor((x - radius) / this.tileSize);
      const maxTileX = Math.floor((x + radius) / this.tileSize);
      const minTileY = Math.floor((y - radius) / this.tileSize);
      const maxTileY = Math.floor((y + radius) / this.tileSize);

      for (let ty = minTileY; ty <= maxTileY; ty++) {
        for (let tx = minTileX; tx <= maxTileX; tx++) {
          if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows || this.grid[ty][tx] === 1) {
            // Colisão círculo com caixa do tile
            const nearestX = Math.max(tx * this.tileSize, Math.min(x, (tx + 1) * this.tileSize));
            const nearestY = Math.max(ty * this.tileSize, Math.min(y, (ty + 1) * this.tileSize));
            const distX = x - nearestX;
            const distY = y - nearestY;
            if (distX * distX + distY * distY < radius * radius) {
              return true;
            }
          }
        }
      }
      return false;
    }

    /* ========================================================================
       IA E ATUALIZAÇÃO DO PERSEGUIDOR (STALKER)
       ======================================================================== */
    updateStalker(dt) {
      this.stalker.animPulse += dt * 5;

      const monsterTile = {
        x: Math.floor(this.stalker.x / this.tileSize),
        y: Math.floor(this.stalker.y / this.tileSize)
      };

      const playerTile = {
        x: Math.floor(this.player.x / this.tileSize),
        y: Math.floor(this.player.y / this.tileSize)
      };

      const distToPlayer = Math.hypot(this.stalker.x - this.player.x, this.stalker.y - this.player.y);

      // Verificação de Detecção e Estados
      if (this.stalker.state === 'blinded') {
        this.stalker.blindedTimer -= dt;
        if (this.stalker.blindedTimer <= 0) {
          this.stalker.state = 'patrol';
          this.stalker.speed = this.stalker.baseSpeed;
        }
      } else if (this.player.isHiding) {
        // Se jogador está escondido, criatura não o persegue
        if (this.stalker.state === 'chase') {
          this.stalker.state = 'confused';
          this.stalker.confusedTimer = 3.5;
        }
        if (this.stalker.state === 'confused') {
          this.stalker.confusedTimer -= dt;
          if (this.stalker.confusedTimer <= 0) {
            this.stalker.state = 'patrol';
            this.stalker.speed = this.stalker.baseSpeed;
          }
        }
      } else {
        // Jogador visível: se estiver a uma certa distância ou se o jogador ficou parado
        const detectionRadius = this.difficulty === 'hard' ? 450 : (this.difficulty === 'easy' ? 300 : 380);
        if (distToPlayer < detectionRadius || this.player.idleTimer > 6) {
          if (this.stalker.state !== 'chase') {
            this.audio.playAlertSting();
          }
          this.stalker.state = 'chase';
          this.stalker.lastKnownPlayerPos = { x: this.player.x, y: this.player.y };
        } else if (distToPlayer > detectionRadius * 1.5) {
          this.stalker.state = 'patrol';
        }
      }

      // Recalcula Caminho A* periodicamente
      this.stalker.pathUpdateTimer -= dt;
      if (this.stalker.pathUpdateTimer <= 0) {
        this.stalker.pathUpdateTimer = 0.25; // 4 vezes por segundo

        let target = playerTile;
        if (this.stalker.state === 'blinded') {
          // Anda aleatoriamente
          target = {
            x: Math.max(1, Math.min(this.cols - 2, monsterTile.x + Math.floor((Math.random() - 0.5) * 6))),
            y: Math.max(1, Math.min(this.rows - 2, monsterTile.y + Math.floor((Math.random() - 0.5) * 6)))
          };
        } else if (this.stalker.state === 'confused') {
          target = {
            x: Math.floor(this.stalker.lastKnownPlayerPos.x / this.tileSize),
            y: Math.floor(this.stalker.lastKnownPlayerPos.y / this.tileSize)
          };
        } else if (this.stalker.state === 'patrol') {
          // Patrulha em direção a pontos de interesse
          if (!this.stalker.patrolTarget || Math.hypot(this.stalker.x - this.stalker.patrolTarget.x, this.stalker.y - this.stalker.patrolTarget.y) < 60) {
            this.stalker.patrolTarget = {
              x: (Math.floor(Math.random() * (this.cols - 2)) + 1) * this.tileSize,
              y: (Math.floor(Math.random() * (this.rows - 2)) + 1) * this.tileSize
            };
          }
          target = {
            x: Math.floor(this.stalker.patrolTarget.x / this.tileSize),
            y: Math.floor(this.stalker.patrolTarget.y / this.tileSize)
          };
        }

        // Calcula rota
        const path = Pathfinding.findPath(this.grid, monsterTile, target);
        if (path.length > 0) {
          this.stalker.path = path;
          this.stalker.pathIndex = 0;
        }
      }

      // Segue o Caminho Traçado
      if (this.stalker.path && this.stalker.path.length > 0 && this.stalker.pathIndex < this.stalker.path.length) {
        const nextWaypoint = this.stalker.path[this.stalker.pathIndex];
        const targetWorldX = (nextWaypoint.x + 0.5) * this.tileSize;
        const targetWorldY = (nextWaypoint.y + 0.5) * this.tileSize;

        const dx = targetWorldX - this.stalker.x;
        const dy = targetWorldY - this.stalker.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 8) {
          this.stalker.pathIndex++;
        } else {
          const moveDist = this.stalker.speed * dt;
          this.stalker.x += (dx / dist) * moveDist;
          this.stalker.y += (dy / dist) * moveDist;
        }
      }

      // Emissão de brasas e partículas de sombra do monstro
      if (Math.random() < 0.4) {
        this.particles.push({
          x: this.stalker.x + (Math.random() - 0.5) * 20,
          y: this.stalker.y + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 30,
          vy: (Math.random() - 0.5) * 30,
          radius: Math.random() * 3 + 2,
          color: 'rgba(239, 68, 68, 0.7)',
          life: 0.5,
          maxLife: 0.5
        });
      }

      // Efeitos de Tensão (Tremor de tela, Vinheta Vermelha, Alertas e Som de Coração)
      const maxDistTension = 400;
      const ratio = Math.max(0, Math.min(1, distToPlayer / maxDistTension));
      this.audio.updateHeartbeat(ratio);

      if (distToPlayer < 240 && !this.player.isHiding) {
        this.dom.dangerOverlay.classList.add('active');
        this.dom.dangerAlert.classList.remove('hidden');
      } else {
        this.dom.dangerOverlay.classList.remove('active');
        this.dom.dangerAlert.classList.add('hidden');
      }

      if (distToPlayer < 140 && !this.player.isHiding) {
        this.dom.wrapper.classList.add('shaking');
      } else {
        this.dom.wrapper.classList.remove('shaking');
      }

      // Verificação de Captura (Game Over)
      if (distToPlayer < (this.player.radius + this.stalker.radius) && !this.player.isHiding) {
        this.player.health -= 100 * dt;
        if (this.player.health <= 0) {
          this.triggerGameOver();
        }
      }
    }

    /* ========================================================================
       COLETA DE ITENS
       ======================================================================== */
    checkItemPickups() {
      // 1. Chave da Saída
      if (!this.keyItem.collected) {
        const dist = Math.hypot(this.player.x - this.keyItem.x, this.player.y - this.keyItem.y);
        if (dist < (this.player.radius + this.keyItem.radius)) {
          this.keyItem.collected = true;
          this.inventory.hasKey = true;
          this.stats.itemsCollected++;
          this.audio.playItemPickup();
          this.dom.objectiveText.textContent = "Chave Encontrada! Fuja imediatamente pela Saída!";
          this.showClueToast("Chave Coletada!", "Você encontrou a Chave Dourada! Os portões da Saída agora podem ser abertos!");
        }
      }

      // 2. Outros Itens
      for (const item of this.items) {
        if (!item.collected) {
          const dist = Math.hypot(this.player.x - item.x, this.player.y - item.y);
          if (dist < (this.player.radius + item.radius)) {
            item.collected = true;
            this.stats.itemsCollected++;
            this.audio.playItemPickup();

            if (item.type === 'flashlight') {
              this.inventory.buffs.flashlight = 18;
              this.showClueToast("Lanterna Encontrada", "Sua visão no labirinto foi ampliada consideravelmente!");
            } else if (item.type === 'energy') {
              this.inventory.buffs.speed = 10;
              this.showClueToast("Energético Ingerido", "Sua velocidade de corrida aumentou temporariamente!");
            } else if (item.type === 'medkit') {
              this.player.health = Math.min(this.player.maxHealth, this.player.health + 45);
              this.showClueToast("Kit de Energia", "Sua vitalidade foi recuperada.");
            } else if (item.type === 'compass') {
              this.inventory.buffs.compass = 14;
              this.showClueToast("Bússola Mística", "A rota para o seu próximo objetivo brilha com uma linha dourada!");
            } else if (item.type === 'smoke') {
              this.inventory.smokeBombs++;
              this.showClueToast("Bomba de Fumaça", "Pressione [Espaço] para soltar uma cortina de fumaça e cegar o perseguidor!");
            }
          }
        }
      }
    }

    /* ========================================================================
       PARTÍCULAS E CÂMERA
       ======================================================================== */
    updateParticles(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
        }
      }
    }

    updateCamera(dt) {
      this.camera.targetX = this.player.x - this.canvas.width / 2;
      this.camera.targetY = this.player.y - this.canvas.height / 2;

      // Suavização da câmera (Lerp)
      this.camera.x += (this.camera.targetX - this.camera.x) * 10 * dt;
      this.camera.y += (this.camera.targetY - this.camera.y) * 10 * dt;
    }

    /* ========================================================================
       RENDERIZAÇÃO COMPLETA NO CANVAS
       ======================================================================== */
    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      if (this.gameState === 'menu') {
        this.renderMenuBackground();
        return;
      }

      ctx.save();
      ctx.translate(-Math.floor(this.camera.x), -Math.floor(this.camera.y));

      // 1. Chão e Paredes do Labirinto
      this.renderMaze(ctx);

      // 2. Esconderijos (Armários)
      this.renderHidingSpots(ctx);

      // 3. Dicas Inscritas
      this.renderClues(ctx);

      // 4. Saída e Chave
      this.renderExitAndKey(ctx);

      // 5. Itens Colecionáveis
      this.renderItems(ctx);

      // 6. Nuvens de Fumaça
      this.renderSmokeClouds(ctx);

      // 7. Partículas
      this.renderParticles(ctx);

      // 8. Perseguidor (Stalker)
      this.renderStalker(ctx);

      // 9. Jogador
      this.renderPlayer(ctx);

      // 10. Guia da Bússola (se buff ativo)
      if (this.inventory.buffs.compass > 0) {
        this.renderCompassGuide(ctx);
      }

      ctx.restore();

      // 11. Camada de Iluminação Dinâmica e Névoa (Lighting Engine)
      this.renderDynamicLighting();
    }

    renderMenuBackground() {
      const ctx = this.ctx;
      ctx.fillStyle = '#05070d';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Grid sutil no fundo
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
      ctx.lineWidth = 1;
      const step = 40;
      for (let x = 0; x < this.canvas.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < this.canvas.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.canvas.width, y);
        ctx.stroke();
      }
    }

    renderMaze(ctx) {
      const startCol = Math.max(0, Math.floor(this.camera.x / this.tileSize));
      const endCol = Math.min(this.cols - 1, Math.ceil((this.camera.x + this.canvas.width) / this.tileSize));
      const startRow = Math.max(0, Math.floor(this.camera.y / this.tileSize));
      const endRow = Math.min(this.rows - 1, Math.ceil((this.camera.y + this.canvas.height) / this.tileSize));

      for (let y = startRow; y <= endRow; y++) {
        for (let x = startCol; x <= endCol; x++) {
          const posX = x * this.tileSize;
          const posY = y * this.tileSize;

          if (this.grid[y][x] === 1) {
            // Parede de Pedra/Ardósia com profundidade e chanfro
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(posX, posY, this.tileSize, this.tileSize);

            // Borda superior e esquerda mais clara
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(posX, posY, this.tileSize, 4);
            ctx.fillRect(posX, posY, 4, this.tileSize);

            // Borda inferior e direita mais escura
            ctx.fillStyle = '#090d16';
            ctx.fillRect(posX, posY + this.tileSize - 4, this.tileSize, 4);
            ctx.fillRect(posX + this.tileSize - 4, posY, 4, this.tileSize);

            // Textura visual de tijolo/pedra
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.strokeRect(posX + 6, posY + 6, this.tileSize - 12, this.tileSize - 12);
          } else {
            // Chão do Corredor
            ctx.fillStyle = '#090d16';
            ctx.fillRect(posX, posY, this.tileSize, this.tileSize);

            // Grade sutil do chão
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
            ctx.strokeRect(posX, posY, this.tileSize, this.tileSize);
          }
        }
      }
    }

    renderHidingSpots(ctx) {
      for (const spot of this.hidingSpots) {
        ctx.save();
        ctx.translate(spot.x, spot.y);

        // Armário de metal / madeira escura
        ctx.fillStyle = spot.occupied ? '#1e1b4b' : '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.fillRect(-14, -14, 28, 28);
        ctx.strokeRect(-14, -14, 28, 28);

        // Fendas de ventilação do armário
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-8, -6, 16, 2);
        ctx.fillRect(-8, -1, 16, 2);
        ctx.fillRect(-8, 4, 16, 2);

        // Ícone indicador sutil
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚪', 0, 0);

        ctx.restore();
      }
    }

    renderClues(ctx) {
      for (const clue of this.clues) {
        ctx.save();
        ctx.translate(clue.x, clue.y);

        // Runa brilhante na parede
        ctx.fillStyle = clue.read ? 'rgba(148, 163, 184, 0.3)' : 'rgba(251, 191, 36, 0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '12px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = clue.read ? '#94a3b8' : '#fef08a';
        ctx.fillText('📜', 0, 0);

        ctx.restore();
      }
    }

    renderExitAndKey(ctx) {
      // Porta de Saída
      ctx.save();
      ctx.translate(this.exitDoor.x, this.exitDoor.y);

      // Portal com aura azul/esmeralda
      const pulse = Math.sin(performance.now() * 0.004) * 4;
      const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, 24 + pulse);
      grad.addColorStop(0, 'rgba(16, 185, 129, 0.8)');
      grad.addColorStop(0.6, 'rgba(6, 182, 212, 0.3)');
      grad.addColorStop(1, 'rgba(6, 182, 212, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 28 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Estrutura do Portal
      ctx.fillStyle = '#065f46';
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.5;
      ctx.fillRect(-16, -16, 32, 32);
      ctx.strokeRect(-16, -16, 32, 32);

      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.inventory.hasKey ? '🔓' : '🔒', 0, 0);
      ctx.restore();

      // Chave Dourada
      if (!this.keyItem.collected) {
        ctx.save();
        ctx.translate(this.keyItem.x, this.keyItem.y);

        const keyBob = Math.sin(performance.now() * 0.006) * 3;
        const keyGrad = ctx.createRadialGradient(0, keyBob, 2, 0, keyBob, 16);
        keyGrad.addColorStop(0, 'rgba(251, 191, 36, 0.8)');
        keyGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');

        ctx.fillStyle = keyGrad;
        ctx.beginPath();
        ctx.arc(0, keyBob, 16, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🗝️', 0, keyBob);

        ctx.restore();
      }
    }

    renderItems(ctx) {
      for (const item of this.items) {
        if (item.collected) continue;

        ctx.save();
        ctx.translate(item.x, item.y);
        const itemBob = Math.sin(performance.now() * 0.005 + item.x) * 3;

        let icon = '📦';
        if (item.type === 'flashlight') icon = '🔦';
        else if (item.type === 'energy') icon = '⚡';
        else if (item.type === 'medkit') icon = '❤️';
        else if (item.type === 'compass') icon = '🧭';
        else if (item.type === 'smoke') icon = '💨';

        ctx.font = '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, 0, itemBob);

        ctx.restore();
      }
    }

    renderSmokeClouds(ctx) {
      for (const cloud of this.smokeClouds) {
        ctx.save();
        const alpha = Math.min(0.75, cloud.timer / cloud.maxDuration);
        const grad = ctx.createRadialGradient(cloud.x, cloud.y, 10, cloud.x, cloud.y, cloud.radius);
        grad.addColorStop(0, `rgba(203, 213, 225, ${alpha})`);
        grad.addColorStop(0.7, `rgba(100, 116, 139, ${alpha * 0.5})`);
        grad.addColorStop(1, 'rgba(100, 116, 139, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    renderParticles(ctx) {
      for (const p of this.particles) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    renderStalker(ctx) {
      ctx.save();
      ctx.translate(this.stalker.x, this.stalker.y);

      // Aura vermelha assustadora
      const pulse = Math.sin(this.stalker.animPulse) * 4;
      const redGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 36 + pulse);
      redGrad.addColorStop(0, 'rgba(239, 68, 68, 0.9)');
      redGrad.addColorStop(0.5, 'rgba(185, 28, 28, 0.4)');
      redGrad.addColorStop(1, 'rgba(185, 28, 28, 0)');

      ctx.fillStyle = redGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 36 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Corpo da Criatura das Sombras
      ctx.fillStyle = '#050508';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.stalker.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Olhos flamejantes carmesins
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#f87171';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(-5, -4, 3, 0, Math.PI * 2);
      ctx.arc(5, -4, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    renderPlayer(ctx) {
      if (this.player.isHiding) return; // Invisível se escondido

      ctx.save();
      ctx.translate(this.player.x, this.player.y);
      ctx.rotate(this.player.angle);

      // Animação de caminhada viva para o bonequinho
      const isMoving = this.player.isMoving;
      const walkTime = this.player.walkAnimTimer;
      const legSwing = isMoving ? Math.sin(walkTime * 12) * 6 : 0;
      const armSwing = isMoving ? Math.sin(walkTime * 12) * 4 : 0;
      const bodyBob = isMoving ? Math.abs(Math.sin(walkTime * 12)) * 1.2 : 0;

      // 1. Sombra suave de contato no chão
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(-1, 0, 11, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Pernas e Botas animadas do bonequinho (passos alternados)
      // Perna e Bota Esquerda
      ctx.fillStyle = '#1e293b'; // Calça tática
      ctx.fillRect(-6 + legSwing, -8, 8, 4);
      ctx.fillStyle = '#475569'; // Bota
      ctx.beginPath();
      ctx.arc(2 + legSwing, -6, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a'; // Ponta da bota
      ctx.fillRect(1.5 + legSwing, -7.8, 2, 3.6);

      // Perna e Bota Direita
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-6 - legSwing, 4, 8, 4);
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(2 - legSwing, 6, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(1.5 - legSwing, 4.2, 2, 3.6);

      // 3. Mochila de Sobrevivente nas costas
      ctx.fillStyle = '#78350f'; // Couro marrom
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.rect(-11, -5.5, 6, 11);
      ctx.fill();
      ctx.stroke();

      // Detalhes da fivela da mochila
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-10, -1.5, 2, 3);

      // 4. Tronco / Jaqueta de Explorador (ombros e corpo)
      ctx.fillStyle = '#0284c7'; // Azul vibrante
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(-1, 0, 6, 8 + bodyBob * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Cinto / coldre
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-2, -7.5, 2.5, 15);

      // 5. Braço e Mão Esquerda (balanço natural na caminhada)
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(-armSwing * 0.4, -7.5, 3, 0, Math.PI * 2);
      ctx.fill();
      // Mão esquerda
      ctx.fillStyle = '#fed7aa'; // Tom de pele
      ctx.beginPath();
      ctx.arc(2.5 - armSwing, -8, 2.6, 0, Math.PI * 2);
      ctx.fill();

      // 6. Braço Direito segurando a Lanterna para frente
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(2 + armSwing * 0.3, 7.5, 3, 0, Math.PI * 2);
      ctx.fill();
      // Mão direita
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(6.5 + armSwing * 0.2, 7.5, 2.6, 0, Math.PI * 2);
      ctx.fill();

      // Lanterna 3D estilizada
      ctx.fillStyle = '#334155'; // Corpo da lanterna
      ctx.fillRect(7, 5.5, 8, 4);
      ctx.fillStyle = '#94a3b8'; // Anel metálico
      ctx.fillRect(14, 5, 2, 5);
      // Lente brilhante amarela
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(15.5, 5.2, 1.8, 4.6);

      // 7. Cabeça e Rosto do Bonequinho
      // Orelhas
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(1, -6.8, 1.8, 0, Math.PI * 2);
      ctx.arc(1, 6.8, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Cabeça (círculo com tom de pele)
      ctx.fillStyle = '#fed7aa';
      ctx.strokeStyle = '#fcd34d';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(1.5, 0, 6.5, 0, Math.PI * 2);
      ctx.fill();

      // Boné de aventureiro com aba frontal
      ctx.fillStyle = '#0f172a'; // Copa do boné
      ctx.beginPath();
      ctx.arc(0.5, 0, 6.5, Math.PI * 0.5, Math.PI * 1.5);
      ctx.fill();
      // Aba do boné apontando para onde o personagem olha
      ctx.fillStyle = '#0369a1';
      ctx.beginPath();
      ctx.ellipse(4, 0, 4.2, 3.2, 0, -Math.PI / 2, Math.PI / 2);
      ctx.fill();

      // Olhos do bonequinho
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(4.2, -2.6, 1.8, 0, Math.PI * 2);
      ctx.arc(4.2, 2.6, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Pupilas pretas olhando para frente
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(4.9, -2.6, 1.1, 0, Math.PI * 2);
      ctx.arc(4.9, 2.6, 1.1, 0, Math.PI * 2);
      ctx.fill();

      // Ponto de brilho expressivo no olhar
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(5.3, -2.9, 0.45, 0, Math.PI * 2);
      ctx.arc(5.3, 2.3, 0.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    renderCompassGuide(ctx) {
      // Desenha linha-guia dourada até o objetivo mais urgente (Chave ou Saída)
      const target = this.inventory.hasKey ? this.exitDoor : this.keyItem;
      ctx.save();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);

      ctx.beginPath();
      ctx.moveTo(this.player.x, this.player.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.restore();
    }

    /* ========================================================================
       SISTEMA DE ILUMINAÇÃO DINÂMICA (LIGHTING & SHADOW ENGINE)
       ======================================================================== */
    renderDynamicLighting() {
      const ctx = this.ctx;
      ctx.save();

      // Utiliza 'destination-out' para abrir furos luminosos na escuridão
      // 1. Cria canvas temporário do tamanho da tela com escuridão total
      if (!this.lightCanvas) {
        this.lightCanvas = document.createElement('canvas');
        this.lightCtx = this.lightCanvas.getContext('2d');
      }

      if (this.lightCanvas.width !== this.canvas.width || this.lightCanvas.height !== this.canvas.height) {
        this.lightCanvas.width = this.canvas.width;
        this.lightCanvas.height = this.canvas.height;
      }

      const lCtx = this.lightCtx;
      lCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Preenche com escuridão ambiente densa
      const darknessLevel = this.player.isHiding ? 0.98 : (this.difficulty === 'hard' ? 0.96 : 0.92);
      lCtx.fillStyle = `rgba(3, 5, 10, ${darknessLevel})`;
      lCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      lCtx.globalCompositeOperation = 'destination-out';

      const screenPlayerX = this.player.x - this.camera.x;
      const screenPlayerY = this.player.y - this.camera.y;

      // Se o jogador NÃO estiver escondido, corta o cone e círculo da lanterna
      if (!this.player.isHiding) {
        let lightRadius = this.difficulty === 'hard' ? 140 : 180;
        if (this.inventory.buffs.flashlight > 0) lightRadius *= 1.75;

        // Círculo em torno do jogador
        const playerGrad = lCtx.createRadialGradient(screenPlayerX, screenPlayerY, 15, screenPlayerX, screenPlayerY, lightRadius);
        playerGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        playerGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.7)');
        playerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        lCtx.fillStyle = playerGrad;
        lCtx.beginPath();
        lCtx.arc(screenPlayerX, screenPlayerY, lightRadius, 0, Math.PI * 2);
        lCtx.fill();

        // Cone direcional da Lanterna
        lCtx.save();
        lCtx.translate(screenPlayerX, screenPlayerY);
        lCtx.rotate(this.player.angle);

        const coneGrad = lCtx.createRadialGradient(0, 0, 10, 0, 0, lightRadius * 1.5);
        coneGrad.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
        coneGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.4)');
        coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        lCtx.fillStyle = coneGrad;
        lCtx.beginPath();
        lCtx.moveTo(0, 0);
        lCtx.arc(0, 0, lightRadius * 1.5, -Math.PI / 4, Math.PI / 4);
        lCtx.closePath();
        lCtx.fill();
        lCtx.restore();
      }

      // Brilho da Saída (Portal)
      const screenExitX = this.exitDoor.x - this.camera.x;
      const screenExitY = this.exitDoor.y - this.camera.y;
      const exitGrad = lCtx.createRadialGradient(screenExitX, screenExitY, 5, screenExitX, screenExitY, 90);
      exitGrad.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
      exitGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      lCtx.fillStyle = exitGrad;
      lCtx.beginPath();
      lCtx.arc(screenExitX, screenExitY, 90, 0, Math.PI * 2);
      lCtx.fill();

      // Brilho da Chave (se ainda no mapa)
      if (!this.keyItem.collected) {
        const screenKeyX = this.keyItem.x - this.camera.x;
        const screenKeyY = this.keyItem.y - this.camera.y;
        const keyGrad = lCtx.createRadialGradient(screenKeyX, screenKeyY, 2, screenKeyX, screenKeyY, 60);
        keyGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
        keyGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        lCtx.fillStyle = keyGrad;
        lCtx.beginPath();
        lCtx.arc(screenKeyX, screenKeyY, 60, 0, Math.PI * 2);
        lCtx.fill();
      }

      // Brilho sutil do Perseguidor (Stalker)
      const screenStalkerX = this.stalker.x - this.camera.x;
      const screenStalkerY = this.stalker.y - this.camera.y;
      const monsterGrad = lCtx.createRadialGradient(screenStalkerX, screenStalkerY, 5, screenStalkerX, screenStalkerY, 80);
      monsterGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
      monsterGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      lCtx.fillStyle = monsterGrad;
      lCtx.beginPath();
      lCtx.arc(screenStalkerX, screenStalkerY, 80, 0, Math.PI * 2);
      lCtx.fill();

      // Aplica a camada de iluminação no canvas principal
      ctx.drawImage(this.lightCanvas, 0, 0);
      ctx.restore();
    }

    /* ========================================================================
       RENDERIZAÇÃO DO MINIMAPA (RADAR)
       ======================================================================== */
    renderMinimap() {
      if (!this.isMinimapOpen) return;
      const mCtx = this.miniCtx;
      const w = this.minimapCanvas.width;
      const h = this.minimapCanvas.height;
      const scaleX = w / this.cols;
      const scaleY = h / this.rows;

      mCtx.fillStyle = '#030712';
      mCtx.fillRect(0, 0, w, h);

      // Labirinto
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          if (this.grid[y][x] === 1) {
            mCtx.fillStyle = '#1e293b';
            mCtx.fillRect(x * scaleX, y * scaleY, scaleX, scaleY);
          }
        }
      }

      // Saída
      mCtx.fillStyle = '#10b981';
      mCtx.beginPath();
      mCtx.arc((this.exitDoor.tileX + 0.5) * scaleX, (this.exitDoor.tileY + 0.5) * scaleY, 4, 0, Math.PI * 2);
      mCtx.fill();

      // Chave
      if (!this.keyItem.collected) {
        mCtx.fillStyle = '#fbbf24';
        mCtx.beginPath();
        mCtx.arc((this.keyItem.tileX + 0.5) * scaleX, (this.keyItem.tileY + 0.5) * scaleY, 3, 0, Math.PI * 2);
        mCtx.fill();
      }

      // Jogador
      const pTileX = this.player.x / this.tileSize;
      const pTileY = this.player.y / this.tileSize;
      mCtx.fillStyle = '#38bdf8';
      mCtx.beginPath();
      mCtx.arc(pTileX * scaleX, pTileY * scaleY, 4, 0, Math.PI * 2);
      mCtx.fill();
    }

    /* ========================================================================
       ATUALIZAÇÃO DO HUD E ELEMENTOS DE INTERFACE
       ======================================================================== */
    updateHUD() {
      // 1. Barras de Vida e Stamina
      const healthPct = Math.max(0, Math.round(this.player.health));
      this.dom.healthFill.style.width = `${healthPct}%`;
      this.dom.healthValue.textContent = `${healthPct}%`;

      const staminaPct = Math.max(0, Math.round(this.player.stamina));
      this.dom.staminaFill.style.width = `${staminaPct}%`;
      this.dom.staminaValue.textContent = `${staminaPct}%`;

      // 2. Cronômetro
      const mins = Math.floor(this.stats.elapsedTime / 60).toString().padStart(2, '0');
      const secs = Math.floor(this.stats.elapsedTime % 60).toString().padStart(2, '0');
      this.dom.gameTimer.textContent = `${mins}:${secs}`;

      // 3. Inventário
      this.dom.keyStatus.textContent = this.inventory.hasKey ? 'OK' : '0/1';
      this.dom.keyStatus.classList.toggle('missing', !this.inventory.hasKey);

      this.dom.smokeCount.textContent = this.inventory.smokeBombs;
      this.dom.flashlightStatus.textContent = this.inventory.buffs.flashlight > 0 ? `${Math.ceil(this.inventory.buffs.flashlight)}s` : 'OFF';
      this.dom.compassStatus.textContent = this.inventory.buffs.compass > 0 ? `${Math.ceil(this.inventory.buffs.compass)}s` : 'OFF';

      // 4. Buffs
      if (this.inventory.buffs.speed > 0) {
        this.dom.buffSpeed.classList.remove('hidden');
        this.dom.buffSpeedTimer.textContent = `${Math.ceil(this.inventory.buffs.speed)}s`;
      } else {
        this.dom.buffSpeed.classList.add('hidden');
      }

      if (this.inventory.buffs.flashlight > 0) {
        this.dom.buffFlashlight.classList.remove('hidden');
        this.dom.buffFlashlightTimer.textContent = `${Math.ceil(this.inventory.buffs.flashlight)}s`;
      } else {
        this.dom.buffFlashlight.classList.add('hidden');
      }

      if (this.inventory.buffs.compass > 0) {
        this.dom.buffCompass.classList.remove('hidden');
        this.dom.buffCompassTimer.textContent = `${Math.ceil(this.inventory.buffs.compass)}s`;
      } else {
        this.dom.buffCompass.classList.add('hidden');
      }

      // 5. Prompt de Interação Contextual
      let promptText = null;

      if (this.player.isHiding) {
        promptText = "Sair do esconderijo";
      } else {
        // Verifica proximidade de armários
        for (const spot of this.hidingSpots) {
          if (Math.hypot(this.player.x - spot.x, this.player.y - spot.y) < 36) {
            promptText = "Esconder-se no armário";
            break;
          }
        }

        // Verifica proximidade da saída
        if (!promptText && Math.hypot(this.player.x - this.exitDoor.x, this.player.y - this.exitDoor.y) < 42) {
          promptText = this.inventory.hasKey ? "Destrancar e Escapar!" : "Portão trancado (requer Chave)";
        }

        // Verifica proximidade de dicas
        if (!promptText) {
          for (const clue of this.clues) {
            if (Math.hypot(this.player.x - clue.x, this.player.y - clue.y) < 32) {
              promptText = "Ler inscrição na parede";
              break;
            }
          }
        }
      }

      if (promptText) {
        this.dom.promptText.textContent = promptText;
        this.dom.interactionPrompt.classList.remove('hidden');
      } else {
        this.dom.interactionPrompt.classList.add('hidden');
      }

      // Atualiza Minimapa se aberto
      if (this.isMinimapOpen) {
        this.renderMinimap();
      }
    }

    /* ========================================================================
       TELAS DE FIM DE JOGO (VITÓRIA E DERROTA)
       ======================================================================== */
    triggerVictory() {
      this.gameState = 'victory';
      this.audio.stopAll();
      this.audio.playVictory();

      this.dom.hud.classList.add('hidden');
      this.dom.victoryScreen.classList.remove('hidden');
      this.dom.dangerOverlay.classList.remove('active');
      this.dom.wrapper.classList.remove('shaking');

      const elapsed = Math.floor(this.stats.elapsedTime);
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const secs = (elapsed % 60).toString().padStart(2, '0');

      document.getElementById('victoryTime').textContent = `${mins}:${secs}`;
      document.getElementById('victoryItems').textContent = this.stats.itemsCollected;
      document.getElementById('victoryClues').textContent = this.stats.cluesRead;
      document.getElementById('victoryDistance').textContent = `${Math.round(this.player.distanceTraveled / 48)}m`;

      // Verifica e salva novo recorde
      const prevBest = this.stats.bestTime ? parseInt(this.stats.bestTime) : Infinity;
      const isNewRecord = elapsed < prevBest;
      if (isNewRecord) {
        this.stats.bestTime = elapsed;
        localStorage.setItem('fuga_sombras_best_time', elapsed);
        document.getElementById('newRecordBanner').classList.remove('hidden');
        this.updateRecordsUI();
      } else {
        document.getElementById('newRecordBanner').classList.add('hidden');
      }
    }

    triggerGameOver() {
      this.gameState = 'gameover';
      this.audio.stopAll();
      this.audio.playDefeat();

      this.dom.hud.classList.add('hidden');
      this.dom.gameOverScreen.classList.remove('hidden');
      this.dom.dangerOverlay.classList.remove('active');
      this.dom.wrapper.classList.remove('shaking');

      const elapsed = Math.floor(this.stats.elapsedTime);
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const secs = (elapsed % 60).toString().padStart(2, '0');

      document.getElementById('defeatTime').textContent = `${mins}:${secs}`;
      document.getElementById('defeatItems').textContent = this.stats.itemsCollected;
      document.getElementById('defeatClues').textContent = this.stats.cluesRead;
      document.getElementById('defeatDistance').textContent = `${Math.round(this.player.distanceTraveled / 48)}m`;
    }

    returnToMenu() {
      this.gameState = 'menu';
      this.audio.stopAll();
      this.dom.victoryScreen.classList.add('hidden');
      this.dom.gameOverScreen.classList.add('hidden');
      this.dom.hud.classList.add('hidden');
      this.dom.menuScreen.classList.remove('hidden');
      this.dom.dangerOverlay.classList.remove('active');
      this.dom.wrapper.classList.remove('shaking');
      this.dom.hidingDarkness.classList.remove('active');
      this.updateRecordsUI();
    }
  }

  // Inicializa o jogo quando o DOM estiver pronto
  window.addEventListener('DOMContentLoaded', () => {
    window.game = new ShadowEscapeGame();
  });
})();
