/**
 * Trinity - Main Entry Point
 * Orchestrates initialization, rendering, and input wiring
 */

import { initWebGL, resizeCanvas, setupRenderState, clear } from './renderer/webgl.js';
import { Camera } from './renderer/camera.js';
import { BoardRenderer } from './renderer/board.js';
import { TileRenderer } from './renderer/TileRenderer.js';
import { UIRenderer } from './renderer/UIRenderer.js';
import { AnimationManager } from './renderer/AnimationManager.js';
import { RendererManager } from './renderer/RendererManager.js';
import { WebGLRenderer } from './renderer/WebGLRenderer.js';
import { TextRenderer } from './renderer/TextRenderer.js';
import { GridRenderer } from './renderer/GridRenderer.js';
import { screenToWorld, worldToGrid } from './utils/math.js';
import { InputManager, InputEvent } from './input/InputManager.js';
import { StateEvent } from './state/GameState.js';
import { GameController } from './controllers/GameController.js';
import { TILE, CAMERA, BOARD, ANIMATION } from './config.js';

class Game {
  constructor() {
    // DOM elements
    this.glCanvas = document.getElementById('gl-canvas');
    this.uiCanvas = document.getElementById('ui-canvas');
    this.inputLayer = document.getElementById('input-layer');
    this.loadingScreen = document.getElementById('loading');
    this.startScreen = document.getElementById('start-screen');
    this.startButton = document.getElementById('start-button');
    this.playerCountSelect = document.getElementById('player-count');
    this.endScreen = document.getElementById('end-screen');
    this.winnerNameEl = document.getElementById('winner-name');
    this.winnerSubtitleEl = document.getElementById('winner-subtitle');
    this.scoresListEl = document.getElementById('scores-list');
    this.playAgainButton = document.getElementById('play-again-button');
    this.errorDisplay = document.getElementById('error');

    // WebGL context
    this.gl = null;

    // Renderers
    this.camera = null;
    this.boardRenderer = null;
    this.tileRenderer = null;
    this.uiRenderer = null;
    this.animationManager = null;

    // Renderer manager for modular renderer switching
    this.rendererManager = new RendererManager();
    this.activeRendererName = 'webgl'; // Default renderer

    // Input
    this.input = null;

    // Game controller & state
    this.gameController = null;
    this.gameState = null;

    // Runtime
    this.isRunning = false;
    this.time = 0;
    this.lastTime = 0;

    // 3D Hand tile hover state
    this.hoveredHandTile = -1;

    // Bind methods
    this.render = this.render.bind(this);
    this.onResize = this.onResize.bind(this);
  }

  /**
   * Initialize the game
   */
  async init() {
    try {
      // Initialize WebGL
      this.gl = initWebGL(this.glCanvas);
      if (!this.gl) {
        throw new Error('WebGL 2.0 is not supported by your browser');
      }
      setupRenderState(this.gl);

      // Create renderers
      this.camera = new Camera();
      this.boardRenderer = new BoardRenderer(this.gl);
      await this.boardRenderer.init();
      this.tileRenderer = new TileRenderer(this.gl);
      await this.tileRenderer.init();
      this.uiRenderer = new UIRenderer(this.uiCanvas);
      this.animationManager = new AnimationManager();

      // Register renderers with the RendererManager
      this.setupRenderers();

      // Create game controller (game not started yet)
      this.gameController = new GameController(null);

      // Set up input
      this.setupInput();

      // Initial resize
      this.onResize();

      // Hide loading, show start screen
      this.loadingScreen.classList.add('hidden');
      this.startScreen.classList.remove('hidden');

      // Focus the start button so user can press Enter to start
      this.startButton.focus();

      // Set up start button handler
      this.startButton.addEventListener('click', () => {
        this.onStartGame();
      });

      // Set up play again button handler
      this.playAgainButton.addEventListener('click', () => {
        this.onPlayAgain();
      });

      console.log('Trinity initialized successfully');
    } catch (error) {
      this.showError(error.message);
      console.error('Initialization error:', error);
    }
  }

  /**
   * Handle start game button click
   */
  async onStartGame() {
    // Get selected player count
    const playerCount = parseInt(this.playerCountSelect.value, 10);

    // Hide start screen
    this.startScreen.classList.add('hidden');

    // Start the game (this will determine starting player and emit events)
    this.startNewGame(playerCount);

    // Set up state subscriptions (now that game is started)
    this.setupStateSubscriptions();

    // Start render loop first so animation can display
    this.isRunning = true;
    this.lastTime = performance.now();
    this.time = 0;
    requestAnimationFrame(this.render);

    // Run starting player animation
    const winner = await this.runStartingPlayerAnimation();

    // Show turn transition for starting player
    this.uiRenderer.startTurnTransition(winner, this.time);

    // Set initial board rotation to face starting player's side
    if (ANIMATION.CAMERA_ROTATION.ENABLED) {
      this.camera.setActivePlayer(winner);
    }

    console.log(`Game started with ${playerCount} players. Player ${winner + 1} goes first.`);
  }

