import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useLogStore } from './useLogStore';

export type CurrencyId = string;

export interface Currency {
  id: CurrencyId;
  name: string;       // ex.: "Yen"
  symbol: string;     // ex.: "¥"
  isDefault?: boolean;
}

/** Saldo por moeda dentro de uma carteira. */
export type Balances = Record<CurrencyId, number>;

export interface Wallet {
  id: string;
  name: string;
  /** characterIds dos players que participam desta carteira. */
  members: string[];
  /** characterId do criador. */
  createdBy: string;
  balances: Balances;
  isPersonal?: boolean; // carteira pessoal (1 membro, criada automaticamente)
  createdAt: number;
}

export interface WalletInvite {
  id: string;
  walletId: string;
  walletName: string;
  fromCharacterId: string;
  toCharacterId: string;
  createdAt: number;
}

export type TxKind = 'grant' | 'spend' | 'transfer' | 'adjust';

export interface Transaction {
  id: string;
  kind: TxKind;
  currencyId: CurrencyId;
  amount: number;
  reason: string;
  /** Carteira de origem (null para 'grant' do Mestre). */
  fromWalletId: string | null;
  /** Carteira de destino (null para 'spend'). */
  toWalletId: string | null;
  /** Quem executou (characterId ou 'MASTER'). */
  actor: string;
  at: number;
}

interface MoneyState {
  currencies: Currency[];
  wallets: Wallet[];
  invites: WalletInvite[];
  transactions: Transaction[];

  // Currencies (Mestre)
  addCurrency: (name: string, symbol: string) => void;
  removeCurrency: (id: CurrencyId) => void;
  setDefaultCurrency: (id: CurrencyId) => void;

  // Wallets
  ensurePersonalWallet: (characterId: string, characterName: string) => string;
  createSharedWallet: (name: string, creatorCharacterId: string, inviteeCharacterIds: string[]) => string;
  renameWallet: (walletId: string, name: string) => void;
  leaveWallet: (walletId: string, characterId: string) => void;
  deleteWallet: (walletId: string) => void;
  /** Convida players adicionais para uma carteira compartilhada existente. */
  inviteToWallet: (walletId: string, inviteeCharacterIds: string[], fromCharacterId: string) => void;

  // Invites
  acceptInvite: (inviteId: string) => void;
  declineInvite: (inviteId: string) => void;

  // Money ops
  masterGrant: (toWalletId: string, currencyId: CurrencyId, amount: number, reason: string) => void;
  spend: (walletId: string, currencyId: CurrencyId, amount: number, reason: string, actor: string) => boolean;
  transfer: (
    fromWalletId: string,
    toWalletId: string,
    currencyId: CurrencyId,
    amount: number,
    reason: string,
    actor: string,
  ) => boolean;

  resetAll: () => void;
}

const DEFAULT_CURRENCY: Currency = {
  id: 'yen',
  name: 'Yen',
  symbol: '¥',
  isDefault: true,
};

