import type {
  DraftTowerOffer,
  EmitterId,
  RngState,
  RunState,
  UpgradeId,
} from "./types";
import { gameConfig } from "./config";
import { nextRandom } from "./rng";
import { createTower } from "./towerFactory";

export function createDraftState(state: RunState): { readonly draft: NonNullable<RunState["draft"]>, readonly rng: RngState } {
  const towerOffers = generateTowerOffers(state, state.rng);
  const upgradeOffers = generateUpgradeOffers(state, towerOffers.rng);

  return {
    rng: upgradeOffers.rng,
    draft: {
      step: "tower",
      rerollsRemaining: gameConfig.balance.rerollsPerDraft,
      towerOffers: towerOffers.offers,
      upgradeOffers: upgradeOffers.offers,
    },
  };
}

export function rerollDraft(state: RunState): RunState {
  if (!state.draft || state.draft.rerollsRemaining <= 0) {
    return state;
  }

  const generated = state.draft.step === "tower"
    ? generateTowerOffers(state, state.rng)
    : generateUpgradeOffers(state, state.rng);

  return {
    ...state,
    rng: generated.rng,
    draft: {
      ...state.draft,
      rerollsRemaining: state.draft.rerollsRemaining - 1,
      towerOffers: state.draft.step === "tower" ? generated.offers as readonly DraftTowerOffer[] : state.draft.towerOffers,
      upgradeOffers: state.draft.step === "upgrade" ? generated.offers as readonly UpgradeId[] : state.draft.upgradeOffers,
    },
  };
}

export function chooseDraftTower(state: RunState, emitterId: EmitterId): RunState {
  if (state.draft?.step !== "tower" || !state.draft.towerOffers.some(offer => offer.emitterId === emitterId)) {
    return state;
  }

  const tower = createTower(`tower-${emitterId}-${state.waveIndex}-${state.tick}`, emitterId, null);

  return {
    ...state,
    bench: [...state.bench, tower],
    draft: {
      ...state.draft,
      step: "upgrade",
    },
  };
}

export function chooseDraftUpgrade(state: RunState, upgradeId: UpgradeId): RunState {
  if (state.draft?.step !== "upgrade" || !state.draft.upgradeOffers.includes(upgradeId)) {
    return state;
  }

  const current = state.upgrades.find(upgrade => upgrade.upgradeId === upgradeId);
  const definition = gameConfig.upgrades.find(upgrade => upgrade.id === upgradeId);
  const nextStacks = Math.min((current?.stacks ?? 0) + 1, definition?.maxStacks ?? 1);
  const upgrades = current
    ? state.upgrades.map(upgrade => upgrade.upgradeId === upgradeId ? { ...upgrade, stacks: nextStacks } : upgrade)
    : [...state.upgrades, { upgradeId, stacks: nextStacks }];

  return advanceAfterDraft({
    ...state,
    upgrades,
  });
}

export function advanceAfterDraft(state: RunState): RunState {
  return {
    ...state,
    phase: "countdown",
    waveIndex: Math.min(state.waveIndex + 1, gameConfig.waves.length - 1),
    countdownMs: gameConfig.balance.postDraftCountdownMs,
    draft: null,
    waveRuntime: null,
  };
}

function generateTowerOffers(
  state: RunState,
  initialRng: RngState,
): { readonly offers: readonly DraftTowerOffer[], readonly rng: RngState } {
  let rng = initialRng;
  const synergies = getSynergyEmitterIds(state);
  const requiredOffers = getRequiredTowerOffers(state);
  const allEmitters = gameConfig.emitters.map(emitter => emitter.id);
  const offers: DraftTowerOffer[] = [];
  const support = pickEmitter(rng, synergies.length > 0 ? synergies : allEmitters, offers);

  rng = support.rng;
  offers.push({ emitterId: support.emitterId, role: "support" });

  requiredOffers.forEach((emitterId) => {
    addOrReplaceOffer(offers, { emitterId, role: "pivot" }, synergies);
  });

  while (offers.length < 3) {
    const role = offers.some(offer => offer.role === "generic") ? "pivot" : "generic";
    const picked = pickEmitter(rng, role === "pivot" ? getPivotEmitterIds(state) : allEmitters, offers);

    rng = picked.rng;
    offers.push({ emitterId: picked.emitterId, role });
  }

  if (!offers.some(offer => synergies.includes(offer.emitterId))) {
    const picked = pickEmitter(
      rng,
      synergies.length > 0 ? synergies : allEmitters,
      offers.filter(offer => offer.role !== "support"),
    );

    rng = picked.rng;
    addOrReplaceOffer(offers, { emitterId: picked.emitterId, role: "support" }, synergies);
  }

  return {
    rng,
    offers: offers.slice(0, 3),
  };
}