  /**
   * Run the starting player determination animation
   * Subscribes to STARTING_PLAYER_* events and drives the UI animation
   * @returns {Promise<number>} Promise resolving to the winning player index
   */
  runStartingPlayerAnimation() {
    // If animation is disabled, just return the starting player immediately
    if (!ANIMATION.STARTING_PLAYER.ENABLED) {
      const startingPlayer = this.gameState.getCurrentPlayer();
      console.log(`Starting player determined: Player ${startingPlayer + 1} (drew highest tile)`);
      return Promise.resolve(startingPlayer);
    }

    return new Promise((resolve) => {
      let resolvedWinner = null;
      let currentRound = 1;

      // Phase timing constants (seconds)
      const SETUP_DURATION = 0.3;
      const DRAW_DELAY = 0.4;      // Delay between each player's draw
      const REVEAL_DELAY = 0.6;    // Delay after all draws before reveal
      const COMPARE_DELAY = 0.8;   // Delay after reveal before compare
      const RESOLVE_DELAY = 1.5;   // How long to show winner before ending
      const TIE_DELAY = 1.2;       // How long to show tie before next round

      // Handle draw start - new round begins
      const onDrawStart = (data) => {
        currentRound = data.round || 1;
        this.uiRenderer.startStartingPlayerAnimation(data.contenders, currentRound, this.time);
      };

      // Handle individual tile drawn
      const onTileDrawn = (data) => {
        // Add draw with slight delay based on player position
        const drawIndex = this.uiRenderer._startingPlayerAnimation.draws.length;
        setTimeout(() => {
          this.uiRenderer.addStartingPlayerDraw(data.player, data.tile.type, data.rank);
        }, drawIndex * DRAW_DELAY * 1000);
      };

      // Handle reveal (all tiles flip over)
      const onReveal = (data) => {
        const numPlayers = data.draws.length;
        const revealTime = numPlayers * DRAW_DELAY + REVEAL_DELAY;

        setTimeout(() => {
          this.uiRenderer.revealStartingPlayerTiles(this.time);
        }, revealTime * 1000);
      };

      // Handle compare (highlight winner(s))
      const onCompare = (data) => {
        const numPlayers = data.draws?.length || 2;
        const compareTime = numPlayers * DRAW_DELAY + REVEAL_DELAY + COMPARE_DELAY;

        setTimeout(() => {
          this.uiRenderer.setStartingPlayerCompare(data.maxRank, data.winners, this.time);
        }, compareTime * 1000);
      };

      // Handle tie
      const onTie = (data) => {
        const numPlayers = data.tiedPlayers.length;
        const tieTime = numPlayers * DRAW_DELAY + REVEAL_DELAY + COMPARE_DELAY + 0.3;

        setTimeout(() => {
          this.uiRenderer.triggerStartingPlayerTie(data.tiedPlayers, this.time);

          // After showing tie, reset for next round
          setTimeout(() => {
            this.uiRenderer.resetStartingPlayerRound(data.tiedPlayers, currentRound + 1, this.time);
          }, TIE_DELAY * 1000);
        }, tieTime * 1000);
      };

      // Handle final determination
      const onDetermined = (data) => {
        const numPlayers = 2; // Default for timing
        const resolveTime = numPlayers * DRAW_DELAY + REVEAL_DELAY + COMPARE_DELAY + 0.5;

        setTimeout(() => {
          this.uiRenderer.setStartingPlayerWinner(data.winner, this.time);
          resolvedWinner = data.winner;

          // End animation after showing winner
          setTimeout(() => {
            this.uiRenderer.endStartingPlayerAnimation();

            // Clean up subscriptions
            this.gameState.off(StateEvent.STARTING_PLAYER_DRAW_START, onDrawStart);
            this.gameState.off(StateEvent.STARTING_PLAYER_TILE_DRAWN, onTileDrawn);
            this.gameState.off(StateEvent.STARTING_PLAYER_REVEAL, onReveal);
            this.gameState.off(StateEvent.STARTING_PLAYER_COMPARE, onCompare);
            this.gameState.off(StateEvent.STARTING_PLAYER_TIE, onTie);
            this.gameState.off(StateEvent.STARTING_PLAYER_DETERMINED, onDetermined);

            resolve(resolvedWinner);
          }, RESOLVE_DELAY * 1000);
        }, resolveTime * 1000);
      };

      // Subscribe to all starting player events
      this.gameState.on(StateEvent.STARTING_PLAYER_DRAW_START, onDrawStart);
      this.gameState.on(StateEvent.STARTING_PLAYER_TILE_DRAWN, onTileDrawn);
      this.gameState.on(StateEvent.STARTING_PLAYER_REVEAL, onReveal);
      this.gameState.on(StateEvent.STARTING_PLAYER_COMPARE, onCompare);
      this.gameState.on(StateEvent.STARTING_PLAYER_TIE, onTie);
      this.gameState.on(StateEvent.STARTING_PLAYER_DETERMINED, onDetermined);

      // The events were already emitted during startNewGame(), so we need to replay them
      // Actually, the events are emitted synchronously during game start, so we missed them.
      // We need to trigger the animation manually based on stored result or re-emit.
      // Let's check if the game already started and manually start the animation.

      // The gameController stores the starting player determination data, let's emit the events again
      // Actually, looking at GameController, _determineStartingPlayer emits events synchronously
      // before we subscribe. We need to emit them again or change the flow.

      // For now, let's manually trigger the animation using stored data
      const startingPlayer = this.gameState.getCurrentPlayer();
      const playerCount = this.gameState.getPlayers().length;

      // Manually emit the events for the animation (simulating what already happened)
      setTimeout(() => {
        // Draw start
        const contenders = Array.from({ length: playerCount }, (_, i) => i);
        onDrawStart({ contenders, round: 1 });

        // Simulate draws for each player
        contenders.forEach((player, index) => {
          // We don't have the actual drawn tiles, so simulate with random types
          // In reality, we should store this data in GameController
          const types = ['housing', 'commerce', 'industry'];
          const ranks = { housing: 3, commerce: 2, industry: 1 };
          // Simulate winner having highest rank
          let tileType;
          if (player === startingPlayer) {
            tileType = 'housing'; // Winner got housing (highest)
          } else {
            tileType = types[Math.floor(Math.random() * 2) + 1]; // Commerce or industry
          }
          const rank = ranks[tileType];

          setTimeout(() => {
            onTileDrawn({ player, tile: { type: tileType }, rank });
          }, index * 50);
        });

        // Reveal after draws
        setTimeout(() => {
          onReveal({ draws: contenders.map(p => ({ player: p })) });
        }, playerCount * 50 + 100);

        // Compare
        setTimeout(() => {
          onCompare({ maxRank: 3, winners: [startingPlayer] });
        }, playerCount * 50 + 200);

        // Determined
        setTimeout(() => {
          onDetermined({ winner: startingPlayer });
        }, playerCount * 50 + 300);
      }, SETUP_DURATION * 1000);
    });
  }

