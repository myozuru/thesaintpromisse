import { useReducer, useMemo, useCallback } from "react";
import { deriveStats, validateDraft } from "./fm-derive";

/**
 * ============================================================
 * useCreatureBuilder — v2 (polimento)
 * ============================================================
 * Novidades desta versão:
 *  - portraitUrl com action creator dedicado
 *  - skills migradas para id-based (mais robusto que index)
 *  - skills com suporte a override de modificador
 *  - DUPLICATE_ACTION adicionado
 * ============================================================
 */

// ---------- Gerador de ID simples (sem biblioteca externa) ----------
const genId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// ---------- Estado inicial de uma ficha em branco ----------
export const blankDraft = () => ({
  name: "",
  portraitUrl: "",
  core: {
    grau: "3",
    nd: 5,
    patamar: "comum",
    difficulty: "intermediario",
    origin: { type: "maldicao", subtype: "comum", hasAumentoEnergia: false },
    size: "medio",
  },
  attributes: {
    forca: 10,
    destreza: 10,
    constituicao: 10,
    inteligencia: 10,
    sabedoria: 10,
    presenca: 10,
  },
  aptidoes: { ea: 0, cl: 0, bar: 0, dom: 0, er: 0 },
  attackAttr: 'forca',
  cdAttr: 'inteligencia',
  overrides: { stats: {}, saves: {} },
  skills: [],
  defenses: {
    resistencias: [],
    imunidades: [],
    vulnerabilidades: [],
    condicoesImunes: [],
  },
  actions: { list: [] },
  features: [],
  treinamentos: [],
  aptidoesEspeciais: [],
  dotes: [],
  narratorNotes: "",
});

// ---------- Normaliza skills vindas de fichas antigas (sem id) ----------
const normalizeSkills = (skills = []) =>
  skills.map((s) => ({
    id: s.id || genId("skill"),
    name: s.name || "",
    attribute: s.attribute || "forca",
    mastered: Boolean(s.mastered),
    overrideMod: s.overrideMod ?? null,
  }));

// Bug #7/#14 fix: HYDRATE assumia que o payload já tinha shape completo.
// JSONs antigos / corrompidos / exports parciais quebravam derivações.
// `normalizeHydratePayload` faz deep-merge defensivo com defaults do blank
// e clamps numéricos antes de o estado entrar no reducer.
const clampInt = (v, min, max, fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
};

const normalizeHydratePayload = (payload = {}) => {
  const blank = blankDraft();
  const core = { ...blank.core, ...(payload.core ?? {}) };
  core.origin = { ...blank.core.origin, ...(payload.core?.origin ?? {}) };
  core.nd = clampInt(core.nd, 1, 30, blank.core.nd);

  const attributes = { ...blank.attributes };
  for (const k of Object.keys(blank.attributes)) {
    attributes[k] = clampInt(payload.attributes?.[k], 8, 99, blank.attributes[k]);
  }

  const aptidoes = { ...blank.aptidoes };
  for (const k of Object.keys(blank.aptidoes)) {
    aptidoes[k] = clampInt(payload.aptidoes?.[k], 0, 5, blank.aptidoes[k]);
  }

  const defenses = {
    resistencias:    Array.isArray(payload.defenses?.resistencias)    ? payload.defenses.resistencias    : [],
    imunidades:      Array.isArray(payload.defenses?.imunidades)      ? payload.defenses.imunidades      : [],
    vulnerabilidades:Array.isArray(payload.defenses?.vulnerabilidades)? payload.defenses.vulnerabilidades: [],
    condicoesImunes: Array.isArray(payload.defenses?.condicoesImunes) ? payload.defenses.condicoesImunes : [],
  };

  return {
    ...blank,
    ...payload,
    core,
    attributes,
    aptidoes,
    defenses,
    overrides: {
      stats: { ...(payload.overrides?.stats ?? {}) },
      saves: { ...(payload.overrides?.saves ?? {}) },
    },
    portraitUrl:        payload.portraitUrl || "",
    attackAttr:         payload.attackAttr || 'forca',
    cdAttr:             payload.cdAttr || 'inteligencia',
    skills:             normalizeSkills(payload.skills),
    treinamentos:       Array.isArray(payload.treinamentos)       ? payload.treinamentos       : [],
    aptidoesEspeciais:  Array.isArray(payload.aptidoesEspeciais)  ? payload.aptidoesEspeciais  : [],
    dotes:              Array.isArray(payload.dotes)              ? payload.dotes              : [],
    features:           Array.isArray(payload.features)           ? payload.features           : [],
    actions: {
      list: Array.isArray(payload.actions?.list) ? payload.actions.list : [],
    },
    narratorNotes:      typeof payload.narratorNotes === 'string' ? payload.narratorNotes : "",
  };
};