const uid = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`);

function emptyBalances(currencies: Currency[]): Balances {
  const b: Balances = {};
  for (const c of currencies) b[c.id] = 0;
  return b;
}

export const useMoneyStore = create<MoneyState>()(
  persist(
    (set, get) => ({
      currencies: [DEFAULT_CURRENCY],
      wallets: [],
      invites: [],
      transactions: [],

      addCurrency: (name, symbol) => {
        const id = name.toLowerCase().replace(/\s+/g, '-') + '-' + uid().slice(0, 4);
        set((s) => ({
          currencies: [...s.currencies, { id, name, symbol }],
          wallets: s.wallets.map((w) => ({ ...w, balances: { ...w.balances, [id]: 0 } })),
        }));
      },

      removeCurrency: (id) => {
        set((s) => {
          if (s.currencies.length <= 1) return s;
          const target = s.currencies.find((c) => c.id === id);
          if (!target) return s;
          const remaining = s.currencies.filter((c) => c.id !== id);
          // se removeu a default, nomear próxima como default
          if (target.isDefault && remaining.length) remaining[0] = { ...remaining[0], isDefault: true };
          return {
            currencies: remaining,
            wallets: s.wallets.map((w) => {
              const { [id]: _drop, ...rest } = w.balances;
              return { ...w, balances: rest };
            }),
          };
        });
      },

      setDefaultCurrency: (id) =>
        set((s) => ({
          currencies: s.currencies.map((c) => ({ ...c, isDefault: c.id === id })),
        })),

      ensurePersonalWallet: (characterId, characterName) => {
        const existing = get().wallets.find(
          (w) => w.isPersonal && w.members.length === 1 && w.members[0] === characterId,
        );
        if (existing) return existing.id;
        const id = uid();
        const wallet: Wallet = {
          id,
          name: `Carteira de ${characterName}`,
          members: [characterId],
          createdBy: characterId,
          balances: emptyBalances(get().currencies),
          isPersonal: true,
          createdAt: Date.now(),
        };
        set((s) => ({ wallets: [...s.wallets, wallet] }));
        return id;
      },

      createSharedWallet: (name, creatorCharacterId, inviteeCharacterIds) => {
        const id = uid();
        const wallet: Wallet = {
          id,
          name: name.trim() || 'Panelinha',
          members: [creatorCharacterId],
          createdBy: creatorCharacterId,
          balances: emptyBalances(get().currencies),
          createdAt: Date.now(),
        };
        const invites: WalletInvite[] = inviteeCharacterIds
          .filter((cid) => cid !== creatorCharacterId)
          .map((cid) => ({
            id: uid(),
            walletId: id,
            walletName: wallet.name,
            fromCharacterId: creatorCharacterId,
            toCharacterId: cid,
            createdAt: Date.now(),
          }));
        set((s) => ({ wallets: [...s.wallets, wallet], invites: [...s.invites, ...invites] }));
        useLogStore.getState().addLog('system', `💰 Carteira "${wallet.name}" criada.`);
        return id;
      },

      renameWallet: (walletId, name) =>
        set((s) => ({
          wallets: s.wallets.map((w) => (w.id === walletId ? { ...w, name: name.trim() || w.name } : w)),
        })),

      leaveWallet: (walletId, characterId) => {
        set((s) => {
          const w = s.wallets.find((x) => x.id === walletId);
          if (!w || w.isPersonal) return s;
          const newMembers = w.members.filter((m) => m !== characterId);
          if (newMembers.length === 0) {
            return { wallets: s.wallets.filter((x) => x.id !== walletId) };
          }
          return {
            wallets: s.wallets.map((x) => (x.id === walletId ? { ...x, members: newMembers } : x)),
          };
        });
      },

      deleteWallet: (walletId) =>
        set((s) => ({
          wallets: s.wallets.filter((w) => w.id !== walletId),
          invites: s.invites.filter((i) => i.walletId !== walletId),
        })),

      inviteToWallet: (walletId, inviteeCharacterIds, fromCharacterId) => {
        const wallet = get().wallets.find((w) => w.id === walletId);
        if (!wallet || wallet.isPersonal) return;
        const existingMembers = new Set(wallet.members);
        const existingInvites = new Set(
          get().invites.filter((i) => i.walletId === walletId).map((i) => i.toCharacterId),
        );
        const toInvite = inviteeCharacterIds.filter(
          (cid) => cid && !existingMembers.has(cid) && !existingInvites.has(cid),
        );
        if (toInvite.length === 0) return;
        const newInvites: WalletInvite[] = toInvite.map((cid) => ({
          id: uid(),
          walletId,
          walletName: wallet.name,
          fromCharacterId,
          toCharacterId: cid,
          createdAt: Date.now(),
        }));
        set((s) => ({ invites: [...s.invites, ...newInvites] }));
        useLogStore
          .getState()
          .addLog(
            'system',
            `📨 ${toInvite.length} convite(s) enviado(s) para "${wallet.name}".`,
          );
      },

      acceptInvite: (inviteId) => {
        const invite = get().invites.find((i) => i.id === inviteId);
        if (!invite) return;
        set((s) => ({
          invites: s.invites.filter((i) => i.id !== inviteId),
          wallets: s.wallets.map((w) =>
            w.id === invite.walletId && !w.members.includes(invite.toCharacterId)
              ? { ...w, members: [...w.members, invite.toCharacterId] }
              : w,
          ),
        }));
      },

      declineInvite: (inviteId) =>
        set((s) => ({ invites: s.invites.filter((i) => i.id !== inviteId) })),

      masterGrant: (toWalletId, currencyId, amount, reason) => {
        if (amount <= 0) return;
        const cur = get().currencies.find((c) => c.id === currencyId);
        const wallet = get().wallets.find((w) => w.id === toWalletId);
        if (!cur || !wallet) return;
        set((s) => ({
          wallets: s.wallets.map((w) =>
            w.id === toWalletId
              ? { ...w, balances: { ...w.balances, [currencyId]: (w.balances[currencyId] || 0) + amount } }
              : w,
          ),
          transactions: [
            {
              id: uid(),
              kind: 'grant' as const,
              currencyId,
              amount,
              reason: reason || 'Recompensa do Mestre',
              fromWalletId: null,
              toWalletId,
              actor: 'MASTER',
              at: Date.now(),
            },
            ...s.transactions,
          ].slice(0, 500),
        }));
        useLogStore.getState().addLog(
          'system',
          `💰 Mestre concedeu ${cur.symbol}${amount} a "${wallet.name}" — ${reason || 'sem motivo'}`,
        );
      },

      spend: (walletId, currencyId, amount, reason, actor) => {
        if (amount <= 0) return false;
        const wallet = get().wallets.find((w) => w.id === walletId);
        const cur = get().currencies.find((c) => c.id === currencyId);
        if (!wallet || !cur) return false;
        if ((wallet.balances[currencyId] || 0) < amount) return false;
        set((s) => ({
          wallets: s.wallets.map((w) =>
            w.id === walletId
              ? { ...w, balances: { ...w.balances, [currencyId]: w.balances[currencyId] - amount } }
              : w,
          ),
          transactions: [
            {
              id: uid(),
              kind: 'spend' as const,
              currencyId,
              amount,
              reason: reason || 'Gasto',
              fromWalletId: walletId,
              toWalletId: null,
              actor,
              at: Date.now(),
            },
            ...s.transactions,
          ].slice(0, 500),
        }));
        useLogStore
          .getState()
          .addLog('system', `💸 ${wallet.name} gastou ${cur.symbol}${amount} — ${reason || 'sem motivo'}`);
        return true;
      },

      transfer: (fromWalletId, toWalletId, currencyId, amount, reason, actor) => {
        if (amount <= 0 || fromWalletId === toWalletId) return false;
        const from = get().wallets.find((w) => w.id === fromWalletId);
        const to = get().wallets.find((w) => w.id === toWalletId);
        const cur = get().currencies.find((c) => c.id === currencyId);
        if (!from || !to || !cur) return false;
        if ((from.balances[currencyId] || 0) < amount) return false;
        set((s) => ({
          wallets: s.wallets.map((w) => {
            if (w.id === fromWalletId)
              return { ...w, balances: { ...w.balances, [currencyId]: w.balances[currencyId] - amount } };
            if (w.id === toWalletId)
              return {
                ...w,
                balances: { ...w.balances, [currencyId]: (w.balances[currencyId] || 0) + amount },
              };
            return w;
          }),
          transactions: [
            {
              id: uid(),
              kind: 'transfer' as const,
              currencyId,
              amount,
              reason: reason || 'Transferência',
              fromWalletId,
              toWalletId,
              actor,
              at: Date.now(),
            },
            ...s.transactions,
          ].slice(0, 500),
        }));
        useLogStore
          .getState()
          .addLog(
            'system',
            `🔁 ${from.name} → ${to.name}: ${cur.symbol}${amount} (${reason || 'sem motivo'})`,
          );
        return true;
      },

      resetAll: () =>
        set({ currencies: [DEFAULT_CURRENCY], wallets: [], invites: [], transactions: [] }),
    }),
    { name: 'rpg-money' },
  ),
);
