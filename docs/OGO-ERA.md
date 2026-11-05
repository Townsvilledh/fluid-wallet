# OGO ERA + Fluid + Companion SBT — The Bible

*OGO ERA is a street-football **RPG** (not a MOBA): an intelligent,
interactive role-playing game with Lagos culture and storytelling at its
heart, and a real sense of belonging for its players. Your character is
your Companion; your progression is on-chain; your rewards are real.*

---

## OGO ERA — THE GAME

**What it is:** Street football set in Lagos. Not FIFA. Fast, small-sided,
3v3 / 4v4, on dusty pitches, under bridges, in markets. The culture is
Lagos street football: nutmegs, skills, trash talk, celebrations.

**Why it exists:** Gaming is the distribution layer for Fluid. Instead of
boring airdrops, users earn RAIN by playing. It teaches financial skills
through play (saving, risk, teamwork) and makes the AI Companion feel
alive, not like a chatbot.

**Genre:** RPG. You grow a character (your Companion), level up, unlock
abilities (coaching voice lines, new plays), build traits, join squads,
and live a story — yours — across seasons. Match play borrows the best
of intelligent interactive games, but progression, identity and
belonging are RPG to the core.

**Core loop:**
1. User opens Fluid wallet → sees Companion (their AI teammate)
2. Taps "Play OGO ERA"
3. Plays a 5–10 min match (sprints)
4. Earns stats: goals, assists, nutmegs, boxes smashed, saves coached
5. Claims RAIN via in-game action (Easter-egg claims, below)
6. Companion levels up, unlocks new coaching voice lines, new plays
7. Balance in Fluid increases, saver score increases

## FLUID + OGO ERA INTEGRATION

**One wallet, two views.** Fluid is not a separate login for the game.
OGO ERA does NOT have its own account system. It reads your Fluid wallet
directly.

- **Fluid Wallet Home:** shows balances (fiat view, BTC savings), UBI
  claimable, Companion avatar
- **OGO ERA Home:** same wallet, game view — your Companion, your team,
  your level, your RAIN pending