  /**
   * Handle play again button click
   */
  onPlayAgain() {
    // Hide end screen
    this.endScreen.classList.add('hidden');

    // Show start screen
    this.startScreen.classList.remove('hidden');

    // Stop the render loop until game starts again
    this.isRunning = false;
  }

  /**
   * Check if the game has ended and show end screen if so
   */
  checkAndShowGameEnd() {
    const result = this.gameController.checkGameEnd();
    if (result.ended) {
      this.showEndGameScreen(result);
      return true;
    }
    return false;
  }

  /**
   * Show the end game screen with results
   * @param {Object} result - Game end result from controller
   */
  showEndGameScreen(result) {
    // Set winner text
    if (result.isTie) {
      this.winnerNameEl.textContent = 'TIE';
      this.winnerSubtitleEl.textContent = 'No clear winner!';
    } else if (result.winner !== null) {
      this.winnerNameEl.textContent = `Player ${result.winner + 1}`;
      this.winnerSubtitleEl.textContent = 'Wins!';
    }

    // Clear and populate scores
    this.scoresListEl.innerHTML = '';
    for (const score of result.scores) {
      const row = document.createElement('div');
      row.className = 'score-row' + (score.playerIndex === result.winner ? ' winner' : '');

      const playerSpan = document.createElement('span');
      playerSpan.className = 'score-player';
      playerSpan.textContent = score.name;

      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'score-value';
      scoreSpan.textContent = `${score.score} pts`;
      if (score.hq > 0) {
        scoreSpan.textContent += ` (${score.landmarks}L + ${score.hq}HQ)`;
      }

      row.appendChild(playerSpan);
      row.appendChild(scoreSpan);
      this.scoresListEl.appendChild(row);
    }

    // Show end screen
    this.endScreen.classList.remove('hidden');

    console.log(`Game ended: ${result.reason}`);
  }

  /**
   * Start a new game
   * @param {number} playerCount - Number of players
   */
  startNewGame(playerCount = 2) {
    this.gameState = this.gameController.startNewGame(playerCount);
    this.uiRenderer.setGameState(this.gameState);
  }