// ---------- Reducer: dicionário de handlers ----------
const actionHandlers = {
  HYDRATE: (_, payload) => normalizeHydratePayload(payload),

  SET_NAME:     (s, payload) => ({ ...s, name: payload }),
  SET_PORTRAIT: (s, payload) => ({ ...s, portraitUrl: payload }),
  SET_NOTES:    (s, payload) => ({ ...s, narratorNotes: payload }),

  PATCH_CORE:   (s, payload) => ({ ...s, core: { ...s.core, ...payload } }),
  PATCH_ORIGIN: (s, payload) => {
    // Bug #51 fix: ao trocar `type`, reseta `hasAumentoEnergia` (não faz sentido herdar
    // flag entre maldicao/feiticeiro/etc.)
    const merged = { ...s.core.origin, ...payload };
    if (payload?.type && payload.type !== s.core.origin?.type) {
      merged.hasAumentoEnergia = false;
    }
    return { ...s, core: { ...s.core, origin: merged } };
  },

  SET_ATTRIBUTE: (s, { attr, value }) => ({
    ...s,
    // Bug #17 fix: clamp por patamar (limite real vem de validateDraft via warning,
    // aqui mantemos 8..99 como hard floor/ceiling para evitar valores absurdos).
    attributes: { ...s.attributes, [attr]: Math.max(8, Math.min(99, value)) },
  }),

  SET_ATTACK_ATTR: (s, payload) => ({ ...s, attackAttr: payload }),
  SET_CD_ATTR:     (s, payload) => ({ ...s, cdAttr: payload }),

  SET_APTIDAO: (s, { key, value }) => ({
    ...s,
    // Bug #16 fix: livro F&M 2.5 sugere 0..5 (clamp final)
    aptidoes: { ...s.aptidoes, [key]: Math.max(0, Math.min(5, value)) },
  }),

  SET_STAT_OVERRIDE: (s, { key, value }) => ({
    ...s,
    overrides: {
      ...s.overrides,
      stats: cleanNull({ ...s.overrides.stats, [key]: value }),
    },
  }),
  SET_SAVE_OVERRIDE: (s, { key, value }) => ({
    ...s,
    overrides: {
      ...s.overrides,
      saves: cleanNull({ ...s.overrides.saves, [key]: value }),
    },
  }),
  CLEAR_ALL_OVERRIDES: (s) => ({ ...s, overrides: { stats: {}, saves: {} } }),

  // ---------- Perícias (id-based agora) ----------
  ADD_SKILL: (s, payload) => ({
    ...s,
    skills: [
      ...s.skills,
      {
        id: genId("skill"),
        name: "",
        attribute: "forca",
        mastered: false,
        overrideMod: null,
        ...payload,
      },
    ],
  }),
  UPDATE_SKILL: (s, { id, patch }) => ({
    ...s,
    skills: s.skills.map((sk) => (sk.id === id ? { ...sk, ...patch } : sk)),
  }),
  REMOVE_SKILL: (s, id) => ({
    ...s,
    skills: s.skills.filter((sk) => sk.id !== id),
  }),
  SET_SKILL_OVERRIDE: (s, { id, value }) => ({
    ...s,
    skills: s.skills.map((sk) =>
      sk.id === id ? { ...sk, overrideMod: value } : sk
    ),
  }),

  // ---------- Ações ----------
  ADD_ACTION: (s, payload) => ({
    ...s,
    actions: {
      ...s.actions,
      list: [...s.actions.list, { ...payload, id: payload.id || genId("act") }],
    },
  }),
  UPDATE_ACTION: (s, { id, patch }) => ({
    ...s,
    actions: {
      ...s.actions,
      list: s.actions.list.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    },
  }),
  REMOVE_ACTION: (s, id) => ({
    ...s,
    actions: { ...s.actions, list: s.actions.list.filter((a) => a.id !== id) },
  }),
  DUPLICATE_ACTION: (s, id) => {
    const idx = s.actions.list.findIndex((a) => a.id === id);
    if (idx === -1) return s;
    const original = s.actions.list[idx];
    const copy = {
      ...JSON.parse(JSON.stringify(original)),
      id: genId("act"),
      name: `${original.name} (cópia)`,
    };
    // Insere logo após o original para dar feedback visual
    const newList = [
      ...s.actions.list.slice(0, idx + 1),
      copy,
      ...s.actions.list.slice(idx + 1),
    ];
    return { ...s, actions: { ...s.actions, list: newList } };
  },

  // ---------- Aptidões Especiais ----------
  ADD_APTIDAO_ESPECIAL: (s, payload) => ({
    ...s,
    aptidoesEspeciais: [...(s.aptidoesEspeciais || []), { ...payload, id: genId("apt") }],
  }),
  REMOVE_APTIDAO_ESPECIAL: (s, id) => ({
    ...s,
    aptidoesEspeciais: (s.aptidoesEspeciais || []).filter((a) => a.id !== id),
  }),

  // ---------- Dotes ----------
  ADD_DOTE: (s, payload) => ({
    ...s,
    dotes: [...(s.dotes || []), { ...payload, id: genId("dote") }],
  }),
  REMOVE_DOTE: (s, id) => ({
    ...s,
    dotes: (s.dotes || []).filter((d) => d.id !== id),
  }),

  // ---------- Treinamentos ----------
  ADD_TREINAMENTO: (s, payload) => ({
    ...s,
    treinamentos: [...(s.treinamentos || []), { ...payload, id: genId("treino") }],
  }),
  REMOVE_TREINAMENTO: (s, id) => ({
    ...s,
    treinamentos: (s.treinamentos || []).filter((t) => t.id !== id),
  }),

  // ---------- Features ----------
  ADD_FEATURE: (s, payload) => ({ ...s, features: [...s.features, payload] }),
  UPDATE_FEATURE: (s, { id, patch }) => ({
    ...s,
    features: s.features.map((f) => (f.id === id ? { ...f, ...patch } : f)),
  }),
  REMOVE_FEATURE: (s, id) => ({
    ...s,
    features: s.features.filter((f) => f.id !== id),
  }),

  // ---------- Defesas ----------
  ADD_DEFENSE: (s, { category, item }) => ({
    ...s,
    defenses: { ...s.defenses, [category]: [...s.defenses[category], item] },
  }),
  REMOVE_DEFENSE: (s, { category, index }) => ({
    ...s,
    defenses: {
      ...s.defenses,
      [category]: s.defenses[category].filter((_, i) => i !== index),
    },
  }),
};

