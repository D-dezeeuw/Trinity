/**
 * Trinity - UI Renderer
 * Handles all 2D Canvas overlay rendering (text, HUD, menus)
 */

import { UI, ANIMATION } from '../config.js';
import { TileProperties } from '../game/TileTypes.js';
import { EventCategory } from '../game/EventCards.js';
import { pointInRect } from '../utils/math.js';

export class UIRenderer {
  /**
   * @param {HTMLCanvasElement} canvas - The 2D canvas for UI overlay
   */
  constructor(canvas) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');

    // UI state (can be updated externally)
    this._hoveredTile = { x: -1, y: -1 };

    // Game state (set externally)
    this._gameState = null;

    // Hand interaction state
    this._hoveredHandTile = -1;
    this._selectedHandTile = -1;

    // Cached hand tile bounds for click detection
    this._handTileBounds = [];

    // Action button bounds
    this._actionButtonBounds = null;

    // Event card interaction state
    this._hoveredEventCard = -1;
    this._selectedEventCard = -1;
    this._eventCardBounds = [];
    this._showEventModal = false;

    // Play event button bounds
    this._playEventButtonBounds = null;
    this._cancelEventButtonBounds = null;

    // Event targeting mode state
    this._targetingMode = false;
    this._targetingEvent = null;
    this._targetingValidTargets = [];
    this._hoveredTarget = null;
    this._targetingMessage = '';

    // Agent phase UI state
    this._selectedAgent = null; // { x, y, owner }
    this._validAgentMoves = [];
    this._agentMode = null; // 'move', 'capture', 'reposition', 'takeover'

    // HQ conversion state
    this._convertibleLandmarks = [];

    // Takeover UI state
    this._takeoverTarget = null;

    // Turn transition animation state
    this._turnTransition = {
      active: false,
      playerIndex: 0,
      startTime: 0,
      duration: 1.5, // seconds
      phase: 'in', // 'in', 'hold', 'out'
    };

    // Tooltip state
    this._tooltip = {
      visible: false,
      x: 0,
      y: 0,
      text: '',
      title: '',
      width: 0,
    };

    // Help overlay state
    this._helpVisible = false;