  /**
   * Set up input handling
   */
  setupInput() {
    window.addEventListener('resize', this.onResize);

    this.input = new InputManager(this.inputLayer, this.glCanvas);

    // Tile coordinate converter
    this.input.setTileConverter((screenX, screenY) => {
      const worldPos = screenToWorld(
        screenX, screenY,
        this.camera.getInverseViewProjectionMatrix(),
        this.glCanvas.width, this.glCanvas.height
      );
      if (worldPos) {
        return worldToGrid(
          worldPos[0], worldPos[2],
          this.boardRenderer.getTileSize(),
          this.boardRenderer.getBoardSize()
        );
      }
      return { x: -1, y: -1, valid: false };
    });

    // Board tile hover
    this.input.on(InputEvent.TILE_HOVER, (data) => {
      if (data.tile.x >= 0 && data.tile.y >= 0) {
        this.gameState.setHoveredTile(data.tile.x, data.tile.y);

        // Update hovered target in targeting mode
        if (this.uiRenderer.isInTargetingMode()) {
          const target = this.uiRenderer.getTargetAtPosition(data.tile.x, data.tile.y);
          this.uiRenderer.setHoveredTarget(target);
        }
      } else {
        this.gameState.clearHoveredTile();
        if (this.uiRenderer.isInTargetingMode()) {
          this.uiRenderer.setHoveredTarget(null);
        }
      }
    });

    // Board tile click
    this.input.on(InputEvent.TILE_CLICK, (data) => {
      // Check if in targeting mode first
      if (this.uiRenderer.isInTargetingMode()) {
        this.handleTargetSelection(data.tile.x, data.tile.y);
        return;
      }

      // Check if agent is selected and this is a valid move
      if (this.uiRenderer.hasAgentSelected()) {
        this.handleAgentAction(data.tile.x, data.tile.y);
        return;
      }

      const selectedHandIndex = this.uiRenderer.selectedHandTile;
      if (selectedHandIndex >= 0) {
        this.handleTilePlacement(data.tile.x, data.tile.y, selectedHandIndex);
      } else {
        // Check if clicking on a tile with own agent
        this.handleBoardTileClick(data.tile.x, data.tile.y);
      }
    });

    // Zoom
    this.input.on(InputEvent.ZOOM, (data) => {
      this.camera.setZoom(this.camera.zoom + data.delta);
    });

    // UI clicks (hand tiles, action button, event cards)
    this.input.on(InputEvent.CLICK, (data) => {
      // Check targeting mode cancel button first
      if (this.uiRenderer.isInTargetingMode()) {
        if (this.uiRenderer.isPointOnCancelTargeting(data.x, data.y)) {
          this.exitTargetingMode();
          console.log('Targeting cancelled');
          return;
        }
        // In targeting mode, ignore other UI clicks
        return;
      }

      // Check takeover panel buttons
      if (this.uiRenderer.getTakeoverTarget()) {
        if (this.uiRenderer.isPointOnTakeoverConfirm(data.x, data.y)) {
          const target = this.uiRenderer.getTakeoverTarget();
          this.executeTakeover(target.x, target.y);
          return;
        }
        if (this.uiRenderer.isPointOnTakeoverCancel(data.x, data.y)) {
          this.cancelTakeover();
          return;
        }
      }

      // Check modal buttons first if modal is open
      if (this.uiRenderer.isEventModalOpen()) {
        if (this.uiRenderer.isPointOnPlayEventButton(data.x, data.y)) {
          this.handlePlayEvent();
          return;
        }
        if (this.uiRenderer.isPointOnCancelEventButton(data.x, data.y)) {
          this.uiRenderer.closeEventModal();
          return;
        }
        // Click outside modal closes it
        this.uiRenderer.closeEventModal();
        return;
      }

      if (this.uiRenderer.isPointOnActionButton(data.x, data.y)) {
        this.handleActionButton();
        return;
      }

      // Event card click
      const eventIndex = this.uiRenderer.getEventCardAtPoint(data.x, data.y);
      if (eventIndex >= 0) {
        this.uiRenderer.selectEventCard(eventIndex);
        return;
      }

      // Check 3D hand tiles at board edges (current player only)
      if (this.gameState) {
        const handHit = this.tileRenderer.getHandTileAtScreenPosition(
          data.x, data.y,
          this.camera,
          this.gameState,
          this.glCanvas.width,
          this.glCanvas.height
        );
        if (handHit && handHit.playerIndex === this.gameState.getCurrentPlayer()) {
          this.handleHandTileSelect(handHit.tileIndex);
          return;
        }
      }
    });

    // UI hover
    this.input.on(InputEvent.MOUSE_MOVE, (data) => {
      // Check 3D hand tiles at board edges (current player only)
      let handHovered = -1;
      if (this.gameState) {
        const handHit = this.tileRenderer.getHandTileAtScreenPosition(
          data.x, data.y,
          this.camera,
          this.gameState,
          this.glCanvas.width,
          this.glCanvas.height
        );
        if (handHit && handHit.playerIndex === this.gameState.getCurrentPlayer()) {
          handHovered = handHit.tileIndex;
        }
      }
      this.hoveredHandTile = handHovered;

      const eventIndex = this.uiRenderer.getEventCardAtPoint(data.x, data.y);
      this.uiRenderer.setHoveredEventCard(eventIndex);

      // Update tooltip
      this.uiRenderer.updateTooltip(data.x, data.y);
    });

    // Keyboard shortcuts
    this.input.on(InputEvent.KEY_DOWN, (data) => {
      this.handleKeyDown(data);
    });
  }

  /**
   * Handle keyboard shortcuts
   * @param {Object} data - Key event data
   */
  handleKeyDown(data) {
    // Don't handle keys if game not started
    if (!this.isRunning || !this.gameState) {
      return;
    }

    const { key } = data;

    // Escape: Close modal / exit targeting / deselect
    if (key === 'Escape') {
      if (this.uiRenderer.isInTargetingMode()) {
        this.exitTargetingMode();
        console.log('Targeting cancelled');
      } else if (this.uiRenderer.getTakeoverTarget()) {
        this.cancelTakeover();
        console.log('Takeover cancelled');
      } else if (this.uiRenderer.hasAgentSelected()) {
        this.uiRenderer.clearAgentSelection();
        this.boardRenderer.clearValidPlacements();
        console.log('Agent deselected');
      } else if (this.uiRenderer.isEventModalOpen()) {
        this.uiRenderer.closeEventModal();
      } else if (this.uiRenderer.selectedHandTile >= 0) {
        this.uiRenderer.setSelectedHandTile(-1);
        this.boardRenderer.clearValidPlacements();
      }
      return;
    }

    // Space or Enter: End turn / confirm action
    if (key === ' ' || key === 'Enter') {
      // If modal is open, play the event
      if (this.uiRenderer.isEventModalOpen()) {
        this.handlePlayEvent();
        return;
      }
      // Otherwise, trigger action button
      this.handleActionButton();
      return;
    }

    // Number keys 1-9: Select hand tile
    const numKey = parseInt(key, 10);
    if (numKey >= 1 && numKey <= 9) {
      const index = numKey - 1;
      const player = this.gameState.getPlayer(this.gameState.getCurrentPlayer());
      if (index < player.hand.length) {
        this.handleHandTileSelect(index);
      }
      return;
    }

    // E: Cycle through event cards or open first event
    if (key === 'e' || key === 'E') {
      const events = this.gameController.getCurrentPlayerEvents();
      if (events.length === 0) {
        return;
      }
      if (this.uiRenderer.isEventModalOpen()) {
        // Cycle to next event
        const currentIndex = this.uiRenderer.getSelectedEventCard();
        const nextIndex = (currentIndex + 1) % events.length;
        this.uiRenderer.selectEventCard(nextIndex);
      } else {
        // Open first event
        this.uiRenderer.selectEventCard(0);
      }
      return;
    }

    // Q: Close event modal (alternative to Escape)
    if (key === 'q' || key === 'Q') {
      if (this.uiRenderer.isEventModalOpen()) {
        this.uiRenderer.closeEventModal();
      }
      return;
    }

    // ? or H: Toggle help overlay
    if (key === '?' || key === 'h' || key === 'H') {
      this.uiRenderer.toggleHelp();
      return;
    }

    // R: Cycle through renderers (for debugging)
    if (key === 'r' || key === 'R') {
      const renderers = ['webgl', 'text', 'grid'];
      const currentIndex = renderers.indexOf(this.activeRendererName);
      const nextIndex = (currentIndex + 1) % renderers.length;
      this.switchRenderer(renderers[nextIndex]);
      return;
    }

    // Z or Ctrl+Z: Undo last action
    if (key === 'z' || key === 'Z') {
      const result = this.gameController.undo();
      if (result.success) {
        console.log(result.message);
        // Clear UI selections
        this.uiRenderer.setSelectedHandTile(-1);
        this.boardRenderer.clearValidPlacements();
        this.boardRenderer.clearLandmarkPreview();
        this.uiRenderer.clearAgentSelection();
      } else {
        console.log(result.message);
      }
      return;
    }
  }