// ---------- Utils ----------
const cleanNull = (obj) => {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined && v !== "") result[k] = v;
  }
  return result;
};

function reducer(state, action) {
  const handler = actionHandlers[action.type];
  if (!handler) {
    console.warn(`Unknown action: ${action.type}`);
    return state;
  }
  return handler(state, action.payload);
}

// ---------- Hook principal ----------
export default function useCreatureBuilder(initialDraft = null) {
  const [draft, dispatch] = useReducer(
    reducer,
    initialDraft || blankDraft(),
    (init) => ({ ...init, skills: normalizeSkills(init.skills) })
  );

  // Bug #55 fix: depender do `draft` inteiro evita memo stale quando outros
  // ramos do draft (passivas, dotes, treinamentos…) mudam e afetam derived.
  // O reducer já produz nova referência por dispatch, então isso não causa
  // recomputo excessivo.
  const derived = useMemo(() => deriveStats(draft), [draft]);

  const warnings = useMemo(() => validateDraft(draft, derived), [draft, derived]);

  const actions = {
    hydrate:       useCallback((data) => dispatch({ type: "HYDRATE", payload: data }), []),
    setName:       useCallback((name) => dispatch({ type: "SET_NAME", payload: name }), []),
    setPortrait:   useCallback((url) => dispatch({ type: "SET_PORTRAIT", payload: url }), []),
    setNotes:      useCallback((n) => dispatch({ type: "SET_NOTES", payload: n }), []),
    patchCore:     useCallback((patch) => dispatch({ type: "PATCH_CORE", payload: patch }), []),
    patchOrigin:   useCallback((patch) => dispatch({ type: "PATCH_ORIGIN", payload: patch }), []),

    setAttribute:  useCallback((attr, value) =>
      dispatch({ type: "SET_ATTRIBUTE", payload: { attr, value } }), []),
    setAttackAttr: useCallback((v) => dispatch({ type: "SET_ATTACK_ATTR", payload: v }), []),
    setCdAttr:     useCallback((v) => dispatch({ type: "SET_CD_ATTR",     payload: v }), []),
    setAptidao:    useCallback((key, value) =>
      dispatch({ type: "SET_APTIDAO", payload: { key, value } }), []),

    setStatOverride: useCallback((key, value) =>
      dispatch({ type: "SET_STAT_OVERRIDE", payload: { key, value } }), []),
    setSaveOverride: useCallback((key, value) =>
      dispatch({ type: "SET_SAVE_OVERRIDE", payload: { key, value } }), []),
    clearOverrides:  useCallback(() => dispatch({ type: "CLEAR_ALL_OVERRIDES" }), []),

    // Skills — API id-based
    addSkill:    useCallback((skill = {}) => dispatch({ type: "ADD_SKILL", payload: skill }), []),
    updateSkill: useCallback((id, patch) =>
      dispatch({ type: "UPDATE_SKILL", payload: { id, patch } }), []),
    removeSkill: useCallback((id) => dispatch({ type: "REMOVE_SKILL", payload: id }), []),
    setSkillOverride: useCallback((id, value) =>
      dispatch({ type: "SET_SKILL_OVERRIDE", payload: { id, value } }), []),

    // Actions
    addAction:       useCallback((a) => dispatch({ type: "ADD_ACTION", payload: a }), []),
    updateAction:    useCallback((id, patch) =>
      dispatch({ type: "UPDATE_ACTION", payload: { id, patch } }), []),
    removeAction:    useCallback((id) => dispatch({ type: "REMOVE_ACTION", payload: id }), []),
    duplicateAction: useCallback((id) => dispatch({ type: "DUPLICATE_ACTION", payload: id }), []),

    // Aptidões Especiais
    addAptidaoEspecial:    useCallback((a) => dispatch({ type: "ADD_APTIDAO_ESPECIAL", payload: a }), []),
    removeAptidaoEspecial: useCallback((id) => dispatch({ type: "REMOVE_APTIDAO_ESPECIAL", payload: id }), []),

    // Dotes
    addDote:    useCallback((d) => dispatch({ type: "ADD_DOTE", payload: d }), []),
    removeDote: useCallback((id) => dispatch({ type: "REMOVE_DOTE", payload: id }), []),

    // Treinamentos
    addTreinamento:    useCallback((t) => dispatch({ type: "ADD_TREINAMENTO", payload: t }), []),
    removeTreinamento: useCallback((id) => dispatch({ type: "REMOVE_TREINAMENTO", payload: id }), []),

    // Features
    addFeature:    useCallback((f) => dispatch({ type: "ADD_FEATURE", payload: f }), []),
    updateFeature: useCallback((id, patch) =>
      dispatch({ type: "UPDATE_FEATURE", payload: { id, patch } }), []),
    removeFeature: useCallback((id) => dispatch({ type: "REMOVE_FEATURE", payload: id }), []),

    // Defenses
    addDefense:    useCallback((category, item) =>
      dispatch({ type: "ADD_DEFENSE", payload: { category, item } }), []),
    removeDefense: useCallback((category, index) =>
      dispatch({ type: "REMOVE_DEFENSE", payload: { category, index } }), []),
  };

  /**
   * Converte o draft + derivados em uma ficha pronta para salvar.
   * As skills são persistidas com o modificador final (calculado ou override).
   */
  const buildCreature = useCallback(() => {
    const skillsResolved = draft.skills.map((sk) => {
      const derivedSkill = derived.skillDerivations[sk.id];
      return {
        ...sk,
        mod: derivedSkill ? derivedSkill.finalMod : 0,
      };
    });

    return {
      ...draft,
      core: { ...draft.core, bonusTreinamento: derived.bt },
      attackAttr: draft.attackAttr,
      cdAttr: draft.cdAttr,
      stats: { ...derived.stats },
      saves: { ...derived.saves },
      skills: skillsResolved,
      actions: {
        total: derived.actionsTotal,
        list: draft.actions.list,
      },
      combatState: {
        isActive: false,
        hpCurrent: derived.stats.hpMax,
        peCurrent: derived.stats.peMax,
        guardaInabavalCurrent: derived.stats.guardaInabavalMax,
        resistenciaParcialUsed: 0,
        resistenciaTotalUsed: 0,
        integridadeCurrent: 100,
        activeConditions: [],
        temporaryHp: 0,
        isInDesafiandoMorte: false,
        missCounter: 0,
        customCounters: [],
        combatLog: [],
      },
    };
  }, [draft, derived]);

  return { draft, derived, warnings, actions, buildCreature };
}