When you play, you spend and earn from the same wallet. No separate
in-game currency you can't withdraw. RAIN is real, on Arc chain,
convertible to local currency through the wallet's global ramp routing
(Nigeria: Busha/Moove corridors and Fonbnk; globally: the ramp providers
in the wallet's Ramps sheet).

**No login server:** the game reads the Companion SBT object on Sui. If
you own Companion #123, the game knows your level, traits and inventory.
Lose your phone and recover the wallet via shards, and you automatically
recover your game progress — it's on-chain, not on Fluid's server.

## COMPANION SBT — THE HEART

**What it is:** a Soulbound Token — a non-transferable NFT representing
your AI companion. Not for speculation. Your passport, your teammate,
your financial identity.

**Why soulbound:** if it could be sold, phishers could steal your
identity. Soulbound means permanently tied to your wallet address. Only
you own it. Only you can update it. *(Implemented in
`contracts/companion.move`: `key`-only struct — no `store`, so the type
system itself forbids transfer.)*

**Minting:**
- Auto-minted at Fluid wallet creation. The user never needs to know
  about NFTs — they just see "Meet Kemi, your companion."
- Gas sponsored for the first mint (~$0.001 on Sui).
- Fields at mint: `name` (user picks, e.g. Kemi), `personality_seed`,
  `level: 1`, `wallet_addr`, `model_hash` (hash of the open-source base
  AI model, for verifiability).

**Companion as a living object (Sui model):** Sui uses an object model,
not an ERC-721 JSON pointer. ERC-721 = token points to JSON; updating a
level rewrites the whole JSON. Sui = live struct with fields. Update
`level` 1 → 2 with a single field write: cheap, fast, parallelisable
for thousands of players.

**Dynamic fields = memory & growth** (owner-signed updates only):
- `games_played`, `goals`, `assists`, `nutmegs`
- `saves_coached` — how many times the AI helped the user save
- `lessons_completed` — financial education lessons
- `traits`: `{ playstyle: "left-wing", risk_profile: "saver", aggression: 0.3 }`
- `achievements`: ["Saver Lv5", "Nutmeg King", "10 Sprints"]
- `rains_claimed`
- `finance_score`: /100 — used by lending apps

*(Headline stats are first-class struct fields in the contract;
everything else lives in dynamic fields.)*

**Privacy boundary:**
- Public on-chain: level, games_played, achievements, finance_score
  (public badge).
- Private on-device: spending patterns, personal notes, private coaching
  conversations, income. NEVER on-chain. AI private memory stays local.

**Companion as inventory owner:** Sui lets NFTs own other NFTs. Your
Companion can own child objects — Boots, Badges (e.g. "Saver Lv5"),
pending RAIN rewards, coaching certificates. Example: Ada's Companion
Kemi owns Boots "Lagos Street", Badge "Saver Lv5", and 50 RAIN pending
claim. When Ada plays, Kemi equips those boots.

## COMPANION ROLE IN GAME — NOT A DUMB JPEG

**1. Teammate.** Your Companion is literally on your team. In 3v3 it's
you + Companion + 1 human friend or AI. The Companion plays by its
traits and level:
- Level 1 Kemi: slow, simple passes, basic coaching — "Pass, pass!"
- Level 5 Kemi: reads the game, plays through balls — "Ada, cut left, I
  see space, save your sprint for the final minute."
- Traits matter: a "saver" risk profile plays conservatively and
  protects a lead; "aggressive" presses high.

**2. Coach.** Between and during matches:
- Financial coaching: "You saved ₦5,000 this week. That's like scoring
  2 goals. Keep it up — new boots in 2 weeks."
- Game coaching: "You nutmegged 3 times but lost the ball 5 times
  dribbling. Try pass first."
- Lessons: after 10 sprints, new coaching voice lines unlock as
  level-up rewards.

**3. Game pass / identity.** No username/password — the game reads the
Companion object. Your Companion IS your login. The same Companion works
in other apps: a lending dApp reads `finance_score` = 78 → offers a
lower rate; an education app reads `lessons_completed` = 12 → skips the
intro.

**4. Level-up logic.** Win match → device creates an unsigned intent
`level_up(companion_id, stats)` → user approves via biometric (or
auto-approves if enabled for game stats only — money always needs
biometric) → Sui updates the object. Object-centric = thousands of
players level up in parallel, cheap.

**5. Social / squad.** Circles UBI squads = OGO ERA squads. Four friends,
four Companions. A squad can create its own group UBI on Gnosis and
distribute to members by games played. Companion traits combine into
squad chemistry.

## RAIN — IN-GAME EARNING SYSTEM

**What is RAIN:** reward token on Arc (USDC-based or RAIN token).
Earned, not airdropped.

**Why not a direct airdrop:** direct airdrop = boring notification, bots
farm, no engagement. Earned claim = retention, dopamine, proof of play.

**Easter-egg hunt claim system:**
1. Weekly pool split per user off-chain, based on activity.
2. Creates a claimable pending object (accept-only). It sits pending —
   NOT in the spendable balance.
3. In-game the user sees: glowing crate, floating RAIN coin,
   "Unclaimed: 50 RAIN".
4. The user must perform an action to claim: smash a supply box, nutmeg
   an opponent, assist the Companion (pass to Kemi, she scores), a funny
   goal celebration.
5. On the action, the client creates a proof (Merkle proof on Arc, or
   Sui object accept) → calls `claim_rain(companion_id)` → 50 RAIN lands
   in the Fluid balance with a popup: "You found 50 RAIN! +1 Level for
   Kemi."
6. Unclaimed after 7 days → expires back to the pool. No gas wasted.

**Technical:** Arc — Merkle distributor, ~$0.01 gas, proof verification.
Sui — RAIN as a child object of a pending drop, accepted into the
Companion's inventory.

**The beautiful flow:** Ada creates a Fluid wallet → Companion "Kemi"
minted instantly, soulbound → Kemi appears in wallet home and in OGO ERA
as a teammate → after 10 sprints Kemi levels to 2 on-chain and unlocks
new coaching voice lines → Ada smashes a glowing crate, claims 50 RAIN →
balance updates in Fluid → Ada's private finance coaching stays on her
device, but her public "Saver Lv5" badge is verifiable on Sui for any
app to respect.

## CROSS-GAME / CROSS-LIFE UTILITY

The same Companion works outside the game:
- **Lending:** reads `finance_score`
- **Education:** reads `lessons_completed`
- **UBI:** reads `games_played` to prove human activity for GoodDollar /
  Circles
- **Future games:** the same Companion carries over

On Sui (or bridged via CCTP from Arc), it is composable across
ecosystems while staying user-owned.

## SECURITY & PRIVACY FOR THE GAME

- The AI cannot sign for the NFT. It creates unsigned update intents;
  the user approves via the biometric signer. Same boundary as money.
- The game cannot move funds. It can only request `level_up` or
  `claim_rain` intents, which pass through the signer.
- If the game is hacked, the attacker can't steal the wallet. Only the
  signer can sign.

## SUMMARY IN ONE LINE

OGO ERA is not a game with a wallet. **Fluid is a wallet with a game.**
The Companion SBT is the bridge: teammate, coach, passport, inventory
and financial identity in one soulbound object you own, that levels up
by playing, and that earns real RAIN you can spend.

## GAME FEES — THE SPLIT (set 2026-11-06)
Tournament rake and any game fees split four ways, settled in BTC over
Lightning (see `docs/FEES.md`): 40% treasury (Ethuram), 20% top-100
leaderboard pool, 20% session lottery for the session's other active
players, 20% weekly active-referral rewards. The game gives most of its
fees back to the people playing it — that's the belonging engine.

## BUILD ORDER (wallet-first, agreed)
- [x] Fluid wallet v2 with Play tab (live, open source)
- [x] Companion contract with headline stat fields (Sui Move)
- [ ] Companion testnet deploy + mint-on-first-open in the wallet (needs
      a Sui account in Fluid — the next chain after EVM + Bitcoin)
- [ ] RAIN Merkle distributor (Arc) + claim button in the Play tab
- [ ] OGO ERA playable RPG prototype: match engine, Companion teammate
      AI by traits/level, storytelling & squad system
- [ ] UBI hub: GoodDollar / World / Circles claims in-wallet