function generateUpgradeOffers(
  state: RunState,
  initialRng: RngState,
): { readonly offers: readonly UpgradeId[], readonly rng: RngState } {
  let rng = initialRng;
  const available = gameConfig.upgrades
    .filter(upgrade => getUpgradeStacks(state, upgrade.id) < upgrade.maxStacks)
    .map(upgrade => upgrade.id);
  const fallback = gameConfig.upgrades.map(upgrade => upgrade.id);
  const pool = available.length > 0 ? available : fallback;
  const offers: UpgradeId[] = [];

  while (offers.length < Math.min(3, pool.length)) {
    const picked = pickUpgrade(rng, pool, offers);

    rng = picked.rng;
    offers.push(picked.upgradeId);
  }

  return { rng, offers };
}

function addOrReplaceOffer(
  offers: DraftTowerOffer[],
  nextOffer: DraftTowerOffer,
  synergyEmitterIds: readonly EmitterId[],
): void {
  const existingIndex = offers.findIndex(offer => offer.emitterId === nextOffer.emitterId);

  if (existingIndex >= 0) {
    offers[existingIndex] = {
      ...offers[existingIndex]!,
      role: offers[existingIndex]!.role === "support" ? "support" : nextOffer.role,
    };
    return;
  }

  if (offers.length < 3) {
    offers.push(nextOffer);
    return;
  }

  const replacementIndex = offers.findIndex(offer => offer.role !== "support" || synergyEmitterIds.includes(nextOffer.emitterId));

  offers[replacementIndex >= 0 ? replacementIndex : offers.length - 1] = nextOffer;
}

function pickEmitter(
  rng: RngState,
  candidates: readonly EmitterId[],
  existingOffers: readonly Pick<DraftTowerOffer, "emitterId">[],
): { readonly emitterId: EmitterId, readonly rng: RngState } {
  const existing = new Set(existingOffers.map(offer => offer.emitterId));
  const available = candidates.filter(emitterId => !existing.has(emitterId));
  const pool = available.length > 0 ? available : gameConfig.emitters.map(emitter => emitter.id);
  const [nextRng, roll] = nextRandom(rng);

  return {
    rng: nextRng,
    emitterId: pool[Math.floor(roll * pool.length) % pool.length]!,
  };
}

function pickUpgrade(
  rng: RngState,
  candidates: readonly UpgradeId[],
  existingOffers: readonly UpgradeId[],
): { readonly upgradeId: UpgradeId, readonly rng: RngState } {
  const existing = new Set(existingOffers);
  const available = candidates.filter(upgradeId => !existing.has(upgradeId));
  const pool = available.length > 0 ? available : candidates;
  const [nextRng, roll] = nextRandom(rng);

  return {
    rng: nextRng,
    upgradeId: pool[Math.floor(roll * pool.length) % pool.length]!,
  };
}

function getRequiredTowerOffers(state: RunState): readonly EmitterId[] {
  const clearedWaveNumber = state.waveIndex + 1;
  const offers: EmitterId[] = [];

  if (clearedWaveNumber >= 2 && !hasEmitterTower(state, "heat")) {
    offers.push("heat");
  }

  if (clearedWaveNumber >= 4 && !hasEmitterTower(state, "oil")) {
    offers.push("oil");
  }

  return offers;
}

function getSynergyEmitterIds(state: RunState): readonly EmitterId[] {
  const placedEmitterIds = new Set(state.placedTowers.map(tower => tower.emitterId));
  const synergies = new Set<EmitterId>();

  if (placedEmitterIds.has("water")) {
    synergies.add("spark");
    synergies.add("heat");
  }

  if (placedEmitterIds.has("oil")) {
    synergies.add("heat");
  }

  if (placedEmitterIds.has("spark")) {
    synergies.add("water");
  }

  if (placedEmitterIds.has("heat")) {
    synergies.add("water");
    synergies.add("oil");
  }

  if (synergies.size === 0) {
    synergies.add("water");
    synergies.add("spark");
  }

  return [...synergies].sort();
}

function getPivotEmitterIds(state: RunState): readonly EmitterId[] {
  const owned = new Set([...state.bench, ...state.placedTowers].map(tower => tower.emitterId));
  const unowned = gameConfig.emitters.map(emitter => emitter.id).filter(emitterId => !owned.has(emitterId));

  return unowned.length > 0 ? unowned : gameConfig.emitters.map(emitter => emitter.id);
}

function hasEmitterTower(state: RunState, emitterId: EmitterId): boolean {
  return [...state.bench, ...state.placedTowers].some(tower => tower.emitterId === emitterId);
}

function getUpgradeStacks(state: RunState, upgradeId: UpgradeId): number {
  return state.upgrades.find(upgrade => upgrade.upgradeId === upgradeId)?.stacks ?? 0;
}