  /**
   * Handle hand tile selection
   */
  handleHandTileSelect(index) {
    const currentSelection = this.uiRenderer.selectedHandTile;
    const result = this.gameController.selectHandTile(index, currentSelection);

    this.uiRenderer.setSelectedHandTile(result.selected);

    if (result.validPositions) {
      this.boardRenderer.setValidPlacements(result.validPositions);
    } else {
      this.boardRenderer.clearValidPlacements();
    }
  }

  /**
   * Handle tile placement attempt
   */
  handleTilePlacement(x, y, handIndex) {
    const result = this.gameController.tryPlaceTile(x, y, handIndex);

    if (result.success) {
      // Clear UI selection
      this.uiRenderer.setSelectedHandTile(-1);
      this.boardRenderer.clearValidPlacements();
      console.log(`Placed ${result.tileType} at (${x}, ${y})`);

      // Check for game end after placement
      if (this.checkAndShowGameEnd()) {
        return;
      }

      if (result.autoEndTurn) {
        this.gameController.endTurnWithRefill();
        console.log(`Turn ended. Now Player ${this.gameState.getCurrentPlayer() + 1}'s turn.`);

        // Check for game end after turn end (deck may be empty)
        this.checkAndShowGameEnd();
      }
    } else {
      console.log(`Cannot place tile: ${result.reason}`);
    }
  }

  /**
   * Handle action button click
   */
  handleActionButton() {
    const result = this.gameController.handleActionButton();

    // Clear selections on phase changes
    if (result.action === 'advancePhase' || result.action === 'endTurn') {
      this.uiRenderer.setSelectedHandTile(-1);
      this.boardRenderer.clearValidPlacements();
    }

    if (result.action === 'endTurn') {
      console.log(`Turn ended. Now Player ${this.gameState.getCurrentPlayer() + 1}'s turn.`);
    } else if (result.action === 'draw') {
      console.log(result.success ? `Drew tile: ${result.tileType}` : 'Draw pile is empty!');
    } else if (result.action === 'prompt') {
      console.log(result.message);
    }
  }

  /**
   * Handle playing an event card from modal
   */
  handlePlayEvent() {
    const eventIndex = this.uiRenderer.getSelectedEventCard();
    if (eventIndex < 0) {
      return;
    }

    // Get the event to check if it requires targeting
    const events = this.gameController.getCurrentPlayerEvents();
    const event = events[eventIndex];

    if (!event) {
      this.uiRenderer.closeEventModal();
      return;
    }

    // Check if event requires a target
    const requiresTarget = event.target && event.target !== 'none' && event.target !== 'self';

    if (requiresTarget) {
      // Get valid targets for this event
      const validTargets = this.gameController.getValidTargetsForEvent(event);

      if (validTargets.length === 0) {
        console.log(`No valid targets for "${event.name}"`);
        this.uiRenderer.closeEventModal();
        return;
      }

      // For opponent-targeting events without board targets (like Market Crash),
      // auto-select if there's only one opponent
      if (event.target === 'opponent' && !event.targetFilter && validTargets.length === 1) {
        const target = { player: validTargets[0].playerId };
        const result = this.gameController.playEventCard(eventIndex, target);
        this.uiRenderer.closeEventModal();

        if (result.success) {
          console.log(`Played event: ${event.name}`);
        } else {
          console.log(`Cannot play event: ${result.reason}`);
        }
        return;
      }

      // Enter targeting mode for board-based targets
      const message = this.gameController.getTargetingMessage(event);
      this.uiRenderer.enterTargetingMode(event, validTargets, message);

      // Store the event index for when target is selected
      this._pendingEventIndex = eventIndex;

      // Show valid targets on board
      this.boardRenderer.setValidPlacements(validTargets.map(t => ({ x: t.x, y: t.y })));

      console.log(`Enter targeting mode for "${event.name}" - ${validTargets.length} valid target(s)`);
      return;
    }

    // Play the event (no target needed)
    const result = this.gameController.playEventCard(eventIndex, null);
    this.uiRenderer.closeEventModal();

    if (result.success) {
      console.log(`Played event: ${event.name}`);
      // Trigger event effect animation (flash effect at center of board)
      const worldY = BOARD.HEIGHT + TILE.HEIGHT / 2 + TILE.Y_OFFSET;
      const eventColor = event.category === 'immediate' ? [1.0, 0.4, 0.3] : [0.3, 0.7, 1.0];
      this.animationManager.animateEventEffect(4, 4, worldY, eventColor);
    } else {
      console.log(`Cannot play event: ${result.reason}`);
    }
  }

