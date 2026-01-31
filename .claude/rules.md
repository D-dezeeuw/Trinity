# Trinity - Rules Clarification

## Tile Placement

- [x] Can tiles be placed anywhere on the board, or must they connect to your existing tiles?
  > **Answered in rules:** Must be placed adjacent to your other tiles orthogonally.

- [x] How is tile ownership determined?
  > **Answered in rules:** Tiles belong to the player who placed them.

- [x] Does "adjacent" include diagonal adjacency?
  > **Answered in rules:** Orthogonal only (up/down/left/right).

- [ ] **First tile placement:** Where does the first player place their first tile?
  > **Suggestion:** Similar to Blokus, each player starts from a designated corner. With 2 players, use opposite corners. With 4 players, one corner each. Alternatively, like Carcassonne, the first tile goes in the center.

  Proposed solution: you can start in the first two rows closest to you like in chess, with 4 players you start in a corner

## Trinity Formation

- [x] Must all 3 tiles belong to the same player?
  > **Answered in rules:** Yes, same player required.

- [x] Can you "steal" a trinity using opponents' tiles?
  > **Answered in rules:** No, tiles must be your own.

- [x] **Multiple trinities:** What if placing one Life tile connects to two separate Commerce+Industry pairs?
  > **Suggestion:** Allow forming multiple trinities in one placement (rewarding clever positioning), OR limit to one trinity per turn (simpler). I'd recommend allowing multiples - it creates satisfying combo moments like Azul or Ticket to Ride.

  Proposed Solution: Allow forming multiple trinities at once

- [x] What happens to vacated spaces when tiles stack into a trinity?
  > **Implied:** The Commerce and Industry spaces become empty and available again. This is interesting - it means the board can "breathe" and trinities actually free up space.

  Proposed Solution: Yes the tiles are freed up (like real estate, where objects move to a new skyscraper)

- [x] **Trinity Propagation Rule:** When placing a tile, which Housing tiles can form a Trinity?
  > **Rule:** When any tile is placed, check ALL adjacent Housing tiles (not just the placed tile) to see if they can now complete a Trinity. The Trinity always forms ON the Housing tile.
  >
  > **Example:** If Commerce is placed at (2,2), and there's a Housing at (2,3) with an Industry at (2,4), the Housing at (2,3) can now form a Trinity even though it wasn't the tile just placed.
  >
  > **Implementation:** After placing a tile, iterate through all adjacent positions. For each adjacent Housing tile owned by the same player, check if it has both a Commerce and Industry neighbor.

## Combat & Army

- [x] How does combat work?
  > **Answered in rules:** Stack-based. You need equal army stack height as the target to destroy it. Tile for tile exchange.

- [x] What is a Barracks?
  > **Answered in rules:** When you convert a Trinity, it becomes a "Barracks" tower of 3 army tiles on that space. Keep in mind that you lose the trinity, which you need to win the game.

- [ ] **Combat resolution:** When you attack, are both stacks destroyed, or just the defender?
  > **Suggestion:** Both destroyed (attacker sacrifices armies). This matches "tile for tile" and creates meaningful cost to aggression, similar to Risk's attrition. Destroyed tiles return to C. Stack per the Recycle rule.

- [ ] **Attack range:** Can you attack any tile on the board, or only adjacent tiles?
  > **Suggestion:** Adjacent only makes thematic sense (armies march from barracks to neighboring territories). This also creates interesting defensive positioning.

- [ ] **Barracks rebuilding:** When a Barracks is destroyed, is that space now empty?
  > **Suggestion:** Yes, space becomes empty and contested. The attacking armies are also consumed in the attack.

- [ ] **Barracks movement:** You can move the tiles of the Barracks one space at a time, but one tile per space per turn. Keep in mind that moving tiles from barracks, makes the barrack itself weaker and easier to attack.

## Tile Distribution

- [ ] How many total tiles in the Civilisation Stack?
  > **Suggestion (8x8 board = 64 spaces):**
  > - 24 Life tiles
  > - 24 Commerce tiles
  > - 24 Industry tiles
  > - Total: 72 tiles (slight overflow ensures game always ends by board fill)
  >
  > Equal distribution ensures no single type becomes a bottleneck. The slight surplus accounts for recycling and ensures the endgame triggers reliably.

- [ ] How many Army tiles exist?
  > **Suggestion:** Unlimited pool (use tokens/cubes). Armies only come from converting trinities, so they're self-balancing. Alternatively, cap at 20-30 total army tokens to force conversion decisions.

  Proposed Solution: The underside of a regular tile (Life, Commerce, Industry) has an Army logo. so when the tile is flipped it is now an army tile.

## Events

- [ ] Examples of events?
  > **Suggestions based on similar games:**
  >
  > **Immediate (play now):**
  > - "Earthquake" - Remove one of your tiles from the board
  > - "Migration" - Move one of your tiles to an adjacent empty space
  > - "Bounty" - Draw 2 extra tiles this turn
  >
  > **Tactical (hold and play later):**
  > - "Fortify" - Place 1 free army on any of your tiles
  > - "Sabotage" - Remove 1 army from an opponent's stack
  > - "Expansion" - Place a tile ignoring adjacency rules this turn
  > - "Shield" - Block one attack against you (discard after use)
  > - "Conscription" - Convert a single tile to 1 army (doesn't need to be a trinity, but only through event card)

- [ ] How many event cards?
  > **Suggestion:** 20-30 cards. Since you draw one per trinity formed, and a typical game might see 15-25 trinities total, this ensures variety without repetition.

## Balance & Edge Cases

- [ ] Catch-up mechanic for trailing players?
  > **Current design has natural catch-up:** When leaders convert trinities to armies, they stop scoring. When they attack, both sides lose tiles. Trailing players can quietly build while leaders fight.
  >
  > **Optional additions:**
  > - "Underdog" event cards that trigger when you have fewer trinities
  > - Allow players with 0 trinities to draw 2 tiles instead of 1

  Proposed Solution: Add Underdog status, allowing 2 tile draws instead of one.

- [ ] Can a player mulligan their starting hand?
  > **Suggestion:** Yes, one free mulligan (shuffle back, draw 5 new). Prevents feel-bad starts where someone draws 4 Industry and a Commerce.

- [ ] What if C. Stack runs out before board is full?
  > **Suggestion:** Shuffle the discard/recycle pile to reform the C. Stack. If no tiles to recycle, players skip draw phase and play with what they have until board fills.

- [ ] How many tiles can you place per turn?
  > **Suggestion:** No limit - place as many as you can/want from your hand. This rewards efficient hand management and creates tempo decisions (place now vs. hold for better combos). Alternatively, limit to 3 placements per turn for more controlled pacing.

  Proposed Solution: unlimited placement. you only draw one or two cards anyway. with an event you could gain more card which makes it interesting to flood the board.

## Additional Suggestions

**Starting setup:** Each player places their first tile on their designated starting corner. This prevents first-player advantage of claiming the center.

**Turn structure (clarified):**
1. **Draw phase:** Draw 1 tile + 1 per trinity owned
2. **Placement phase:** Place any number of tiles, resolve trinities
3. **Attack phase:** Make attacks with available armies
4. **End turn**

**Hand limit:** Consider a max hand size (e.g., 8 tiles) to prevent hoarding and force decisions.
