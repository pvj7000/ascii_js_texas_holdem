# ASCII Texas Hold'em

A browser-based Texas Hold'em simulator rendered with ASCII terminal vibes. Play heads-up against four stylistically different computer opponents entirely in the browser—no build tools required.

## Project layout

```
/
├─ index.html            # Skeleton markup and control layout
├─ assets/
│  ├─ css/styles.css     # Theme and responsive tweaks
│  └─ js/
│     ├─ main.js         # App entrypoint wiring state + UI
│     ├─ utils.js        # Shared helpers (rng, clamping, money formatting)
│     ├─ core/           # Poker domain: cards, AI, betting flow, showdown
│     └─ ui/ui.js        # ASCII renderer + DOM control bindings
└─ README.md
```


## How to play

* **Goal:** Win chips by forming the best five-card poker hand or making everyone else fold.
* **Stacks & blinds:** You and each bot start with $1000. Blinds are fixed at $10/$20. Dealer rotates every hand.
* **Flow:**
  1. Pre-flop – blinds post, two hole cards to each player.
  2. Flop – three community cards.
  3. Turn – fourth community card.
  4. River – fifth community card.
  5. Showdown – best hand (or last player standing) takes the pot. Side pots handled automatically when someone is all-in.
* **Controls:**
  * **Fold** – surrender the hand immediately.
  * **Check/Call** – match the current bet (or check when nothing to call).
  * **Bet/Raise** – set the target “raise-to” amount in the input and click. Amount snaps to the nearest $10 and is clamped to legal limits.
  * **Next Hand** – become available after a showdown to continue playing.
  * **Restart** – appears when you bust to reset stacks and start over.
* **Log panel:** The latest events appear at the top. Community cards and pot info show inside the ASCII table.

## Table stakes

* **AI personas:** Rock (tight), Maniac (hyper-aggressive), Station (calls often), and Pro (balanced). Each weighs position, pot odds, and hand strength.
* **Betting engine:** Turn-order queue ensures everyone responds to raises—no more infinite raise loops from overeager maniacs.
* **Hand evaluator:** Supports full 7-card evaluation with straight/flush edge cases and side-pot distribution.
* **RNG:** Uses `crypto.getRandomValues` for shuffle integrity.

## Fair shuffling & learning odds

* **Accurate randomness:** Shuffling uses a Fisher–Yates pass where each swap index comes from `crypto.getRandomValues` (Web Crypto). That keeps all 52! permutations equally likely—no bias from `Math.random` or reused seeds.
* **Probability study tool:** Because each hand is unbiased and the evaluator runs full 7-card comparisons, you can treat the simulator like a lightweight odds lab:
  * Re-deal repeatedly on a street (e.g., click *Next Hand* preflop) to build intuition for how often certain starting hands make top pairs, draws, or premium holdings.
  * Watch the log and on-board HUD to see pot odds and stack pressures in context; the AIs respond to position and strength, so you can observe how ranges tighten/loosen as community cards appear.
  * Pause after the flop/turn and estimate your equity versus the field; then play out the hand to compare your guess with the showdown results to calibrate your reads.

## Notes

* Tested in Chromium-based and Firefox browsers; mobile layout uses responsive CSS to keep the ASCII canvas readable.
* No external dependencies. View-source friendly.

Enjoy the neon-terminal showdown!  
Pull requests and hacks welcome.