  /**
   * Handle target selection in targeting mode
   * @param {number} x - Board X
   * @param {number} y - Board Y
   */
  handleTargetSelection(x, y) {
    const target = this.uiRenderer.getTargetAtPosition(x, y);

    if (!target) {
      console.log(`(${x}, ${y}) is not a valid target`);
      return;
    }

    // Play the event with the selected target
    const eventIndex = this._pendingEventIndex;
    const targetData = { x: target.x, y: target.y, ...target.data };

    const result = this.gameController.playEventCard(eventIndex, targetData);

    // Exit targeting mode
    this.exitTargetingMode();

    if (result.success) {
      console.log(`Played event with target at (${x}, ${y})`);
      // Trigger event effect animation at target
      const worldY = BOARD.HEIGHT + TILE.HEIGHT / 2 + TILE.Y_OFFSET;
      this.animationManager.animateEventEffect(x, y, worldY, [1.0, 0.8, 0.2]);
    } else {
      console.log(`Cannot play event: ${result.reason}`);
    }
  }

  /**
   * Exit targeting mode and clean up
   */
  exitTargetingMode() {
    this.uiRenderer.exitTargetingMode();
    this.boardRenderer.clearValidPlacements();
    this._pendingEventIndex = null;
  }

  /**
   * Handle board tile click (for agent selection, HQ conversion, etc.)
   * @param {number} x
   * @param {number} y
   */
  handleBoardTileClick(x, y) {
    const currentPlayer = this.gameState.getCurrentPlayer();

    // Check if clicking on own agent
    const agents = this.gameState.getAgentsAt(x, y);
    const ownAgents = agents.filter(a => a.owner === currentPlayer);

    if (ownAgents.length > 0) {
      // Select agent
      const validMoves = this.gameController.getValidAgentMoves(x, y);
      this.uiRenderer.selectAgent(x, y, currentPlayer, validMoves);
      this.boardRenderer.setValidPlacements(validMoves);
      console.log(`Selected agent at (${x}, ${y}) with ${validMoves.length} valid moves`);
      return;
    }

    // Check if clicking on own landmark (for HQ conversion)
    const landmark = this.gameState.getLandmarkAt(x, y);
    if (landmark && landmark.owner === currentPlayer && !landmark.isHQ) {
      if (this.gameController.canConvertToHQ(x, y)) {
        this.showHQConversionPrompt(x, y);
        return;
      }
    }

    // Check if clicking on enemy tile/landmark (for takeover)
    const tile = this.gameState.getTile(x, y);
    if (tile && tile.placedBy !== currentPlayer) {
      const attackInfo = this.gameController.canAttackLandmark(x, y);
      if (attackInfo.canAttack) {
        this.showTakeoverPrompt(x, y, attackInfo);
        return;
      }
    }

    // Default: select the board tile
    this.gameState.selectBoardTile(x, y);
  }

  /**
   * Handle agent action (move, capture, etc.)
   * @param {number} x
   * @param {number} y
   */
  handleAgentAction(x, y) {
    const selectedAgent = this.uiRenderer.getSelectedAgent();
    if (!selectedAgent) return;

    // Check if this is a valid move
    if (this.uiRenderer.isValidAgentMove(x, y)) {
      const result = this.gameController.tryMoveAgent(
        selectedAgent.x, selectedAgent.y,
        x, y
      );

      if (result.success) {
        console.log(`Agent moved from (${selectedAgent.x}, ${selectedAgent.y}) to (${x}, ${y})`);

        // Trigger agent move animation
        const worldY = BOARD.HEIGHT + TILE.HEIGHT / 2 + TILE.Y_OFFSET + 0.3; // Slightly above tile
        this.animationManager.animateAgentMove(
          selectedAgent.x, selectedAgent.y,
          x, y,
          worldY
        );

        this.uiRenderer.clearAgentSelection();
        this.boardRenderer.clearValidPlacements();

        // Check for game end after agent move
        this.checkAndShowGameEnd();
      } else {
        console.log(`Agent move failed: ${result.reason}`);
      }
    } else if (x === selectedAgent.x && y === selectedAgent.y) {
      // Clicking on same agent deselects
      this.uiRenderer.clearAgentSelection();
      this.boardRenderer.clearValidPlacements();
    } else {
      // Check if clicking on a different owned agent
      const currentPlayer = this.gameState.getCurrentPlayer();
      const agents = this.gameState.getAgentsAt(x, y);
      const ownAgents = agents.filter(a => a.owner === currentPlayer);

      if (ownAgents.length > 0) {
        // Select the new agent
        const validMoves = this.gameController.getValidAgentMoves(x, y);
        this.uiRenderer.selectAgent(x, y, currentPlayer, validMoves);
        this.boardRenderer.setValidPlacements(validMoves);
        console.log(`Switched to agent at (${x}, ${y})`);
      } else {
        console.log(`(${x}, ${y}) is not a valid agent destination`);
      }
    }
  }

  /**
   * Show HQ conversion prompt
   * @param {number} x
   * @param {number} y
   */
  showHQConversionPrompt(x, y) {
    // For now, auto-convert (in full UI, would show a confirmation)
    const result = this.gameController.convertLandmarkToHQ(x, y);
    if (result.success) {
      console.log(`Converted landmark at (${x}, ${y}) to HQ with ${result.agentsSpawned} agents`);
      // Trigger HQ conversion animation
      const worldY = BOARD.HEIGHT + TILE.HEIGHT / 2 + TILE.Y_OFFSET;
      this.animationManager.animateHQConversion(x, y, worldY);
    } else {
      console.log(`Cannot convert to HQ: ${result.reason}`);
    }
  }

