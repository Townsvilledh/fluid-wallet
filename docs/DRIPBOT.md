# DripBot — @bitcoinornatin · #bitcoinornothing

The promotion and distribution engine of Fluid. X account:
**@bitcoinornatin** ("Bitcoin Or Nothing"), hashtag **#bitcoinornothing**.

## What DripBot is
An AUTONOMOUS special-purpose account — deliberately "the odd account
in Fluid". Ethuram did not give it a normal Fluid wallet, because it is
not a user wallet. It:

- **Does NOT support on-ramp or off-ramp.** Never buys, never sells,
  never touches fiat. (The corridor/ramps system is for users only.)
- **Only RECEIVES BTC over Lightning** — its income is platform fees:
  the 40% DripBot share of wallet-side fees (see `docs/FEES.md`), swept
  and converted from whatever asset the fee was collected in into BTC.
- **Only PAYS OUT BTC over Lightning:**
  1. **Weekly follower drip** — followers of @bitcoinornatin request
     the weekly "FLUID drip" (reply/quote the drip post with their
     Lightning address or Fluid Name). **Preference to active
     followers who support and promote Fluid** (reposts, original
     posts about Fluid, Fluid Name owners, OGO ERA players).
  2. **OGO ERA player pools** — the game's 20% top-100 pool, 20%
     session lottery and 20% weekly referral rewards are distributed
     by DripBot from the game's published activity data.
- **Balance grows with the community:** more Fluid usage → more fees →
  bigger drips. DripBot publishes its balance and every payout, so the
  growth is public and verifiable. No external funding, no promises
  beyond what the fee flow actually produced.

## Promotion duties (the @bitcoinornatin account)
Run by Muse as Ethuram's agent, inside X's rules and rate limits:
- **Repost & quote in-depth Bitcoin content** (tech, Lightning,
  self-custody, monetary history) — real substance, not spam.
- **Promote Fluid heavily and honestly** as what it is: a dope, cool,
  open-source Web3 wallet — every chain (15 EVM L1s/L2s, Bitcoin,
  Lightning), one seed, your name under fluid.is-a.dev, global
  local-currency ramps, OGO ERA built in. Claims stay truthful
  (prototype status included) — hype that lies burns the brand.
- **Weekly rhythm:** Bitcoin deep-dive reposts through the week, Fluid
  feature posts, the weekly drip announcement + payout proofs, OGO ERA
  teasers as the game builds.

## Autonomy design (how it runs without Ethuram in the loop)
- DripBot's Lightning wallet is a dedicated custodial-free setup the
  bot controls (e.g. an LNURL/NWC-connected wallet) with hard caps:
  per-drip max, weekly max, and a reserve floor it may never pay out.
- Content is prepared in batches and posted on schedule; anything
  unusual (partnership asks, giveaways beyond the weekly drip,
  anything spending beyond caps) goes to Ethuram first.
- The account needs ONE sign-in from Ethuram in the browser; after
  that Muse runs the routine under his standing instruction.

## Safety rails
- Never asks followers for seed phrases, deposits or "double-your-BTC"
  anything. The drip is one-way: DripBot pays, followers never pay.
- Impersonation is the #1 risk for a drip account: every real payout
  post comes only from @bitcoinornatin and links the Lightning payment
  proof.

## Mechanics — clarified by Ethuram, 2026-11-06 10:21 WAT

These points OVERRIDE the earlier reserve-floor/caps language above where
they conflict:

1. **One identity, two faces (paired accounts).** The @bitcoinornatin X
   account and the DripBot Fluid agent wallet are a pair — the same entity.
   Pairing is public and verifiable: the wallet descriptor carries the X
   handle; the X bio carries the wallet's Fluid name + addresses. One
   operator (Muse, or the autonomous runtime) runs both sides.
2. **The drip wallet is a DISTRIBUTOR, not a reserve.** Fluid's fees are
   small — a few cents added on the cheapest available route for whatever
   network the user is on (Arbitrum cheapest on Arbitrum, Base cheapest on
   Base, etc.). Fee profit splits 60% Ethuram / 40% drip wallet. The 40%
   stacks up during the week; at the weekly drip it is paid OUT to active
   users. Funds are not held back as a reserve — if the week brings $1,000
   of fees, the drip wallet's ~$400 goes to users that week.
3. **No fixed dollar caps on distribution.** Fixed $/tx or $/day caps
   (the generic agent defaults) do NOT fit this wallet: they would strangle
   a big week. Drip sizing is proportional to the pot and to each winner's
   activity share. The only rails are sanity rails: no single payment may
   exceed the pot, payouts are batched and published, and anomalous
   patterns (brand-new accounts farming) are filtered by the scoring.
4. **Winner selection reads BOTH sides of the pair:**
   - X side: followers who genuinely engage @bitcoinornatin — replies,
     reposts, quotes, quality posts promoting Fluid/Bitcoin.
   - Wallet side: real Fluid activity under a user's Fluid name — sends,
     swaps, RAIN claims, agent usage.
   Scores combine; the week's pot is split across top active usernames,
   with preference to people active on BOTH sides (they are the promoters
   who also use the product).
5. **Rewards are addressed by Fluid username** (name.fluid.is-a.dev →
   keys), paid in BTC over Lightning as before. A winner with no Fluid
   name yet is told to claim one — the drip doubles as wallet onboarding.