    // Starting player determination animation state
    this._startingPlayerAnimation = {
      active: false,
      phase: 'idle',  // 'idle', 'setup', 'draw', 'reveal', 'compare', 'resolve', 'tie'
      startTime: 0,
      phaseStartTime: 0,
      round: 0,
      contenders: [],   // Array of player indices
      draws: [],        // { player, tileType, rank, revealed }
      winner: null,
      tiedPlayers: [],
    };
  }

  /**
   * Get the currently selected hand tile index
   * @returns {number} Selected tile index or -1 if none
   */
  get selectedHandTile() {
    return this._selectedHandTile;
  }

  /**
   * Set the game state reference
   * @param {GameState} gameState
   */
  setGameState(gameState) {
    this._gameState = gameState;
  }

  /**
   * Update the hovered tile display
   * @param {number} x
   * @param {number} y
   */
  setHoveredTile(x, y) {
    this._hoveredTile.x = x;
    this._hoveredTile.y = y;
  }

  /**
   * Clear hovered tile display
   */
  clearHoveredTile() {
    this._hoveredTile.x = -1;
    this._hoveredTile.y = -1;
  }

  /**
   * Render all UI elements
   * @param {number} currentTime - Current time in seconds (for animations)
   */
  render(currentTime = 0) {
    const ctx = this._ctx;
    const width = this._canvas.width;
    const height = this._canvas.height;

    // Clear UI canvas
    ctx.clearRect(0, 0, width, height);

    this._renderTitle(ctx);
    this._renderTileInfo(ctx, height);
    this._renderInstructions(ctx, width);

    // Game state dependent rendering
    if (this._gameState) {
      this._renderGameInfoPanel(ctx, width);
      // Hand tiles are now rendered in 3D at board edges (see TileRenderer.renderHandTiles)
      this._renderEventCards(ctx, width);

      // Render modal on top if open
      if (this._showEventModal && this._selectedEventCard >= 0) {
        this._renderEventModal(ctx, width, height);
      }

      // Render targeting overlay if in targeting mode
      if (this._targetingMode) {
        this._renderTargetingOverlay(ctx, width, height);
      }

      // Render agent phase panel if agent selected
      if (this._selectedAgent) {
        this._renderAgentPhasePanel(ctx, width, height);
      }

      // Render takeover panel if target selected
      if (this._takeoverTarget) {
        this._renderTakeoverPanel(ctx, width, height);
      }

      // Render turn transition overlay (on top of everything)
      if (this._turnTransition.active) {
        this._renderTurnTransition(ctx, width, height, currentTime);
      }

      // Render starting player determination animation (on top of turn transition)
      if (this._startingPlayerAnimation.active) {
        this._renderStartingPlayerAnimation(ctx, width, height, currentTime);
      }

      // Render tooltip (on top of everything except turn transition)
      if (!this._turnTransition.active) {
        this._renderTooltip(ctx, width, height);
      }

      // Render help overlay (on top of everything)
      this._renderHelpOverlay(ctx, width, height);
    }
  }

  /**
   * Render the game title
   * @private
   */
  _renderTitle(ctx) {
    ctx.fillStyle = UI.TITLE.COLOR;
    ctx.font = UI.TITLE.FONT;
    ctx.textAlign = 'left';
    ctx.fillText(UI.TITLE.TEXT, UI.TITLE.X, UI.TITLE.Y);
  }

  /**
   * Render hovered tile info
   * @private
   */
  _renderTileInfo(ctx, height) {
    const tile = this._hoveredTile;
    if (tile.x >= 0 && tile.y >= 0) {
      ctx.font = UI.TILE_INFO.FONT;
      ctx.fillStyle = UI.TILE_INFO.COLOR;
      ctx.fillText(
        `Tile: (${tile.x}, ${tile.y})`,
        UI.TILE_INFO.X,
        height - UI.TILE_INFO.Y_OFFSET
      );
    }
  }

  /**
   * Render control instructions
   * @private
   */
  _renderInstructions(ctx, width) {
    ctx.font = UI.INSTRUCTIONS.FONT;
    ctx.fillStyle = UI.INSTRUCTIONS.COLOR;
    ctx.textAlign = 'right';

    UI.INSTRUCTIONS.LINES.forEach((line, i) => {
      ctx.fillText(
        line,
        width - UI.INSTRUCTIONS.X_OFFSET,
        UI.INSTRUCTIONS.Y_START + i * UI.INSTRUCTIONS.LINE_HEIGHT
      );
    });
  }

  /**
   * Render the game info panel (top-left, below title)
   * @private
   */
  _renderGameInfoPanel(ctx, width) {
    const config = UI.INFO_PANEL;
    const x = 20;
    const y = 60;

    // Get game state info
    const currentPlayer = this._gameState.getCurrentPlayer();
    const players = this._gameState.getPlayers();
    const turn = this._gameState.getTurn();
    const turnPhase = turn.phase || 'draw';
    const drawPileCount = this._gameState.getDrawPileCount();

    // Background
    ctx.fillStyle = config.BG_COLOR;
    this._roundRect(ctx, x, y, config.WIDTH, config.HEIGHT, 8);
    ctx.fill();

    // Current player
    ctx.font = config.LABEL_FONT;
    ctx.fillStyle = config.SECONDARY_COLOR;
    ctx.textAlign = 'left';
    ctx.fillText('Current Player', x + config.PADDING, y + 25);

    ctx.font = config.VALUE_FONT;
    ctx.fillStyle = config.TEXT_COLOR;
    ctx.fillText(`Player ${currentPlayer + 1}`, x + config.PADDING, y + 45);

    // Turn Phase / Tiles to place
    ctx.font = config.LABEL_FONT;
    ctx.fillStyle = config.SECONDARY_COLOR;

    // Get turn info from game state (decoupled from GameRules)
    const turnInfo = this._gameState.getTurnInfo();

    if (turnInfo.isSimpleMode) {
      ctx.fillText('Action', x + config.PADDING, y + 70);
      const remaining = turnInfo.tilesRemaining;

      ctx.font = config.VALUE_FONT;
      ctx.fillStyle = remaining > 0 ? 'rgba(100, 255, 150, 1.0)' : 'rgba(150, 150, 150, 1.0)';
      ctx.fillText(remaining > 0 ? `Place ${remaining} tile` : 'Done', x + config.PADDING, y + 90);
    } else {
      ctx.fillText('Phase', x + config.PADDING, y + 70);
      ctx.font = config.VALUE_FONT;
      ctx.fillStyle = 'rgba(100, 200, 255, 1.0)';
      ctx.fillText(turnPhase.charAt(0).toUpperCase() + turnPhase.slice(1), x + config.PADDING, y + 90);
    }

    // Landmarks
    ctx.font = config.LABEL_FONT;
    ctx.fillStyle = config.SECONDARY_COLOR;
    ctx.fillText('Landmarks', x + config.WIDTH / 2, y + 25);

    ctx.font = config.VALUE_FONT;
    ctx.fillStyle = config.TEXT_COLOR;
    // Compact format to fit in panel
    const landmarkText = players.map((p, i) => `P${i + 1}:${p.landmarks}`).join(' ');
    const maxLandmarkWidth = config.WIDTH / 2 - 10;
    ctx.fillText(this._truncateText(ctx, landmarkText, maxLandmarkWidth), x + config.WIDTH / 2, y + 45);

    // Turn number & Draw pile
    ctx.font = config.LABEL_FONT;
    ctx.fillStyle = config.SECONDARY_COLOR;
    ctx.fillText('Turn', x + config.WIDTH / 2, y + 70);

    ctx.font = config.VALUE_FONT;
    ctx.fillStyle = config.TEXT_COLOR;
    ctx.fillText(`${turn.number || 1}`, x + config.WIDTH / 2, y + 90);

    // Draw pile count
    ctx.font = config.LABEL_FONT;
    ctx.fillStyle = config.SECONDARY_COLOR;
    ctx.fillText('Draw Pile', x + config.PADDING, y + 115);

    ctx.font = config.VALUE_FONT;
    ctx.fillStyle = config.TEXT_COLOR;
    ctx.fillText(`${drawPileCount} tiles`, x + config.PADDING, y + 135);

    // Event pile count
    const eventPileCount = this._gameState.getEventPileCount();
    ctx.font = config.LABEL_FONT;
    ctx.fillStyle = config.SECONDARY_COLOR;
    ctx.fillText('Event Pile', x + config.WIDTH / 2, y + 115);

    ctx.font = config.VALUE_FONT;
    ctx.fillStyle = 'rgba(180, 140, 255, 0.9)';
    ctx.fillText(`${eventPileCount} cards`, x + config.WIDTH / 2, y + 135);

    // Action button
    this._renderActionButton(ctx, x, y + config.HEIGHT, config.WIDTH, turnInfo);
  }

  /**
   * Render the phase action button
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {Object} turnInfo - Turn info from gameState.getTurnInfo()
   */
  _renderActionButton(ctx, x, y, width, turnInfo) {
    const config = UI.INFO_PANEL;
    const buttonHeight = config.BUTTON_HEIGHT;
    const buttonY = y + 10;

    // Determine button text and color based on mode and phase
    let buttonText = 'End Phase';
    let buttonColor = 'rgba(80, 150, 200, 0.9)';

    if (turnInfo.isSimpleMode) {
      // Simple mode: just shows status, auto-ends after placement
      const tilesRemaining = turnInfo.tilesRemaining;

      if (tilesRemaining > 0) {
        buttonText = `Place ${tilesRemaining} Tile${tilesRemaining > 1 ? 's' : ''}`;
        buttonColor = 'rgba(80, 200, 120, 0.9)';
      } else {
        buttonText = 'Ending Turn...';
        buttonColor = 'rgba(150, 150, 150, 0.7)';
      }
    } else {
      // Classic mode phases
      const turnPhase = turnInfo.phase;
      if (turnPhase === 'draw') {
        buttonText = 'Draw Tile';
        buttonColor = 'rgba(80, 200, 120, 0.9)';
      } else if (turnPhase === 'develop') {
        buttonText = 'End Develop';
        buttonColor = 'rgba(80, 150, 200, 0.9)';
      } else if (turnPhase === 'agent') {
        buttonText = 'End Agent';
        buttonColor = 'rgba(200, 150, 80, 0.9)';
      } else if (turnPhase === 'end') {
        buttonText = 'End Turn';
        buttonColor = 'rgba(200, 100, 80, 0.9)';
      }
    }

    // Button background
    ctx.fillStyle = buttonColor;
    this._roundRect(ctx, x, buttonY, width, buttonHeight, 6);
    ctx.fill();

    // Button border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, x, buttonY, width, buttonHeight, 6);
    ctx.stroke();

    // Button text
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.textAlign = 'center';
    ctx.fillText(buttonText, x + width / 2, buttonY + buttonHeight / 2 + 5);

    // Store button bounds for click detection
    this._actionButtonBounds = {
      x,
      y: buttonY,
      width,
      height: buttonHeight
    };
  }

  /**
   * Check if a point is on the action button
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isPointOnActionButton(x, y) {
    if (!this._actionButtonBounds) return false;
    return pointInRect(x, y, this._actionButtonBounds);
  }

  /**
   * Render the player's hand at the bottom of the screen
   * @private
   */
  _renderPlayerHand(ctx, width, height) {
    const config = UI.HAND;
    const currentPlayer = this._gameState.getCurrentPlayer();
    const player = this._gameState.getPlayer(currentPlayer);
    const hand = player.hand || [];

    // Clear cached bounds
    this._handTileBounds = [];

    if (hand.length === 0) {
      // No tiles in hand - show message
      ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.textAlign = 'center';
      ctx.fillText('No tiles in hand', width / 2, height - config.HEIGHT / 2);
      return;
    }

    // Calculate hand layout
    const totalWidth = hand.length * config.TILE_SIZE + (hand.length - 1) * config.GAP;
    const startX = (width - totalWidth) / 2;
    const tileY = height - config.HEIGHT + (config.HEIGHT - config.TILE_SIZE) / 2;

    // Render each tile in hand
    hand.forEach((tile, index) => {
      const tileX = startX + index * (config.TILE_SIZE + config.GAP);

      // Store bounds for click detection
      this._handTileBounds.push({
        x: tileX,
        y: tileY,
        width: config.TILE_SIZE,
        height: config.TILE_SIZE,
        index
      });

      // Determine if hovered or selected
      const isHovered = this._hoveredHandTile === index;
      const isSelected = this._selectedHandTile === index;

      // Background
      if (isHovered) {
        ctx.fillStyle = config.HOVERED_BG;
        this._roundRect(ctx, tileX - 4, tileY - 4, config.TILE_SIZE + 8, config.TILE_SIZE + 8, config.BORDER_RADIUS);
        ctx.fill();
      }

      // Tile card background
      ctx.fillStyle = config.BG_COLOR;
      this._roundRect(ctx, tileX, tileY, config.TILE_SIZE, config.TILE_SIZE, config.BORDER_RADIUS);
      ctx.fill();

      // Tile color indicator (inner square)
      const props = TileProperties[tile.type];
      if (props) {
        ctx.fillStyle = props.color;
        this._roundRect(ctx, tileX + 8, tileY + 8, config.TILE_SIZE - 16, config.TILE_SIZE - 28, 4);
        ctx.fill();
      }

      // Tile type label
      ctx.font = config.LABEL_FONT;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.textAlign = 'center';
      const label = tile.type.charAt(0).toUpperCase();
      ctx.fillText(label, tileX + config.TILE_SIZE / 2, tileY + config.TILE_SIZE - 8);

      // Border
      ctx.strokeStyle = isSelected ? config.SELECTED_BORDER : config.BORDER_COLOR;
      ctx.lineWidth = isSelected ? 2 : 1;
      this._roundRect(ctx, tileX, tileY, config.TILE_SIZE, config.TILE_SIZE, config.BORDER_RADIUS);
      ctx.stroke();
    });

    // Hand label
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.textAlign = 'center';
    ctx.fillText(`Player ${currentPlayer + 1}'s Hand`, width / 2, height - config.HEIGHT + 15);
  }

  /**
   * Render the player's event cards (right side)
   * @private
   */
  _renderEventCards(ctx, width) {
    const config = UI.EVENTS;
    const currentPlayer = this._gameState.getCurrentPlayer();
    const events = this._gameState.getPlayerEvents(currentPlayer);

    // Clear cached bounds
    this._eventCardBounds = [];

    if (events.length === 0) {
      return;
    }

    const startX = width - config.RIGHT_PADDING - config.CARD_WIDTH;
    const startY = config.TOP_OFFSET;

    // Event cards label
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(180, 140, 255, 0.7)';
    ctx.textAlign = 'right';
    ctx.fillText(`Events (${events.length})`, width - config.RIGHT_PADDING, startY - 10);

    // Render each event card
    events.forEach((event, index) => {
      const cardY = startY + index * (config.CARD_HEIGHT + config.GAP);

      // Store bounds for click detection
      this._eventCardBounds.push({
        x: startX,
        y: cardY,
        width: config.CARD_WIDTH,
        height: config.CARD_HEIGHT,
        index
      });

      const isHovered = this._hoveredEventCard === index;
      const isSelected = this._selectedEventCard === index;

      // Hover background
      if (isHovered && !this._showEventModal) {
        ctx.fillStyle = config.HOVERED_BG;
        this._roundRect(ctx, startX - 3, cardY - 3, config.CARD_WIDTH + 6, config.CARD_HEIGHT + 6, config.BORDER_RADIUS);
        ctx.fill();
      }

      // Card background
      ctx.fillStyle = config.BG_COLOR;
      this._roundRect(ctx, startX, cardY, config.CARD_WIDTH, config.CARD_HEIGHT, config.BORDER_RADIUS);
      ctx.fill();

      // Category indicator (top bar)
      const categoryColor = config.CATEGORY_COLORS[event.category] || config.CATEGORY_COLORS.tactical;
      ctx.fillStyle = categoryColor;
      ctx.fillRect(startX, cardY, config.CARD_WIDTH, 3);

      // Card border
      ctx.strokeStyle = isSelected ? config.SELECTED_BORDER : config.BORDER_COLOR;
      ctx.lineWidth = isSelected ? 2 : 1;
      this._roundRect(ctx, startX, cardY, config.CARD_WIDTH, config.CARD_HEIGHT, config.BORDER_RADIUS);
      ctx.stroke();

      // Card name
      ctx.font = config.TITLE_FONT;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.textAlign = 'left';
      ctx.fillText(event.name, startX + 8, cardY + 20);

      // Category badge
      ctx.font = '8px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = categoryColor;
      const categoryText = event.category === EventCategory.IMMEDIATE ? 'IMMEDIATE' : 'TACTICAL';
      ctx.fillText(categoryText, startX + 8, cardY + 32);

      // Description (wrapped to 2 lines max)
      ctx.font = config.DESC_FONT;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      const descLines = this._wrapTextLines(ctx, event.description, config.CARD_WIDTH - 16, 2);
      const lineHeight = 11; // Slightly more than font size for readability
      descLines.forEach((line, lineIndex) => {
        ctx.fillText(line, startX + 8, cardY + 48 + lineIndex * lineHeight);
      });

      // "Click to play" hint on hover (only show if there's room)
      if (isHovered && !this._showEventModal) {
        ctx.font = '8px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = 'rgba(255, 200, 100, 0.8)';
        ctx.textAlign = 'right';
        ctx.fillText('Click to view', startX + config.CARD_WIDTH - 8, cardY + config.CARD_HEIGHT - 6);
      }
    });
  }

  /**
   * Render event modal when a card is selected
   * @private
   */
  _renderEventModal(ctx, width, height) {
    const config = UI.EVENT_MODAL;
    const eventConfig = UI.EVENTS;
    const currentPlayer = this._gameState.getCurrentPlayer();
    const events = this._gameState.getPlayerEvents(currentPlayer);
    const event = events[this._selectedEventCard];

    if (!event) {
      this._showEventModal = false;
      return;
    }

    // Darken background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width, height);

    // Modal position (centered)
    const modalX = (width - config.WIDTH) / 2;
    const modalY = (height - config.HEIGHT) / 2;

    // Modal background
    ctx.fillStyle = config.BG_COLOR;
    this._roundRect(ctx, modalX, modalY, config.WIDTH, config.HEIGHT, 10);
    ctx.fill();

    // Modal border
    ctx.strokeStyle = config.BORDER_COLOR;
    ctx.lineWidth = 2;
    this._roundRect(ctx, modalX, modalY, config.WIDTH, config.HEIGHT, 10);
    ctx.stroke();

    // Category indicator bar
    const categoryColor = eventConfig.CATEGORY_COLORS[event.category] || eventConfig.CATEGORY_COLORS.tactical;
    ctx.fillStyle = categoryColor;
    ctx.fillRect(modalX, modalY, config.WIDTH, 4);

    // Event name
    ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.textAlign = 'center';
    ctx.fillText(event.name, modalX + config.WIDTH / 2, modalY + 35);

    // Category badge
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = categoryColor;
    const categoryText = event.category === EventCategory.IMMEDIATE ? 'IMMEDIATE' : 'TACTICAL';
    ctx.fillText(categoryText, modalX + config.WIDTH / 2, modalY + 52);

    // Description (wrapped)
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    this._wrapText(ctx, event.description, modalX + config.PADDING, modalY + 75, config.WIDTH - config.PADDING * 2, 16);

    // Target info
    if (event.target && event.target !== 'none' && event.target !== 'self') {
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = 'rgba(255, 200, 100, 0.8)';
      ctx.textAlign = 'center';
      ctx.fillText(`Target: ${event.target.replace('-', ' ')}`, modalX + config.WIDTH / 2, modalY + 125);
    }

    // Buttons
    const buttonY = modalY + config.HEIGHT - config.BUTTON_HEIGHT - 15;
    const buttonWidth = (config.WIDTH - config.PADDING * 3) / 2;

    // Cancel button
    ctx.fillStyle = 'rgba(100, 100, 110, 0.9)';
    this._roundRect(ctx, modalX + config.PADDING, buttonY, buttonWidth, config.BUTTON_HEIGHT, 6);
    ctx.fill();

    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.textAlign = 'center';
    ctx.fillText('Cancel', modalX + config.PADDING + buttonWidth / 2, buttonY + config.BUTTON_HEIGHT / 2 + 4);

    this._cancelEventButtonBounds = {
      x: modalX + config.PADDING,
      y: buttonY,
      width: buttonWidth,
      height: config.BUTTON_HEIGHT
    };

    // Play button
    const playColor = event.category === EventCategory.IMMEDIATE ? 'rgba(200, 100, 80, 0.9)' : 'rgba(80, 150, 200, 0.9)';
    ctx.fillStyle = playColor;
    this._roundRect(ctx, modalX + config.PADDING * 2 + buttonWidth, buttonY, buttonWidth, config.BUTTON_HEIGHT, 6);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillText('Play', modalX + config.PADDING * 2 + buttonWidth + buttonWidth / 2, buttonY + config.BUTTON_HEIGHT / 2 + 4);

    this._playEventButtonBounds = {
      x: modalX + config.PADDING * 2 + buttonWidth,
      y: buttonY,
      width: buttonWidth,
      height: config.BUTTON_HEIGHT
    };
  }

  /**
   * Truncate text to fit width
   * @private
   */
  _truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) {
      return text;
    }
    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
  }

  /**
   * Wrap text to multiple lines and return as array (for compact rendering)
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} text
   * @param {number} maxWidth
   * @param {number} maxLines
   * @returns {string[]} Array of lines
   */
  _wrapTextLines(ctx, text, maxWidth, maxLines = 2) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;

        // Check if we've reached max lines
        if (lines.length >= maxLines) {
          // Truncate remaining text into the last line
          const remaining = words.slice(words.indexOf(word)).join(' ');
          lines[maxLines - 1] = this._truncateText(ctx, lines[maxLines - 1] + ' ' + remaining, maxWidth);
          return lines.slice(0, maxLines);
        }
      } else {
        currentLine = testLine;
      }
    }

    // Add the last line
    if (currentLine) {
      if (lines.length >= maxLines) {
        lines[maxLines - 1] = this._truncateText(ctx, lines[maxLines - 1] + ' ' + currentLine, maxWidth);
      } else {
        lines.push(currentLine.length > 0 ? this._truncateText(ctx, currentLine, maxWidth) : '');
      }
    }

    return lines.slice(0, maxLines);
  }

  /**
   * Wrap text to fit width
   * @private
   */
  _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, currentY);
        line = word;
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) {
      ctx.fillText(line, x, currentY);
    }
  }

  /**
   * Helper to draw a rounded rectangle path
   * @private
   */
  _roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * Check if a point is over a hand tile
   * @param {number} x - Screen X
   * @param {number} y - Screen Y
   * @returns {number} Tile index or -1 if not over any tile
   */
  getHandTileAtPoint(x, y) {
    for (const bounds of this._handTileBounds) {
      if (pointInRect(x, y, bounds)) {
        return bounds.index;
      }
    }
    return -1;
  }

  /**
   * Set the hovered hand tile
   * @param {number} index
   */
  setHoveredHandTile(index) {
    this._hoveredHandTile = index;
  }

  /**
   * Set the selected hand tile
   * @param {number} index
   */
  setSelectedHandTile(index) {
    this._selectedHandTile = index;
  }

  /**
   * Check if a point is over an event card
   * @param {number} x - Screen X
   * @param {number} y - Screen Y
   * @returns {number} Card index or -1 if not over any card
   */
  getEventCardAtPoint(x, y) {
    // Don't allow card selection while modal is open
    if (this._showEventModal) {
      return -1;
    }
    for (const bounds of this._eventCardBounds) {
      if (pointInRect(x, y, bounds)) {
        return bounds.index;
      }
    }
    return -1;
  }

  /**
   * Set the hovered event card
   * @param {number} index
   */
  setHoveredEventCard(index) {
    this._hoveredEventCard = index;
  }

  /**
   * Set the selected event card and open modal
   * @param {number} index
   */
  selectEventCard(index) {
    this._selectedEventCard = index;
    this._showEventModal = index >= 0;
  }

  /**
   * Get the currently selected event card index
   * @returns {number}
   */
  getSelectedEventCard() {
    return this._selectedEventCard;
  }

  /**
   * Check if event modal is open
   * @returns {boolean}
   */
  isEventModalOpen() {
    return this._showEventModal;
  }

  /**
   * Close the event modal
   */
  closeEventModal() {
    this._showEventModal = false;
    this._selectedEventCard = -1;
  }

  /**
   * Check if a point is on the play event button
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isPointOnPlayEventButton(x, y) {
    if (!this._showEventModal || !this._playEventButtonBounds) return false;
    return pointInRect(x, y, this._playEventButtonBounds);
  }

  /**
   * Check if a point is on the cancel event button
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isPointOnCancelEventButton(x, y) {
    if (!this._showEventModal || !this._cancelEventButtonBounds) return false;
    return pointInRect(x, y, this._cancelEventButtonBounds);
  }

  /**
   * Handle canvas resize
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    // Canvas is resized externally, but we could add scaling logic here
  }

  // ===========================================================================
  // EVENT TARGETING MODE
  // ===========================================================================

  /**
   * Enter targeting mode for an event
   * @param {Object} event - The event being played
   * @param {Array} validTargets - Array of valid target positions/objects
   * @param {string} message - Message to display to user
   */
  enterTargetingMode(event, validTargets, message) {
    this._targetingMode = true;
    this._targetingEvent = event;
    this._targetingValidTargets = validTargets;
    this._targetingMessage = message || `Select a target for ${event.name}`;
    this._hoveredTarget = null;
    this._showEventModal = false;
    this._selectedEventCard = -1;
  }

  /**
   * Exit targeting mode
   */
  exitTargetingMode() {
    this._targetingMode = false;
    this._targetingEvent = null;
    this._targetingValidTargets = [];
    this._targetingMessage = '';
    this._hoveredTarget = null;
  }

  /**
   * Check if in targeting mode
   * @returns {boolean}
   */
  isInTargetingMode() {
    return this._targetingMode;
  }

  /**
   * Get the event being targeted
   * @returns {Object|null}
   */
  getTargetingEvent() {
    return this._targetingEvent;
  }

  /**
   * Get valid targets for current targeting mode
   * @returns {Array}
   */
  getValidTargets() {
    return this._targetingValidTargets;
  }

  /**
   * Check if a board position is a valid target
   * @param {number} x
   * @param {number} y
   * @returns {Object|null} The target object if valid, null otherwise
   */
  getTargetAtPosition(x, y) {
    if (!this._targetingMode) return null;
    return this._targetingValidTargets.find(t => t.x === x && t.y === y) || null;
  }

  /**
   * Set the hovered target
   * @param {Object|null} target
   */
  setHoveredTarget(target) {
    this._hoveredTarget = target;
  }

  /**
   * Render targeting mode overlay
   * @private
   */
  _renderTargetingOverlay(ctx, width, height) {
    if (!this._targetingMode) return;

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);

    // Targeting message banner at top
    const bannerHeight = 60;
    ctx.fillStyle = 'rgba(40, 35, 50, 0.95)';
    ctx.fillRect(0, 0, width, bannerHeight);

    // Event name
    ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 200, 100, 0.95)';
    ctx.textAlign = 'center';
    ctx.fillText(`Playing: ${this._targetingEvent?.name || 'Event'}`, width / 2, 25);

    // Targeting instruction
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(this._targetingMessage, width / 2, 48);

    // Cancel hint at bottom
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'center';
    ctx.fillText('Press Escape or click here to cancel', width / 2, height - 20);

    // Cancel button area (invisible, but clickable)
    this._cancelTargetingBounds = {
      x: width / 2 - 100,
      y: height - 40,
      width: 200,
      height: 30
    };

    // Draw cancel button outline
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, this._cancelTargetingBounds.x, this._cancelTargetingBounds.y,
      this._cancelTargetingBounds.width, this._cancelTargetingBounds.height, 4);
    ctx.stroke();
  }

  /**
   * Check if point is on cancel targeting button
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isPointOnCancelTargeting(x, y) {
    if (!this._targetingMode || !this._cancelTargetingBounds) return false;
    return pointInRect(x, y, this._cancelTargetingBounds);
  }

  // ===========================================================================
  // AGENT PHASE UI
  // ===========================================================================

  /**
   * Select an agent for movement/action
   * @param {number} x
   * @param {number} y
   * @param {number} owner
   * @param {Array} validMoves - Valid move positions
   */
  selectAgent(x, y, owner, validMoves) {
    this._selectedAgent = { x, y, owner };
    this._validAgentMoves = validMoves || [];
    this._agentMode = 'move';
  }

  /**
   * Clear agent selection
   */
  clearAgentSelection() {
    this._selectedAgent = null;
    this._validAgentMoves = [];
    this._agentMode = null;
  }

  /**
   * Get the currently selected agent
   * @returns {Object|null} { x, y, owner } or null
   */
  getSelectedAgent() {
    return this._selectedAgent;
  }

  /**
   * Get valid moves for selected agent
   * @returns {Array}
   */
  getValidAgentMoves() {
    return this._validAgentMoves;
  }

  /**
   * Check if a position is a valid agent move
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isValidAgentMove(x, y) {
    return this._validAgentMoves.some(m => m.x === x && m.y === y);
  }

  /**
   * Check if an agent is selected
   * @returns {boolean}
   */
  hasAgentSelected() {
    return this._selectedAgent !== null;
  }

  /**
   * Set agent mode (move, capture, reposition, takeover)
   * @param {string} mode
   */
  setAgentMode(mode) {
    this._agentMode = mode;
  }

  /**
   * Get current agent mode
   * @returns {string|null}
   */
  getAgentMode() {
    return this._agentMode;
  }

  // ===========================================================================
  // HQ CONVERSION UI
  // ===========================================================================

  /**
   * Set landmarks that can be converted to HQ
   * @param {Array} landmarks - Array of { x, y, owner } objects
   */
  setConvertibleLandmarks(landmarks) {
    this._convertibleLandmarks = landmarks || [];
  }

  /**
   * Get convertible landmarks
   * @returns {Array}
   */
  getConvertibleLandmarks() {
    return this._convertibleLandmarks;
  }

  /**
   * Check if a position has a convertible landmark
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isConvertibleLandmark(x, y) {
    return this._convertibleLandmarks.some(l => l.x === x && l.y === y);
  }

  // ===========================================================================
  // TAKEOVER UI
  // ===========================================================================

  /**
   * Set the current takeover target
   * @param {Object|null} target - { x, y, type, requiredAgents }
   */
  setTakeoverTarget(target) {
    this._takeoverTarget = target;
  }

  /**
   * Get current takeover target
   * @returns {Object|null}
   */
  getTakeoverTarget() {
    return this._takeoverTarget;
  }

  /**
   * Clear takeover target
   */
  clearTakeoverTarget() {
    this._takeoverTarget = null;
  }

  /**
   * Render agent phase panel when agents are available
   * @private
   */
  _renderAgentPhasePanel(ctx, width, height) {
    if (!this._selectedAgent) return;

    const panelWidth = 200;
    const panelHeight = 100;
    const panelX = width - panelWidth - 20;
    const panelY = height - panelHeight - 100;

    // Panel background
    ctx.fillStyle = 'rgba(40, 35, 50, 0.9)';
    this._roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 8);
    ctx.fill();

    // Panel border
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
    ctx.lineWidth = 2;
    this._roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 8);
    ctx.stroke();

    // Title
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(100, 200, 255, 0.95)';
    ctx.textAlign = 'center';
    ctx.fillText('Agent Selected', panelX + panelWidth / 2, panelY + 25);

    // Position
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(`Position: (${this._selectedAgent.x}, ${this._selectedAgent.y})`, panelX + panelWidth / 2, panelY + 45);

    // Valid moves count
    ctx.fillStyle = 'rgba(150, 255, 150, 0.8)';
    ctx.fillText(`${this._validAgentMoves.length} valid moves`, panelX + panelWidth / 2, panelY + 65);

    // Instructions
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('Click a highlighted tile to move', panelX + panelWidth / 2, panelY + 85);
  }

  /**
   * Render HQ conversion button when landmark is selected
   * @private
   */
  _renderHQConversionButton(ctx, width, height, landmark) {
    const buttonWidth = 150;
    const buttonHeight = 40;
    const buttonX = (width - buttonWidth) / 2;
    const buttonY = height - 160;

    // Button background
    ctx.fillStyle = 'rgba(200, 150, 50, 0.9)';
    this._roundRect(ctx, buttonX, buttonY, buttonWidth, buttonHeight, 6);
    ctx.fill();

    // Button border
    ctx.strokeStyle = 'rgba(255, 200, 100, 0.8)';
    ctx.lineWidth = 2;
    this._roundRect(ctx, buttonX, buttonY, buttonWidth, buttonHeight, 6);
    ctx.stroke();

    // Button text
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.textAlign = 'center';
    ctx.fillText('Convert to HQ', buttonX + buttonWidth / 2, buttonY + buttonHeight / 2 + 5);

    // Store bounds
    this._hqConversionButtonBounds = {
      x: buttonX,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight
    };

    return this._hqConversionButtonBounds;
  }

  /**
   * Check if point is on HQ conversion button
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isPointOnHQConversionButton(x, y) {
    if (!this._hqConversionButtonBounds) return false;
    return pointInRect(x, y, this._hqConversionButtonBounds);
  }

  /**
   * Render takeover confirmation panel
   * @private
   */
  _renderTakeoverPanel(ctx, width, height) {
    if (!this._takeoverTarget) return;

    const panelWidth = 250;
    const panelHeight = 120;
    const panelX = (width - panelWidth) / 2;
    const panelY = (height - panelHeight) / 2;

    // Panel background
    ctx.fillStyle = 'rgba(50, 30, 30, 0.95)';
    this._roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 10);
    ctx.fill();

    // Panel border
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
    ctx.lineWidth = 2;
    this._roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 10);
    ctx.stroke();

    // Title
    ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 100, 100, 0.95)';
    ctx.textAlign = 'center';
    ctx.fillText('Hostile Takeover', panelX + panelWidth / 2, panelY + 30);

    // Target info
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    const targetType = this._takeoverTarget.type || 'tile';
    ctx.fillText(`Target: ${targetType} at (${this._takeoverTarget.x}, ${this._takeoverTarget.y})`, panelX + panelWidth / 2, panelY + 55);

    // Agents required
    ctx.fillStyle = 'rgba(255, 200, 100, 0.9)';
    ctx.fillText(`Agents needed: ${this._takeoverTarget.requiredAgents || 1}`, panelX + panelWidth / 2, panelY + 75);

    // Buttons
    const buttonWidth = 80;
    const buttonHeight = 30;
    const buttonY = panelY + panelHeight - buttonHeight - 15;

    // Cancel button
    ctx.fillStyle = 'rgba(100, 100, 110, 0.9)';
    this._roundRect(ctx, panelX + 20, buttonY, buttonWidth, buttonHeight, 4);
    ctx.fill();

    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText('Cancel', panelX + 20 + buttonWidth / 2, buttonY + buttonHeight / 2 + 4);

    this._takeoverCancelBounds = {
      x: panelX + 20,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight
    };

    // Confirm button
    ctx.fillStyle = 'rgba(200, 80, 80, 0.9)';
    this._roundRect(ctx, panelX + panelWidth - buttonWidth - 20, buttonY, buttonWidth, buttonHeight, 4);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillText('Attack!', panelX + panelWidth - buttonWidth - 20 + buttonWidth / 2, buttonY + buttonHeight / 2 + 4);

    this._takeoverConfirmBounds = {
      x: panelX + panelWidth - buttonWidth - 20,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight
    };
  }

  /**
   * Check if point is on takeover cancel button
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isPointOnTakeoverCancel(x, y) {
    if (!this._takeoverCancelBounds) return false;
    return pointInRect(x, y, this._takeoverCancelBounds);
  }

  /**
   * Check if point is on takeover confirm button
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isPointOnTakeoverConfirm(x, y) {
    if (!this._takeoverConfirmBounds) return false;
    return pointInRect(x, y, this._takeoverConfirmBounds);
  }

  // ===========================================================================
  // HELP SYSTEM
  // ===========================================================================

  /**
   * Toggle help overlay visibility
   */
  toggleHelp() {
    this._helpVisible = !this._helpVisible;
  }

  /**
   * Show help overlay
   */
  showHelp() {
    this._helpVisible = true;
  }

  /**
   * Hide help overlay
   */
  hideHelp() {
    this._helpVisible = false;
  }

  /**
   * Check if help is visible
   * @returns {boolean}
   */
  isHelpVisible() {
    return this._helpVisible;
  }

  /**
   * Render help overlay
   * @private
   */
  _renderHelpOverlay(ctx, width, height) {
    if (!this._helpVisible) return;

    // Darken background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, width, height);

    // Help panel dimensions
    const panelWidth = Math.min(600, width - 60);
    const panelHeight = Math.min(500, height - 60);
    const panelX = (width - panelWidth) / 2;
    const panelY = (height - panelHeight) / 2;

    // Panel background
    ctx.fillStyle = 'rgba(35, 35, 45, 0.98)';
    this._roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 12);
    ctx.fill();

    // Panel border
    ctx.strokeStyle = 'rgba(100, 150, 200, 0.6)';
    ctx.lineWidth = 2;
    this._roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 12);
    ctx.stroke();

    // Title
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.textAlign = 'center';
    ctx.fillText('Trinity - Help', panelX + panelWidth / 2, panelY + 40);

    // Content sections
    const leftX = panelX + 30;
    const rightX = panelX + panelWidth / 2 + 15;
    let leftY = panelY + 80;
    let rightY = panelY + 80;
    const lineHeight = 20;

    // Left column - Game Rules
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(100, 200, 255, 0.95)';
    ctx.textAlign = 'left';
    ctx.fillText('GAME RULES', leftX, leftY);
    leftY += lineHeight + 5;

    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';

    const rules = [
      '• Place tiles to build your city',
      '• Form Landmarks (H+C+I = Trinity)',
      '• Landmarks score 1 point each',
      '• First to 3 Landmarks wins!',
      '',
      '• Convert Landmarks to HQ for agents',
      '• Use agents to capture tiles',
      '• Event cards give special abilities',
      '',
      'Tile Types:',
      '  H = Housing (green)',
      '  C = Commerce (blue)',
      '  I = Industry (orange)',
    ];

    rules.forEach(line => {
      ctx.fillText(line, leftX, leftY);
      leftY += lineHeight;
    });

    // Right column - Controls
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(100, 200, 255, 0.95)';
    ctx.fillText('CONTROLS', rightX, rightY);
    rightY += lineHeight + 5;

    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';

    const controls = [
      '1-9    Select tile from hand',
      'E      Open/cycle event cards',
      'Q      Close event modal',
      'Space  End phase / Confirm',
      'Z      Undo last action',
      'Esc    Cancel / Deselect',
      '?/H    Toggle this help',
      '',
      'Mouse wheel  Zoom in/out',
      'Click tile   Place selected tile',
      'Click event  View event details',
      '',
      'Placing Tiles:',
      '  1. Click tile in hand',
      '  2. Click valid board position',
      '  3. Golden glow = Landmark!',
    ];

    controls.forEach(line => {
      ctx.fillText(line, rightX, rightY);
      rightY += lineHeight;
    });

    // Close hint
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.textAlign = 'center';
    ctx.fillText('Press ? or H to close', panelX + panelWidth / 2, panelY + panelHeight - 20);
  }

  // ===========================================================================
  // TOOLTIPS
  // ===========================================================================

  /**
   * Show a tooltip at the given position
   * @param {number} x - Screen X
   * @param {number} y - Screen Y
   * @param {string} text - Tooltip text
   * @param {string} title - Optional title
   */
  showTooltip(x, y, text, title = '') {
    this._tooltip = {
      visible: true,
      x,
      y,
      text,
      title,
    };
  }

  /**
   * Hide the current tooltip
   */
  hideTooltip() {
    this._tooltip.visible = false;
  }

  /**
   * Update tooltip based on current hover position
   * Call this from the mouse move handler
   * @param {number} x - Screen X
   * @param {number} y - Screen Y
   */
  updateTooltip(x, y) {
    // Check if hovering over event card
    const eventIndex = this.getEventCardAtPoint(x, y);
    if (eventIndex >= 0 && !this._showEventModal) {
      const events = this._gameState?.getPlayerEvents(this._gameState.getCurrentPlayer()) || [];
      const event = events[eventIndex];
      if (event) {
        this.showTooltip(x, y, event.description, event.name);
        return;
      }
    }

    // Check if hovering over hand tile
    const handIndex = this.getHandTileAtPoint(x, y);
    if (handIndex >= 0) {
      const player = this._gameState?.getPlayer(this._gameState.getCurrentPlayer());
      const tile = player?.hand?.[handIndex];
      if (tile) {
        const tileName = tile.type.charAt(0).toUpperCase() + tile.type.slice(1);
        this.showTooltip(x, y, `Click to select, then click on the board to place`, tileName);
        return;
      }
    }

    // Check if hovering over action button
    if (this.isPointOnActionButton(x, y)) {
      const turnInfo = this._gameState?.getTurnInfo?.();
      if (turnInfo) {
        let text = 'Click to perform the action';
        if (turnInfo.isSimpleMode) {
          if (turnInfo.tilesRemaining > 0) {
            text = 'Select a tile from your hand to place';
          } else {
            text = 'Turn will end automatically';
          }
        }
        this.showTooltip(x, y, text, 'Action');
        return;
      }
    }

    // No tooltip to show
    this.hideTooltip();
  }

  /**
   * Render tooltip if visible
   * @private
   */
  _renderTooltip(ctx, width, height) {
    if (!this._tooltip.visible) return;

    const tt = this._tooltip;
    const padding = 10;
    const maxWidth = 220;

    // Measure text
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    const lines = this._wrapTextLines(ctx, tt.text, maxWidth - padding * 2, 4);

    // Calculate tooltip dimensions
    let tooltipWidth = maxWidth;
    let tooltipHeight = padding * 2 + lines.length * 14;

    if (tt.title) {
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
      tooltipHeight += 18;
    }

    // Position tooltip (avoid going off screen)
    let tooltipX = tt.x + 15;
    let tooltipY = tt.y + 15;

    if (tooltipX + tooltipWidth > width - 10) {
      tooltipX = tt.x - tooltipWidth - 15;
    }
    if (tooltipY + tooltipHeight > height - 10) {
      tooltipY = tt.y - tooltipHeight - 15;
    }

    // Draw background
    ctx.fillStyle = 'rgba(30, 30, 40, 0.95)';
    this._roundRect(ctx, tooltipX, tooltipY, tooltipWidth, tooltipHeight, 6);
    ctx.fill();

    // Draw border
    ctx.strokeStyle = 'rgba(100, 100, 120, 0.8)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, tooltipX, tooltipY, tooltipWidth, tooltipHeight, 6);
    ctx.stroke();

    let textY = tooltipY + padding;

    // Draw title if present
    if (tt.title) {
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = 'rgba(255, 220, 150, 0.95)';
      ctx.textAlign = 'left';
      ctx.fillText(tt.title, tooltipX + padding, textY + 10);
      textY += 18;
    }

    // Draw text
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    lines.forEach((line, index) => {
      ctx.fillText(line, tooltipX + padding, textY + 10 + index * 14);
    });
  }

  // ===========================================================================
  // TURN TRANSITION ANIMATION
  // ===========================================================================

  /**
   * Player colors for turn transition (matching TileRenderer.js)
   * @private
   */
  static PLAYER_COLORS = [
    { r: 51, g: 153, b: 255 },   // Player 1: Blue
    { r: 255, g: 102, b: 77 },   // Player 2: Red/Orange
    { r: 77, g: 204, b: 102 },   // Player 3: Green
    { r: 230, g: 179, b: 51 },   // Player 4: Yellow
  ];

  /**
   * Start turn transition animation
   * @param {number} playerIndex - The player whose turn is starting
   * @param {number} currentTime - Current time in seconds
   */
  startTurnTransition(playerIndex, currentTime) {
    // Skip if turn transition animation is disabled
    if (!ANIMATION.TURN_TRANSITION.ENABLED) {
      return;
    }

    this._turnTransition = {
      active: true,
      playerIndex,
      startTime: currentTime,
      duration: ANIMATION.TURN_TRANSITION.DURATION,
      phase: 'in',
    };
  }

  /**
   * Check if turn transition is active
   * @returns {boolean}
   */
  isTurnTransitionActive() {
    return this._turnTransition.active;
  }

  /**
   * Render the turn transition overlay
   * @private
   */
  _renderTurnTransition(ctx, width, height, currentTime) {
    const tt = this._turnTransition;
    const elapsed = currentTime - tt.startTime;
    const progress = Math.min(elapsed / tt.duration, 1);

    // Animation phases:
    // 0.0 - 0.3: Fade in
    // 0.3 - 0.7: Hold
    // 0.7 - 1.0: Fade out
    let opacity = 0;
    let scale = 1;
    let textOpacity = 0;

    if (progress < 0.3) {
      // Fade in
      const phaseProgress = progress / 0.3;
      opacity = phaseProgress * 0.7;
      scale = 0.8 + phaseProgress * 0.2;
      textOpacity = phaseProgress;
    } else if (progress < 0.7) {
      // Hold
      opacity = 0.7;
      scale = 1;
      textOpacity = 1;
    } else {
      // Fade out
      const phaseProgress = (progress - 0.7) / 0.3;
      opacity = 0.7 * (1 - phaseProgress);
      scale = 1 + phaseProgress * 0.1;
      textOpacity = 1 - phaseProgress;
    }

    // End animation when complete
    if (progress >= 1) {
      this._turnTransition.active = false;
      return;
    }

    // Get player color
    const playerColor = UIRenderer.PLAYER_COLORS[tt.playerIndex % UIRenderer.PLAYER_COLORS.length];

    // Draw semi-transparent overlay
    ctx.fillStyle = `rgba(20, 20, 30, ${opacity})`;
    ctx.fillRect(0, 0, width, height);

    // Draw colored bars from sides
    const barHeight = 80;
    const barY = (height - barHeight) / 2;

    // Left bar slides in from left
    const leftBarWidth = width * 0.5 * (progress < 0.5 ? progress * 2 : 1 - (progress - 0.5) * 2);
    if (leftBarWidth > 0) {
      ctx.fillStyle = `rgba(${playerColor.r}, ${playerColor.g}, ${playerColor.b}, ${opacity * 0.8})`;
      ctx.fillRect(0, barY, leftBarWidth, barHeight);
    }

    // Right bar slides in from right
    const rightBarWidth = leftBarWidth;
    if (rightBarWidth > 0) {
      ctx.fillStyle = `rgba(${playerColor.r}, ${playerColor.g}, ${playerColor.b}, ${opacity * 0.8})`;
      ctx.fillRect(width - rightBarWidth, barY, rightBarWidth, barHeight);
    }

    // Draw player text
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(scale, scale);

    // Main text
    ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = `rgba(255, 255, 255, ${textOpacity})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Player ${tt.playerIndex + 1}`, 0, -15);

    // Subtitle
    ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = `rgba(${playerColor.r}, ${playerColor.g}, ${playerColor.b}, ${textOpacity})`;
    ctx.fillText("Your Turn", 0, 25);

    ctx.restore();

    // Draw subtle particle effects
    this._renderTurnTransitionParticles(ctx, width, height, elapsed, playerColor, opacity);
  }

  /**
   * Render particle effects for turn transition
   * @private
   */
  _renderTurnTransitionParticles(ctx, width, height, elapsed, color, opacity) {
    const particleCount = 12;
    const centerY = height / 2;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + elapsed * 2;
      const radius = 150 + Math.sin(elapsed * 3 + i) * 30;
      const x = width / 2 + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius * 0.3;
      const size = 3 + Math.sin(elapsed * 5 + i * 0.5) * 2;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.6})`;
      ctx.fill();
    }
  }

  // ===========================================================================
  // STARTING PLAYER DETERMINATION ANIMATION
  // ===========================================================================

  /**
   * Tile type colors for starting player animation
   * @private
   */
  static TILE_TYPE_COLORS = {
    housing: { r: 76, g: 175, b: 80, name: 'Housing', symbol: 'H' },     // Green
    commerce: { r: 33, g: 150, b: 243, name: 'Commerce', symbol: 'C' },  // Blue
    industry: { r: 255, g: 152, b: 0, name: 'Industry', symbol: 'I' },   // Orange
  };

  /**
   * Start the starting player determination animation
   * @param {number[]} contenders - Array of player indices
   * @param {number} round - Current round (1-based)
   * @param {number} currentTime - Current time in seconds
   */
  startStartingPlayerAnimation(contenders, round, currentTime) {
    this._startingPlayerAnimation = {
      active: true,
      phase: 'setup',
      startTime: currentTime,
      phaseStartTime: currentTime,
      round: round,
      contenders: contenders,
      draws: [],
      winner: null,
      tiedPlayers: [],
    };
  }

  /**
   * Add a player's drawn tile to the animation
   * @param {number} player - Player index
   * @param {string} tileType - Type of tile drawn
   * @param {number} rank - Tile rank (3=Housing, 2=Commerce, 1=Industry)
   */
  addStartingPlayerDraw(player, tileType, rank) {
    if (!this._startingPlayerAnimation.active) return;

    this._startingPlayerAnimation.draws.push({
      player,
      tileType,
      rank,
      revealed: false,
    });

    // Transition to draw phase after first draw
    if (this._startingPlayerAnimation.phase === 'setup') {
      this._startingPlayerAnimation.phase = 'draw';
    }
  }

  /**
   * Reveal all drawn tiles
   * @param {number} currentTime - Current time in seconds
   */
  revealStartingPlayerTiles(currentTime) {
    if (!this._startingPlayerAnimation.active) return;

    this._startingPlayerAnimation.draws.forEach(d => d.revealed = true);
    this._startingPlayerAnimation.phase = 'reveal';
    this._startingPlayerAnimation.phaseStartTime = currentTime;
  }

  /**
   * Set the compare phase with winner info
   * @param {number} maxRank - The highest rank drawn
   * @param {number[]} winners - Array of player indices with max rank
   * @param {number} currentTime - Current time in seconds
   */
  setStartingPlayerCompare(maxRank, winners, currentTime) {
    if (!this._startingPlayerAnimation.active) return;

    this._startingPlayerAnimation.phase = 'compare';
    this._startingPlayerAnimation.phaseStartTime = currentTime;
    this._startingPlayerAnimation.maxRank = maxRank;
    this._startingPlayerAnimation.winners = winners;
  }

  /**
   * Set the winner and transition to resolve phase
   * @param {number} winner - Winning player index
   * @param {number} currentTime - Current time in seconds
   */
  setStartingPlayerWinner(winner, currentTime) {
    if (!this._startingPlayerAnimation.active) return;

    this._startingPlayerAnimation.winner = winner;
    this._startingPlayerAnimation.phase = 'resolve';
    this._startingPlayerAnimation.phaseStartTime = currentTime;
  }

  /**
   * Trigger a tie animation
   * @param {number[]} tiedPlayers - Array of tied player indices
   * @param {number} currentTime - Current time in seconds
   */
  triggerStartingPlayerTie(tiedPlayers, currentTime) {
    if (!this._startingPlayerAnimation.active) return;

    this._startingPlayerAnimation.tiedPlayers = tiedPlayers;
    this._startingPlayerAnimation.phase = 'tie';
    this._startingPlayerAnimation.phaseStartTime = currentTime;
  }

  /**
   * Prepare for a new round (after tie)
   * @param {number[]} contenders - Array of player indices for next round
   * @param {number} round - New round number
   * @param {number} currentTime - Current time in seconds
   */
  resetStartingPlayerRound(contenders, round, currentTime) {
    this._startingPlayerAnimation.phase = 'setup';
    this._startingPlayerAnimation.phaseStartTime = currentTime;
    this._startingPlayerAnimation.round = round;
    this._startingPlayerAnimation.contenders = contenders;
    this._startingPlayerAnimation.draws = [];
    this._startingPlayerAnimation.winner = null;
    this._startingPlayerAnimation.tiedPlayers = [];
    this._startingPlayerAnimation.maxRank = null;
    this._startingPlayerAnimation.winners = null;
  }

  /**
   * End the starting player animation
   */
  endStartingPlayerAnimation() {
    this._startingPlayerAnimation.active = false;
    this._startingPlayerAnimation.phase = 'idle';
  }

  /**
   * Check if starting player animation is active
   * @returns {boolean}
   */
  isStartingPlayerAnimationActive() {
    return this._startingPlayerAnimation.active;
  }

  /**
   * Get the current phase of the starting player animation
   * @returns {string}
   */
  getStartingPlayerAnimationPhase() {
    return this._startingPlayerAnimation.phase;
  }

  /**
   * Render the starting player determination animation
   * @private
   */
  _renderStartingPlayerAnimation(ctx, width, height, currentTime) {
    const anim = this._startingPlayerAnimation;
    if (!anim.active) return;

    const elapsed = currentTime - anim.phaseStartTime;

    // Dark overlay
    ctx.fillStyle = 'rgba(10, 10, 20, 0.9)';
    ctx.fillRect(0, 0, width, height);

    // Panel dimensions
    const panelWidth = Math.min(520, width - 60);
    const panelHeight = 340;
    const panelX = (width - panelWidth) / 2;
    const panelY = (height - panelHeight) / 2;

    // Panel background with gradient
    const gradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
    gradient.addColorStop(0, 'rgba(40, 45, 60, 0.98)');
    gradient.addColorStop(1, 'rgba(25, 28, 40, 0.98)');
    ctx.fillStyle = gradient;
    this._roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 12);
    ctx.fill();

    // Panel border
    ctx.strokeStyle = 'rgba(100, 150, 200, 0.6)';
    ctx.lineWidth = 2;
    this._roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 12);
    ctx.stroke();

    // Title
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.textAlign = 'center';
    ctx.fillText('Determining Starting Player', panelX + panelWidth / 2, panelY + 35);

    // Round indicator (if > 1)
    if (anim.round > 1) {
      ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = 'rgba(255, 200, 100, 0.9)';
      ctx.fillText(`Round ${anim.round} - Tiebreaker`, panelX + panelWidth / 2, panelY + 55);
    }

    // Rule reminder
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(150, 180, 220, 0.8)';
    ctx.fillText('Housing (H) > Commerce (C) > Industry (I)', panelX + panelWidth / 2, panelY + (anim.round > 1 ? 75 : 60));

    // Render tile cards for each contender
    this._renderStartingPlayerTiles(ctx, panelX, panelY + 95, panelWidth, anim, elapsed);

    // Render phase-specific content
    if (anim.phase === 'compare' || anim.phase === 'resolve') {
      this._renderStartingPlayerWinner(ctx, panelX, panelY + panelHeight - 80, panelWidth, anim, elapsed);
    } else if (anim.phase === 'tie') {
      this._renderStartingPlayerTie(ctx, panelX, panelY + panelHeight - 80, panelWidth, anim, elapsed);
    }
  }

  /**
   * Render the tile cards for each player
   * @private
   */
  _renderStartingPlayerTiles(ctx, panelX, startY, panelWidth, anim, elapsed) {
    const contenders = anim.contenders;
    const draws = anim.draws;
    const cardWidth = 110;
    const cardHeight = 140;
    const gap = 25;

    // Calculate total width needed
    const totalWidth = contenders.length * cardWidth + (contenders.length - 1) * gap;
    const startX = panelX + (panelWidth - totalWidth) / 2;

    contenders.forEach((playerIndex, i) => {
      const cardX = startX + i * (cardWidth + gap);
      const draw = draws.find(d => d.player === playerIndex);

      // Card animation (bounce in during draw phase)
      let cardY = startY;
      let cardOpacity = 1;
      let cardScale = 1;

      if (anim.phase === 'setup' || (anim.phase === 'draw' && !draw)) {
        cardOpacity = 0.3;
      } else if (anim.phase === 'draw' && draw) {
        // Bounce animation
        const drawIndex = draws.indexOf(draw);
        const drawDelay = drawIndex * 0.2;
        const drawElapsed = Math.max(0, elapsed - drawDelay);
        if (drawElapsed < 0.3) {
          const bounceProgress = drawElapsed / 0.3;
          cardY = startY - 20 * Math.sin(bounceProgress * Math.PI);
          cardScale = 0.8 + 0.2 * bounceProgress;
        }
      }

      // Winner highlight during compare/resolve
      const isWinner = anim.winners?.includes(playerIndex) || anim.winner === playerIndex;
      const isTied = anim.tiedPlayers?.includes(playerIndex);

      // Card background
      ctx.save();
      ctx.translate(cardX + cardWidth / 2, cardY + cardHeight / 2);
      ctx.scale(cardScale, cardScale);
      ctx.translate(-(cardX + cardWidth / 2), -(cardY + cardHeight / 2));

      // Glow for winner
      if (isWinner && (anim.phase === 'compare' || anim.phase === 'resolve')) {
        const glowIntensity = 0.5 + 0.3 * Math.sin(elapsed * 4);
        ctx.shadowColor = 'rgba(255, 220, 100, 0.8)';
        ctx.shadowBlur = 20 * glowIntensity;
      }

      // Card fill
      ctx.fillStyle = `rgba(50, 55, 70, ${cardOpacity})`;
      this._roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 8);
      ctx.fill();

      ctx.shadowBlur = 0;

      // Card border
      let borderColor = 'rgba(100, 120, 150, 0.6)';
      if (isWinner && anim.phase === 'resolve') {
        borderColor = 'rgba(255, 220, 100, 0.9)';
      } else if (isTied) {
        borderColor = 'rgba(255, 150, 100, 0.8)';
      }
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = isWinner ? 3 : 2;
      this._roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 8);
      ctx.stroke();

      // Player label
      const playerColor = UIRenderer.PLAYER_COLORS[playerIndex % UIRenderer.PLAYER_COLORS.length];
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = `rgba(${playerColor.r}, ${playerColor.g}, ${playerColor.b}, ${cardOpacity})`;
      ctx.textAlign = 'center';
      ctx.fillText(`Player ${playerIndex + 1}`, cardX + cardWidth / 2, cardY + 22);

      // Tile display
      if (draw) {
        const tileInfo = UIRenderer.TILE_TYPE_COLORS[draw.tileType];
        const tileSize = 55;
        const tileX = cardX + (cardWidth - tileSize) / 2;
        const tileY = cardY + 35;

        if (draw.revealed) {
          // Show tile type with color
          ctx.fillStyle = `rgba(${tileInfo.r}, ${tileInfo.g}, ${tileInfo.b}, ${cardOpacity})`;
          this._roundRect(ctx, tileX, tileY, tileSize, tileSize, 6);
          ctx.fill();

          // Tile symbol
          ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = `rgba(255, 255, 255, ${cardOpacity * 0.95})`;
          ctx.fillText(tileInfo.symbol, cardX + cardWidth / 2, tileY + tileSize / 2 + 10);

          // Tile type name
          ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = `rgba(255, 255, 255, ${cardOpacity * 0.8})`;
          ctx.fillText(tileInfo.name, cardX + cardWidth / 2, tileY + tileSize + 18);

          // Rank display
          ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = isWinner
            ? `rgba(255, 220, 100, ${cardOpacity})`
            : `rgba(200, 200, 220, ${cardOpacity * 0.8})`;
          ctx.fillText(`Rank: ${draw.rank}`, cardX + cardWidth / 2, cardY + cardHeight - 12);
        } else {
          // Face-down tile (back pattern)
          ctx.fillStyle = `rgba(60, 65, 80, ${cardOpacity})`;
          this._roundRect(ctx, tileX, tileY, tileSize, tileSize, 6);
          ctx.fill();

          // Back pattern
          ctx.strokeStyle = `rgba(80, 90, 110, ${cardOpacity})`;
          ctx.lineWidth = 1;
          for (let j = 0; j < 3; j++) {
            ctx.beginPath();
            ctx.moveTo(tileX + 10, tileY + 15 + j * 12);
            ctx.lineTo(tileX + tileSize - 10, tileY + 15 + j * 12);
            ctx.stroke();
          }

          // "Drawing..." text
          ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = `rgba(150, 160, 180, ${cardOpacity})`;
          ctx.fillText('Drawing...', cardX + cardWidth / 2, tileY + tileSize + 18);
        }
      } else {
        // Empty slot (waiting)
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = `rgba(120, 130, 150, ${cardOpacity * 0.6})`;
        ctx.fillText('Waiting...', cardX + cardWidth / 2, cardY + cardHeight / 2);
      }

      ctx.restore();
    });
  }

  /**
   * Render the winner announcement
   * @private
   */
  _renderStartingPlayerWinner(ctx, panelX, startY, panelWidth, anim, elapsed) {
    if (anim.winner === null) return;

    const playerColor = UIRenderer.PLAYER_COLORS[anim.winner % UIRenderer.PLAYER_COLORS.length];

    // Pulsing effect
    const pulse = 1 + 0.05 * Math.sin(elapsed * 6);

    ctx.save();
    ctx.translate(panelX + panelWidth / 2, startY + 25);
    ctx.scale(pulse, pulse);
    ctx.translate(-(panelX + panelWidth / 2), -(startY + 25));

    // Winner text
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = `rgba(${playerColor.r}, ${playerColor.g}, ${playerColor.b}, 1)`;
    ctx.textAlign = 'center';
    ctx.fillText(`Player ${anim.winner + 1} Starts!`, panelX + panelWidth / 2, startY + 25);

    // Decorative arrows
    ctx.font = '20px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 220, 100, 0.9)';
    ctx.fillText('>>> ', panelX + panelWidth / 2 - 120, startY + 25);
    ctx.fillText(' <<<', panelX + panelWidth / 2 + 85, startY + 25);

    ctx.restore();

    // Subtitle
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(200, 210, 230, 0.8)';
    ctx.fillText('Game will begin shortly...', panelX + panelWidth / 2, startY + 55);
  }

  /**
   * Render the tie announcement
   * @private
   */
  _renderStartingPlayerTie(ctx, panelX, startY, panelWidth, anim, elapsed) {
    // Flashing effect
    const flash = 0.7 + 0.3 * Math.sin(elapsed * 8);

    // Tie text
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = `rgba(255, 150, 100, ${flash})`;
    ctx.textAlign = 'center';
    ctx.fillText('TIE!', panelX + panelWidth / 2, startY + 20);

    // Tied players
    const tiedNames = anim.tiedPlayers.map(p => `Player ${p + 1}`).join(' & ');
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 200, 150, 0.9)';
    ctx.fillText(tiedNames, panelX + panelWidth / 2, startY + 42);

    // Redraw message
    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(180, 200, 230, 0.8)';
    ctx.fillText('Redrawing tiles...', panelX + panelWidth / 2, startY + 62);
  }
}