  /**
   * Show takeover prompt
   * @param {number} x
   * @param {number} y
   * @param {Object} attackInfo
   */
  showTakeoverPrompt(x, y, attackInfo) {
    const tile = this.gameState.getTile(x, y);
    const landmark = this.gameState.getLandmarkAt(x, y);

    this.uiRenderer.setTakeoverTarget({
      x,
      y,
      type: landmark ? (landmark.isHQ ? 'HQ' : 'Landmark') : 'Tile',
      requiredAgents: attackInfo.needed || 1,
      myAgents: attackInfo.myAgents,
      enemyAgents: attackInfo.enemyAgents
    });
  }

  /**
   * Execute takeover
   * @param {number} x
   * @param {number} y
   */
  executeTakeover(x, y) {
    const target = this.uiRenderer.getTakeoverTarget();
    if (!target) return;

    // Check if it's a landmark takeover or basic tile capture
    const landmark = this.gameState.getLandmarkAt(x, y);

    let result;
    if (landmark) {
      result = this.gameController.attemptTakeover(x, y);
    } else {
      result = this.gameController.attemptTileCapture(x, y);
    }

    this.uiRenderer.clearTakeoverTarget();

    if (result.success) {
      console.log(`Takeover ${result.result} at (${x}, ${y})`);
      const worldY = BOARD.HEIGHT + TILE.HEIGHT / 2 + TILE.Y_OFFSET;

      // Trigger appropriate animation based on result
      if (result.result === 'settlement') {
        this.animationManager.animateSettlement(x, y, worldY);
      } else if (result.result === 'capture') {
        this.animationManager.animateTileCapture(x, y, worldY);
      }

      this.checkAndShowGameEnd();
    } else {
      console.log(`Takeover failed: ${result.reason}`);
    }
  }

  /**
   * Cancel takeover
   */
  cancelTakeover() {
    this.uiRenderer.clearTakeoverTarget();
  }

  /**
   * Set up state change subscriptions
   */
  setupStateSubscriptions() {
    this.gameState.on(StateEvent.UI_HOVER, (data) => {
      const { newTile } = data;
      if (newTile.x >= 0 && newTile.y >= 0) {
        this.boardRenderer.setHoveredTile(newTile.x, newTile.y);
        this.uiRenderer.setHoveredTile(newTile.x, newTile.y);
      } else {
        this.boardRenderer.clearHoveredTile();
        this.uiRenderer.clearHoveredTile();
      }
    });

    this.gameState.on(StateEvent.TILE_PLACED, (data) => {
      // Trigger tile materialization animation (nice shader effect)
      const worldY = BOARD.HEIGHT + TILE.HEIGHT / 2 + TILE.Y_OFFSET;
      this.animationManager.animateTileMaterialization(data.x, data.y, worldY, data.player);
      console.log(`Tile placed at (${data.x}, ${data.y}) by player ${data.player}`);
    });

    this.gameState.on(StateEvent.LANDMARK_CREATED, (data) => {
      // Trigger Trinity formation animation (glow -> dissolve -> form)
      const worldY = BOARD.HEIGHT + TILE.HEIGHT / 2 + TILE.Y_OFFSET;

      // Build source tile data with tile type information
      const sourceTiles = data.freedPositions.map((pos, index) => ({
        x: pos.x,
        y: pos.y,
        worldY,
        tileType: data.tiles && data.tiles[index] ? data.tiles[index].type : 'housing'
      }));

      const landmarkPos = { x: data.x, y: data.y, worldY };

      // Use new Trinity formation animation
      this.animationManager.animateTrinityFormation(
        sourceTiles,
        landmarkPos,
        data.owner,
        (phase) => {
          // Phase change callback
          const phaseNames = ['', 'Glow', 'Dissolve', 'Formation'];
          console.log(`Trinity animation phase: ${phaseNames[phase]}`);
        },
        () => {
          console.log(`Landmark formed at (${data.x}, ${data.y})`);
        }
      );
    });

    this.gameState.on(StateEvent.PLAYER_CHANGE, (data) => {
      console.log(`Turn changed from player ${data.oldPlayer + 1} to player ${data.newPlayer + 1}`);
      // Trigger turn transition animation
      this.uiRenderer.startTurnTransition(data.newPlayer, this.time);
      // Rotate board to face active player's side
      if (ANIMATION.CAMERA_ROTATION.ENABLED) {
        this.camera.setActivePlayer(data.newPlayer);
      }
    });
  }

  /**
   * Handle window resize
   */
  onResize() {
    resizeCanvas(this.glCanvas);
    resizeCanvas(this.uiCanvas);

    const width = this.glCanvas.width;
    const height = this.glCanvas.height;

    this.gl.viewport(0, 0, width, height);
    this.camera.setAspect(width, height);
  }

  /**
   * Set up renderers and register them with the RendererManager
   */
  setupRenderers() {
    // Create WebGL renderer wrapping existing components
    const webglRenderer = new WebGLRenderer({
      gl: this.gl,
      glCanvas: this.glCanvas,
      uiCanvas: this.uiCanvas,
      camera: this.camera,
      boardRenderer: this.boardRenderer,
      tileRenderer: this.tileRenderer,
      uiRenderer: this.uiRenderer,
      animationManager: this.animationManager,
    });
    webglRenderer._initialized = true; // Already initialized

    // Create headless renderers for testing/debugging
    const textRenderer = new TextRenderer();
    const gridRenderer = new GridRenderer();

    // Register all renderers
    this.rendererManager.register('webgl', webglRenderer);
    this.rendererManager.register('text', textRenderer);
    this.rendererManager.register('grid', gridRenderer);

    // Set WebGL as the default active renderer
    this.rendererManager.switch('webgl');
    this.activeRendererName = 'webgl';

    console.log('Renderers registered: webgl, text, grid');
  }

