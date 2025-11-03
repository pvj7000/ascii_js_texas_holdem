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

## Notes

* Tested in Chromium-based and Firefox browsers; mobile layout uses responsive CSS to keep the ASCII canvas readable.
* No external dependencies. View-source friendly.

Enjoy the neon-terminal showdown!  
Pull requests and hacks welcome.
