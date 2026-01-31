/**
 * Trinity - Event Cards Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EventCategory,
  EventTarget,
  EventCards,
  getAllEventTypes,
  createEventDeck,
  shuffleArray,
  getEventById,
  eventRequiresTarget,
  getTotalEventCards,
} from '../src/game/EventCards.js';

describe('EventCards', () => {
  describe('EventCategory', () => {
    it('has IMMEDIATE and TACTICAL categories', () => {
      expect(EventCategory.IMMEDIATE).toBe('immediate');
      expect(EventCategory.TACTICAL).toBe('tactical');
    });
  });

  describe('EventTarget', () => {
    it('has all target types defined', () => {
      expect(EventTarget.NONE).toBe('none');
      expect(EventTarget.SELF).toBe('self');
      expect(EventTarget.OPPONENT).toBe('opponent');
      expect(EventTarget.TILE).toBe('tile');
      expect(EventTarget.LANDMARK).toBe('landmark');
      expect(EventTarget.AGENT).toBe('agent');
      expect(EventTarget.ANY_TILE).toBe('any-tile');
    });
  });

  describe('EventCards definitions', () => {
    it('has all 19 event types defined', () => {
      const types = Object.keys(EventCards);
      expect(types.length).toBe(19);
    });

    it('each event has required properties', () => {
      for (const [key, event] of Object.entries(EventCards)) {
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('name');
        expect(event).toHaveProperty('description');
        expect(event).toHaveProperty('category');
        expect(event).toHaveProperty('target');
        expect(event).toHaveProperty('copies');
        expect(event).toHaveProperty('effect');
        expect(typeof event.id).toBe('string');
        expect(typeof event.name).toBe('string');
        expect(typeof event.description).toBe('string');
        expect(typeof event.copies).toBe('number');
        expect(event.copies).toBeGreaterThan(0);
      }
    });

    it('categories are valid', () => {
      for (const event of Object.values(EventCards)) {
        expect([EventCategory.IMMEDIATE, EventCategory.TACTICAL]).toContain(event.category);
      }
    });

    it('targets are valid', () => {
      const validTargets = Object.values(EventTarget);
      for (const event of Object.values(EventCards)) {
        expect(validTargets).toContain(event.target);
      }
    });
  });

  describe('getAllEventTypes', () => {
    it('returns array of all event types', () => {
      const types = getAllEventTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBe(19);
    });

    it('returns same events as EventCards values', () => {
      const types = getAllEventTypes();
      const cardValues = Object.values(EventCards);
      expect(types).toEqual(cardValues);
    });
  });

  describe('createEventDeck', () => {
    let deck;

    beforeEach(() => {
      deck = createEventDeck();
    });

    it('creates correct total number of cards', () => {
      // Sum of all copies
      const expectedTotal = Object.values(EventCards).reduce((sum, e) => sum + e.copies, 0);
      expect(deck.length).toBe(expectedTotal);
    });

    it('creates 36 cards (per rulebook)', () => {
      // 19 events with various copy counts, totaling 36 per rulebook
      expect(deck.length).toBe(36);
    });

    it('each card has an instanceId', () => {
      for (const card of deck) {
        expect(card).toHaveProperty('instanceId');
        expect(typeof card.instanceId).toBe('string');
      }
    });

    it('cards have unique instanceIds', () => {
      const ids = deck.map(c => c.instanceId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(deck.length);
    });

    it('instanceId format is eventId-index', () => {
      const marketCrashCards = deck.filter(c => c.id === 'market-crash');
      expect(marketCrashCards.length).toBe(2); // Market Crash has 2 copies
      expect(marketCrashCards[0].instanceId).toBe('market-crash-0');
      expect(marketCrashCards[1].instanceId).toBe('market-crash-1');
    });

    it('cards retain all original properties', () => {
      const constructionBoom = deck.find(c => c.id === 'construction-boom');
      expect(constructionBoom.name).toBe('Construction Boom');
      expect(constructionBoom.category).toBe(EventCategory.IMMEDIATE);
      expect(constructionBoom.effect).toBe('DRAW_TILES');
      expect(constructionBoom.effectParams.count).toBe(3);
    });
  });

  describe('shuffleArray', () => {
    it('shuffles array in place', () => {
      const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const arr = [...original];
      shuffleArray(arr);

      // Check same length
      expect(arr.length).toBe(original.length);

      // Check contains same elements
      expect(arr.sort((a, b) => a - b)).toEqual(original);
    });

    it('returns the same array reference', () => {
      const arr = [1, 2, 3];
      const result = shuffleArray(arr);
      expect(result).toBe(arr);
    });

    it('actually shuffles (statistical test)', () => {
      // Run multiple times and check that order varies
      const results = [];
      for (let i = 0; i < 10; i++) {
        const arr = [1, 2, 3, 4, 5];
        shuffleArray(arr);
        results.push(arr.join(','));
      }

      // Not all results should be identical (very unlikely with 5! = 120 permutations)
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBeGreaterThan(1);
    });
  });

  describe('getEventById', () => {
    it('returns event for valid id', () => {
      const event = getEventById('market-crash');
      expect(event).toBeDefined();
      expect(event.name).toBe('Market Crash');
    });

    it('returns undefined for invalid id', () => {
      const event = getEventById('invalid-event');
      expect(event).toBeUndefined();
    });

    it('returns correct events for all valid ids', () => {
      for (const card of Object.values(EventCards)) {
        const result = getEventById(card.id);
        expect(result).toBeDefined();
        expect(result.id).toBe(card.id);
        expect(result.name).toBe(card.name);
      }
    });
  });

  describe('eventRequiresTarget', () => {
    it('returns false for NONE target', () => {
      const event = { target: EventTarget.NONE };
      expect(eventRequiresTarget(event)).toBe(false);
    });

    it('returns false for SELF target', () => {
      const event = { target: EventTarget.SELF };
      expect(eventRequiresTarget(event)).toBe(false);
    });

    it('returns true for OPPONENT target', () => {
      const event = { target: EventTarget.OPPONENT };
      expect(eventRequiresTarget(event)).toBe(true);
    });

    it('returns true for TILE target', () => {
      const event = { target: EventTarget.TILE };
      expect(eventRequiresTarget(event)).toBe(true);
    });

    it('returns true for LANDMARK target', () => {
      const event = { target: EventTarget.LANDMARK };
      expect(eventRequiresTarget(event)).toBe(true);
    });

    it('returns true for AGENT target', () => {
      const event = { target: EventTarget.AGENT };
      expect(eventRequiresTarget(event)).toBe(true);
    });

    it('returns true for ANY_TILE target', () => {
      const event = { target: EventTarget.ANY_TILE };
      expect(eventRequiresTarget(event)).toBe(true);
    });

    it('works with actual event cards', () => {
      // Construction Boom targets SELF
      expect(eventRequiresTarget(EventCards.CONSTRUCTION_BOOM)).toBe(false);

      // Insider Trading targets NONE
      expect(eventRequiresTarget(EventCards.INSIDER_TRADING)).toBe(false);

      // Rezoning targets TILE
      expect(eventRequiresTarget(EventCards.REZONING)).toBe(true);

      // Market Crash targets OPPONENT
      expect(eventRequiresTarget(EventCards.MARKET_CRASH)).toBe(true);
    });
  });

  describe('getTotalEventCards', () => {
    it('returns correct total count', () => {
      const total = getTotalEventCards();
      const expected = Object.values(EventCards).reduce((sum, e) => sum + e.copies, 0);
      expect(total).toBe(expected);
    });

    it('returns 36 for rulebook-compliant event definitions', () => {
      expect(getTotalEventCards()).toBe(36);
    });
  });

  describe('Specific event configurations', () => {
    it('Market Crash discards to 3 tiles', () => {
      const event = EventCards.MARKET_CRASH;
      expect(event.effect).toBe('DISCARD_TO_HAND_SIZE');
      expect(event.effectParams.handSize).toBe(3);
    });

    it('Construction Boom draws 3 tiles', () => {
      const event = EventCards.CONSTRUCTION_BOOM;
      expect(event.effect).toBe('DRAW_TILES');
      expect(event.effectParams.count).toBe(3);
    });

    it('Insider Trading peeks at 5 tiles', () => {
      const event = EventCards.INSIDER_TRADING;
      expect(event.effect).toBe('PEEK_AND_REORDER_DECK');
      expect(event.effectParams.count).toBe(5);
    });

    it('Expedited Permits draws 2 events', () => {
      const event = EventCards.EXPEDITED_PERMITS;
      expect(event.effect).toBe('DRAW_EVENTS');
      expect(event.effectParams.count).toBe(2);
    });

    it('Stakeout views opponent events and 3 deck tiles', () => {
      const event = EventCards.STAKEOUT;
      expect(event.effect).toBe('VIEW_HIDDEN_INFO');
      expect(event.effectParams.viewEvents).toBe(true);
      expect(event.effectParams.viewDeck).toBe(3);
    });

    it('Insurance Claim has reactive trigger', () => {
      const event = EventCards.INSURANCE_CLAIM;
      expect(event.trigger).toBe('ON_LANDMARK_LOST');
    });

    it('Hostile Acquisition has 2 copies (per rulebook)', () => {
      expect(EventCards.HOSTILE_ACQUISITION.copies).toBe(2);
    });

    it('Reinforcements targets own HQ', () => {
      const event = EventCards.REINFORCEMENTS;
      expect(event.target).toBe(EventTarget.LANDMARK);
      expect(event.targetFilter).toBe('OWN_HQ');
    });
  });
});