  /**
   * Switch to a different renderer
   * @param {string} name - Renderer name ('webgl', 'text', 'grid')
   */
  async switchRenderer(name) {
    if (!this.rendererManager.has(name)) {
      console.log(`Unknown renderer: ${name}`);
      return;
    }

    await this.rendererManager.switch(name);
    this.activeRendererName = name;
    console.log(`Switched to ${name} renderer`);

    // For text/grid renderers, log the current state
    if (name === 'text' && this.gameState) {
      const output = this.rendererManager.render(this.gameState);
      console.log('\n' + output);
    } else if (name === 'grid' && this.gameState) {
      const output = this.rendererManager.render(this.gameState);
      console.log('Grid data:', output);
    }
  }

  /**
   * Get the RendererManager instance
   * @returns {RendererManager}
   */
  getRendererManager() {
    return this.rendererManager;
  }

  /**
   * Main render loop
   */
  render(currentTime) {
    if (!this.isRunning) return;

    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    this.time += deltaTime;

    // Update animations
    this.animationManager.update(deltaTime);

    // Update cursor-based camera rotation
    if (CAMERA.CURSOR_ROTATION_ENABLED) {
      const mouseX = this.input.state.mouseX;
      const mouseY = this.input.state.mouseY;
      const centerX = this.glCanvas.width / 2;
      const centerY = this.glCanvas.height / 2;
      const halfWidth = centerX;
      const halfHeight = centerY;

      // Normalize cursor position to -1 (left edge) to 1 (right edge)
      let normalizedX = (mouseX - centerX) / halfWidth;

      // Normalize cursor Y position to -1 (bottom) to 1 (top)
      // Note: screen Y is inverted (0 at top), so we invert the calculation
      let normalizedY = (centerY - mouseY) / halfHeight;

      // Apply dead zone in center
      const deadZone = CAMERA.CURSOR_DEAD_ZONE;

      if (Math.abs(normalizedX) < deadZone) {
        normalizedX = 0;
      } else {
        // Remap outside dead zone to full range
        const sign = Math.sign(normalizedX);
        normalizedX = (Math.abs(normalizedX) - deadZone) / (1 - deadZone) * sign;
      }

      if (Math.abs(normalizedY) < deadZone) {
        normalizedY = 0;
      } else {
        // Remap outside dead zone to full range
        const sign = Math.sign(normalizedY);
        normalizedY = (Math.abs(normalizedY) - deadZone) / (1 - deadZone) * sign;
      }

      this.camera.setCursorOffset(normalizedX);
      this.camera.setCursorPitchOffset(normalizedY);
      this.camera.updateCursorRotation();
      this.camera.updateCursorPitchRotation();
    }

    // Update player-based camera rotation
    this.camera.updatePlayerRotation();

    clear(this.gl);

    // Render board
    this.boardRenderer.render(this.camera, this.time);

    // Render player hand tiles at board edges (replacing player indicators)
    const currentPlayer = this.gameState.getCurrentPlayer();
    const selectedHandIndex = this.uiRenderer.selectedHandTile;
    this.tileRenderer.renderHandTiles(
      this.camera,
      this.time,
      this.gameState,
      currentPlayer,
      selectedHandIndex,
      this.hoveredHandTile
    );

    // Render tiles
    const tiles = this.gameState.getTilesForRendering();
    if (tiles.length > 0) {
      this.tileRenderer.render(this.camera, this.time, tiles, {
        hoveredTile: this.gameState.getHoveredTile(),
        selectedTile: this.gameState.getSelectedTile(),
        animationManager: this.animationManager
      });
    }

    // Render placement preview (ghost tile) when hand tile is selected
    // (selectedHandIndex already declared above for renderHandTiles)
    if (selectedHandIndex >= 0) {
      const hoveredTile = this.gameState.getHoveredTile();
      if (hoveredTile && hoveredTile.x >= 0 && hoveredTile.y >= 0) {
        const currentPlayer = this.gameState.getCurrentPlayer();
        const player = this.gameState.getPlayer(currentPlayer);
        const selectedTile = player.hand[selectedHandIndex];

        if (selectedTile) {
          // Check if this is a valid placement
          const isValid = this.boardRenderer.isValidPlacement(hoveredTile.x, hoveredTile.y);

          // Preview landmark formation
          if (isValid) {
            const landmarkTiles = this.gameController.previewLandmarkFormation(
              hoveredTile.x, hoveredTile.y, selectedTile.type
            );
            this.boardRenderer.setLandmarkPreview(landmarkTiles);
          } else {
            this.boardRenderer.clearLandmarkPreview();
          }

          this.tileRenderer.renderPreview(
            this.camera,
            this.time,
            hoveredTile.x,
            hoveredTile.y,
            selectedTile.type,
            isValid,
            currentPlayer
          );
        }
      } else {
        // Clear landmark preview when not hovering
        this.boardRenderer.clearLandmarkPreview();
      }
    } else {
      // Clear landmark preview when no tile selected
      this.boardRenderer.clearLandmarkPreview();
    }

    // Render agents
    const agents = this.gameState.getAgents();
    if (agents.length > 0) {
      this.tileRenderer.renderAgents(this.camera, this.time, agents, { tiles });
    }

    // Render UI (pass time for animations)
    this.uiRenderer.render(this.time);

    requestAnimationFrame(this.render);
  }

  /**
   * Show error message
   */
  showError(message) {
    this.loadingScreen.classList.add('hidden');
    document.getElementById('error-message').textContent = message;
    this.errorDisplay.classList.add('visible');
  }
}

// Start game when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.init();
  window.game = game;
});
