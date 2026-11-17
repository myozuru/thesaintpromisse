import { useEffect, useMemo, useState } from 'react';
import { Coins, Plus, Send, Users, X, Check, Trash2, LogOut, Settings2, Wallet as WalletIcon, UserPlus } from 'lucide-react';
import { useMoneyStore, type Wallet } from '@/stores/useMoneyStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { moneyCharactersForViewer } from '@/lib/moneyIdentity';
import { cn } from '@/lib/utils';
import { playClickSound } from '@/lib/sounds';
import { ModuleHeader } from '@/components/ui/module-header';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatMoney(amount: number, symbol: string) {
  return `${symbol}${amount.toLocaleString('pt-BR')}`;
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

/* -------------------------------------------------------------------------- */
/*  Player Identity                                                           */
/* -------------------------------------------------------------------------- */

function usePlayerCharacters() {
  const characters = useCharacterStore((s) => s.characters);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  return useMemo(
    () => moneyCharactersForViewer(characters, 'PLAYER', activeProfileId),
    [characters, activeProfileId],
  );
}

/* -------------------------------------------------------------------------- */
/*  Module                                                                    */
/* -------------------------------------------------------------------------- */

export function MoneyModule() {
  const role = useRoleStore((s) => s.role);
  if (role === 'MASTER') return <MasterMoneyView />;
  return <PlayerMoneyView />;
}

/* ============================== MASTER VIEW =============================== */

function MasterMoneyView() {
  const { currencies, wallets, masterGrant, ensurePersonalWallet } = useMoneyStore();
  const characters = useCharacterStore((s) => s.characters);
  const profiles = useProfileStore((s) => s.profiles);
  const playerChars = useMemo(
    () => moneyCharactersForViewer(characters, 'MASTER', null),
    [characters],
  );
  const [personalCharacterId, setPersonalCharacterId] = useState('');
  const [grantWalletId, setGrantWalletId] = useState<string>('');
  const [grantCurrencyId, setGrantCurrencyId] = useState<string>(currencies[0]?.id ?? '');
  const [grantAmount, setGrantAmount] = useState<number>(0);
  const [grantReason, setGrantReason] = useState<string>('');
  const [showCurrencyPanel, setShowCurrencyPanel] = useState(false);

  const memberName = (id: string) => characters.find((c) => c.id === id)?.name ?? '???';
  const profileName = (profileId?: string) => profiles.find((p) => p.id === profileId)?.name ?? 'Sem player vinculado';

  const handleCreatePersonal = () => {
    const character = playerChars.find((candidate) => candidate.id === personalCharacterId);
    if (!character) return;
    ensurePersonalWallet(character.id, character.name);
    setPersonalCharacterId('');
    playClickSound();
  };

  const handleGrant = () => {
    if (!grantWalletId || !grantCurrencyId || grantAmount <= 0) return;
    masterGrant(grantWalletId, grantCurrencyId, grantAmount, grantReason);
    playClickSound();
    setGrantAmount(0);
    setGrantReason('');
  };

  const handleRemove = () => {
    if (!grantWalletId || !grantCurrencyId || grantAmount <= 0) return;
    const w = wallets.find((x) => x.id === grantWalletId);
    const available = w?.balances[grantCurrencyId] ?? 0;
    const amount = Math.min(grantAmount, available);
    if (amount <= 0) return;
    useMoneyStore
      .getState()
      .spend(grantWalletId, grantCurrencyId, amount, grantReason || 'Retirado pelo Mestre', 'MASTER');
    playClickSound();
    setGrantAmount(0);
    setGrantReason('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <ModuleHeader
        icon={Coins}
        title="Money"
        subtitle="Painel do Mestre"
        description="Carteiras dos players, moedas customizadas e histórico de transações."
        actions={
          <button
            onClick={() => setShowCurrencyPanel((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background/40 px-3 py-1.5 text-sm font-medium hover:bg-secondary/60 hover:border-primary/40 transition-all duration-300"
          >
            <Settings2 className="h-4 w-4" /> Moedas
          </button>
        }
      />

      {/* Desktop: two-pane layout — actions & wallets left, currency panel & history right (sticky) */}
      <div className="lg:grid lg:grid-cols-[1fr_420px] lg:gap-6 lg:items-start">
        {/* Main Content Pane */}
        <div className="space-y-6 animate-fade-in">
          {/* Criar carteira pessoal */}
          <section className="rounded-xl border border-border bg-card p-4 card-enigmatic glow-border space-y-3">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.06em' }}>
              <WalletIcon className="h-4 w-4" /> Criar carteira pessoal
            </h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={personalCharacterId}
                onChange={(event) => setPersonalCharacterId(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm h-10"
              >
                <option value="">Selecione a ficha e o player…</option>
                {playerChars.map((character) => {
                  const alreadyHasWallet = wallets.some(
                    (wallet) => wallet.isPersonal && wallet.members.length === 1 && wallet.members[0] === character.id,
                  );
                  return (
                    <option key={character.id} value={character.id} disabled={alreadyHasWallet}>
                      {character.name} — {profileName(character.profileId)}{alreadyHasWallet ? ' (já possui)' : ''}
                    </option>
                  );
                })}
              </select>
              <button
                onClick={handleCreatePersonal}
                disabled={!personalCharacterId}
                className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground flex items-center gap-2 glow-primary transition-all duration-300 hover:bg-primary/90 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" /> Criar e atribuir
              </button>
            </div>
            {playerChars.length === 0 && (
              <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>Vincule uma ficha de jogador a uma conta para criar sua carteira.</p>
            )}
          </section>

          {/* Conceder dinheiro */}
          <section className="rounded-xl border border-border bg-card p-4 card-enigmatic glow-border space-y-3">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.06em' }}>
              <Send className="h-4 w-4" /> Conceder / Retirar dinheiro
            </h2>
            <div className="grid gap-2 md:grid-cols-5">
              <select
                value={grantWalletId}
                onChange={(e) => setGrantWalletId(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm h-10 md:col-span-2"
              >
                <option value="">Selecione a carteira…</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.members.map(memberName).join(', ')})
                  </option>
                ))}
              </select>
              <select
                value={grantCurrencyId}
                onChange={(e) => setGrantCurrencyId(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm h-10"
              >
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.symbol} {c.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={grantAmount || ''}
                onChange={(e) => setGrantAmount(Math.max(0, Number(e.target.value) || 0))}
                placeholder="Quantia"
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm h-10"
              />
              <button
                onClick={handleGrant}
                disabled={!grantWalletId || grantAmount <= 0}
                className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground glow-primary transition-all duration-300 hover:bg-primary/90 disabled:opacity-40"
              >
                Conceder
              </button>
              <button
                onClick={handleRemove}
                disabled={!grantWalletId || grantAmount <= 0}
                className="h-10 rounded-lg bg-destructive px-4 text-sm font-medium text-destructive-foreground transition-all duration-300 hover:bg-destructive/90 disabled:opacity-40"
              >
                Retirar
              </button>
            </div>
            <input
              type="text"
              value={grantReason}
              onChange={(e) => setGrantReason(e.target.value)}
              placeholder="Motivo (ex.: 'Recompensa pela missão da floresta')"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm h-10"
            />
            {playerChars.length === 0 && (
              <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>
                Nenhuma ficha de player encontrada. Players precisam criar suas fichas para terem carteiras.
              </p>
            )}
          </section>

          {/* Lista de carteiras */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.06em' }}>
              <WalletIcon className="h-4 w-4" /> Carteiras <span className="text-muted-foreground font-normal text-base">({wallets.length})</span>
            </h2>
            {wallets.length === 0 ? (
              <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>Nenhuma carteira ainda.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {wallets.map((w) => (
                  <WalletCard key={w.id} wallet={w} viewerRole="MASTER" />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Pane — sticky on desktop: Currency Manager + Transaction History */}
        <div className="lg:sticky lg:top-24 space-y-4 animate-fade-in" style={{ animationDelay: '60ms' }}>
          {showCurrencyPanel && <CurrencyManager />}
          <TransactionHistory limit={50} />
        </div>
      </div>

      {/* Mobile: stacked layout */}
      <div className="lg:hidden animate-fade-in" style={{ animationDelay: '120ms' }}>
        {showCurrencyPanel && <CurrencyManager />}
        <TransactionHistory limit={50} />
      </div>
    </div>
  );
}

function CurrencyManager() {
  const { currencies, addCurrency, removeCurrency, setDefaultCurrency } = useMoneyStore();
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');

  return (
    <section className="rounded-xl border border-border bg-card p-4 card-enigmatic glow-border space-y-3 animate-fade-in">
      <h2 className="text-sm font-bold text-primary uppercase tracking-wider" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.06em' }}>Moedas customizadas</h2>
      <div className="space-y-2">
        {currencies.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2">
            <span className="font-mono text-lg w-8 text-center text-primary">{c.symbol}</span>
            <span className="flex-1 text-sm text-foreground">{c.name}</span>
            {c.isDefault ? (
              <span className="text-xs font-medium text-primary px-2 py-0.5 rounded bg-primary/10">Padrão</span>
            ) : (
              <button
                onClick={() => setDefaultCurrency(c.id)}
                className="text-xs text-muted-foreground hover:text-foreground hover:text-primary transition-colors px-2 py-0.5 rounded hover:bg-primary/10"
              >
                Tornar padrão
              </button>
            )}
            {currencies.length > 1 && (
              <button onClick={() => removeCurrency(c.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1" aria-label="Remover moeda">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.slice(0, 3))}
          placeholder="Símb."
          className="w-16 rounded-lg border border-input bg-background px-2 py-2 text-sm text-center h-10"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome (ex.: Créditos)"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm h-10"
        />
        <button
          onClick={() => {
            if (!name.trim() || !symbol.trim()) return;
            addCurrency(name.trim(), symbol.trim());
            setName('');
            setSymbol('');
            playClickSound();
          }}
          className="h-10 rounded-lg bg-primary px-4 text-sm text-primary-foreground flex items-center gap-2 glow-primary transition-all duration-300 hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>
    </section>
  );
}

/* ============================== PLAYER VIEW =============================== */

function PlayerMoneyView() {
  const playerChars = usePlayerCharacters();
  const [activeCharId, setActiveCharId] = useState<string>(() => playerChars[0]?.id ?? '');
  const ensurePersonal = useMoneyStore((s) => s.ensurePersonalWallet);
  const wallets = useMoneyStore((s) => s.wallets);
  const invites = useMoneyStore((s) => s.invites);
  const acceptInvite = useMoneyStore((s) => s.acceptInvite);
  const declineInvite = useMoneyStore((s) => s.declineInvite);
  const [showCreate, setShowCreate] = useState(false);

  const activeChar = playerChars.find((c) => c.id === activeCharId) ?? playerChars[0];

  // Garante uma carteira somente para a ficha ligada ao perfil conectado.
  useEffect(() => {
    if (activeChar) ensurePersonal(activeChar.id, activeChar.name);
  }, [activeChar, ensurePersonal]);

  useEffect(() => {
    if (!playerChars.some((character) => character.id === activeCharId) && playerChars[0]) {
      setActiveCharId(playerChars[0].id);
    }
  }, [activeCharId, playerChars]);

  if (playerChars.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center card-enigmatic glow-border animate-fade-in">
        <Coins className="mx-auto mb-3 h-10 w-10 opacity-50 text-primary" />
        <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>Sua conta ainda não está vinculada a uma ficha. Peça ao Mestre para fazer o vínculo em Contas.</p>
      </div>
    );
  }

  const myWallets = activeChar ? wallets.filter((w) => w.members.includes(activeChar.id)) : [];
  const myInvites = activeChar ? invites.filter((i) => i.toCharacterId === activeChar.id) : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-primary" style={{ fontFamily: "'Cinzel Decorative', serif" }}>
          <Coins className="h-7 w-7" /> Money
        </h1>
        <div className="flex items-center gap-2">
          <select
            value={activeCharId}
            onChange={(e) => setActiveCharId(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm h-10"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {playerChars.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={() => { setShowCreate(true); playClickSound(); }}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground flex items-center gap-2 glow-primary transition-all duration-300 hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Nova panelinha
          </button>
        </div>
      </header>

      {showCreate && activeChar && (
        <CreateWalletDialog
          creatorId={activeChar.id}
          allPlayerCharacters={playerChars}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Desktop: two-pane layout — wallets left, invites + history right (sticky) */}
      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 lg:items-start">
        {/* Wallets Pane */}
        <div className="animate-fade-in">
          {myInvites.length > 0 && (
            <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 card-enigmatic glow-border space-y-2 mb-6 animate-fade-in">
              <h2 className="text-sm font-bold text-primary uppercase tracking-wider" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.06em' }}>Convites pendentes</h2>
              {myInvites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg bg-background/60 px-3 py-2">
                  <span className="text-sm text-foreground">Você foi convidado para <strong className="text-primary">{inv.walletName}</strong></span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { acceptInvite(inv.id); playClickSound(); }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground glow-primary transition-all duration-300 hover:bg-primary/90"
                    >
                      <Check className="h-3.5 w-3.5" /> Aceitar
                    </button>
                    <button
                      onClick={() => { declineInvite(inv.id); playClickSound(); }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs transition-all duration-300 hover:bg-secondary hover:border-primary/30"
                    >
                      <X className="h-3.5 w-3.5" /> Recusar
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="grid gap-3 md:grid-cols-2">
            {myWallets.map((w) => (
              <WalletCard key={w.id} wallet={w} viewerRole="PLAYER" viewerCharacterId={activeChar?.id} />
            ))}
          </section>
        </div>

        {/* Right Pane — sticky: Transaction History */}
        <div className="lg:sticky lg:top-24 animate-fade-in" style={{ animationDelay: '60ms' }}>
          <TransactionHistory limit={20} filterCharacterId={activeChar?.id} />
        </div>
      </div>

      {/* Mobile: stacked */}
      <div className="lg:hidden animate-fade-in" style={{ animationDelay: '120ms' }}>
        <TransactionHistory limit={20} filterCharacterId={activeChar?.id} />
      </div>
    </div>
  );
}

/* ============================ Wallet Card ============================ */

interface WalletCardProps {
  wallet: Wallet;
  viewerRole: 'MASTER' | 'PLAYER';
  viewerCharacterId?: string;
}

function WalletCard({ wallet, viewerRole, viewerCharacterId }: WalletCardProps) {
  const { currencies, wallets, spend, transfer, leaveWallet, deleteWallet } = useMoneyStore();
  const characters = useCharacterStore((s) => s.characters);
  const [tab, setTab] = useState<'spend' | 'transfer' | null>(null);
  const [currencyId, setCurrencyId] = useState(currencies[0]?.id ?? '');
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');
  const [destWalletId, setDestWalletId] = useState('');
  const [showInvite, setShowInvite] = useState(false);

  const memberNames = wallet.members.map((id) => characters.find((c) => c.id === id)?.name ?? '???');
  const displayName = wallet.name?.trim() || 'Panelinha';
  const sameName = wallets.filter((w) => (w.name?.trim() || 'Panelinha') === displayName);
  const needsSuffix = sameName.length > 1;
  const suffix = needsSuffix ? ` #${wallet.id.slice(0, 4)}` : '';
  const otherWallets = wallets.filter(
    (w) => w.id !== wallet.id && (viewerRole === 'MASTER' || (viewerCharacterId && w.members.includes(viewerCharacterId))),
  );
  const canAct = viewerRole === 'PLAYER' && !!viewerCharacterId && wallet.members.includes(viewerCharacterId);
  const actor = viewerCharacterId ?? 'MASTER';

  const reset = () => {
    setTab(null);
    setAmount(0);
    setReason('');
    setDestWalletId('');
  };

  const onSpend = () => {
    if (spend(wallet.id, currencyId, amount, reason, actor)) reset();
  };
  const onTransfer = () => {
    if (transfer(wallet.id, destWalletId, currencyId, amount, reason, actor)) reset();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-enigmatic glow-border space-y-3 self-start animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            {wallet.isPersonal ? <WalletIcon className="h-4 w-4 text-primary" /> : <Users className="h-4 w-4 text-primary" />}
            <span className="text-base">{displayName}</span>
            {needsSuffix && (
              <span className="ml-1 font-mono text-xs text-muted-foreground">{suffix}</span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>{memberNames.join(' • ')}</p>
        </div>
        <div className="flex gap-1">
          {canAct && !wallet.isPersonal && (
            <button
              onClick={() => { setShowInvite(true); playClickSound(); }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-300"
              title="Convidar para a panelinha"
              aria-label="Convidar para a panelinha"
            >
              <UserPlus className="h-4 w-4" />
            </button>
          )}
          {viewerRole === 'MASTER' && !wallet.isPersonal && (
            <button
              onClick={() => { if (confirm(`Excluir "${displayName}"?`)) deleteWallet(wallet.id); }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-300"
              title="Excluir carteira"
              aria-label="Excluir carteira"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {canAct && !wallet.isPersonal && (
            <button
              onClick={() => leaveWallet(wallet.id, viewerCharacterId!)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-300"
              title="Sair da carteira"
              aria-label="Sair da carteira"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {showInvite && viewerCharacterId && (
        <InviteToWalletDialog
          wallet={wallet}
          fromCharacterId={viewerCharacterId}
          onClose={() => setShowInvite(false)}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        {currencies.map((c) => (
          <div
            key={c.id}
            className="flex items-baseline justify-between rounded-lg border border-border bg-background/50 px-3 py-2"
          >
            <span className="text-xs text-muted-foreground">{c.name}</span>
            <span className="font-mono text-base font-semibold text-foreground">{formatMoney(wallet.balances[c.id] || 0, c.symbol)}</span>
          </div>
        ))}
      </div>

      {canAct && (
        <div className="flex gap-2">
          <button
            onClick={() => setTab(tab === 'spend' ? null : 'spend')}
            className={cn(
              'flex-1 h-9 rounded-lg border border-border px-3 text-xs font-medium transition-all duration-300',
              tab === 'spend' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/30'
            )}
          >
            Gastar
          </button>
          <button
            onClick={() => setTab(tab === 'transfer' ? null : 'transfer')}
            disabled={otherWallets.length === 0}
            className={cn(
              'flex-1 h-9 rounded-lg border border-border px-3 text-xs font-medium transition-all duration-300 disabled:opacity-40',
              tab === 'transfer' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/30'
            )}
          >
            Transferir
          </button>
        </div>
      )}

      {tab && canAct && (
        <div className="space-y-2 rounded-lg border border-border bg-background/40 p-3 animate-fade-in">
          <div className="flex gap-2">
            <select
              value={currencyId}
              onChange={(e) => setCurrencyId(e.target.value)}
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs h-9"
            >
              {currencies.map((c) => (
                <option key={c.id} value={c.id}>{c.symbol}</option>
              ))}
            </select>
            <input
              type="number"
              value={amount || ''}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
              placeholder="Quantia"
              className="flex-1 rounded-lg border border-input bg-background px-2 py-1.5 text-xs h-9"
            />
          </div>
          {tab === 'transfer' && (
            <select
              value={destWalletId}
              onChange={(e) => setDestWalletId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs h-9"
            >
              <option value="">Carteira destino…</option>
              {otherWallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {(w.name?.trim() || 'Panelinha')} #{w.id.slice(0, 4)}
                </option>
              ))}
            </select>
          )}
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo"
            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs h-9"
          />
          <button
            onClick={tab === 'spend' ? onSpend : onTransfer}
            disabled={amount <= 0 || (tab === 'transfer' && !destWalletId)}
            className="w-full h-10 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground glow-primary transition-all duration-300 hover:bg-primary/90 disabled:opacity-40"
          >
            Confirmar
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================ Invite to Wallet ============================ */

function InviteToWalletDialog({
  wallet,
  fromCharacterId,
  onClose,
}: {
  wallet: Wallet;
  fromCharacterId: string;
  onClose: () => void;
}) {
  const characters = useCharacterStore((s) => s.characters);
  const invites = useMoneyStore((s) => s.invites);
  const inviteToWallet = useMoneyStore((s) => s.inviteToWallet);

  const memberSet = new Set(wallet.members);
  const pendingSet = new Set(
    invites.filter((i) => i.walletId === wallet.id).map((i) => i.toCharacterId),
  );

  const candidates = characters.filter(
    (c) => c.createdBy === 'PLAYER' && !memberSet.has(c.id) && !pendingSet.has(c.id),
  );
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const handleInvite = () => {
    if (selected.length === 0) return;
    inviteToWallet(wallet.id, selected, fromCharacterId);
    onClose();
    playClickSound();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 card-enigmatic glow-border space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-foreground" style={{ fontFamily: "'Cinzel', serif" }}>Convidar para "{wallet.name?.trim() || 'Panelinha'}"</h2>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground italic" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Nenhum player disponível para convidar (já são membros ou têm convite pendente).
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Selecione players:</p>
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {candidates.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 cursor-pointer hover:bg-primary/5 hover:border-primary/30 transition-all duration-300"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    onChange={() => toggle(c.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm text-foreground">{c.name}</span>
                </label>
              ))}
            </div>
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="h-9 rounded-lg border border-border px-4 text-sm text-muted-foreground hover:bg-secondary transition-all duration-300"
          >
            Cancelar
          </button>
          <button
            onClick={handleInvite}
            disabled={selected.length === 0}
            className="h-9 rounded-lg bg-primary px-4 text-sm text-primary-foreground glow-primary transition-all duration-300 hover:bg-primary/90 disabled:opacity-40"
          >
            Enviar {selected.length > 0 && `(${selected.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CreateWalletDialogProps {
  creatorId: string;
  allPlayerCharacters: { id: string; name: string }[];
  onClose: () => void;
}

function CreateWalletDialog({ creatorId, allPlayerCharacters, onClose }: CreateWalletDialogProps) {
  const create = useMoneyStore((s) => s.createSharedWallet);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const others = allPlayerCharacters.filter((c) => c.id !== creatorId);

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 card-enigmatic glow-border space-y-3">
        <h2 className="text-base font-bold text-foreground" style={{ fontFamily: "'Cinzel', serif" }}>Nova panelinha</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome (ex.: Cofrinho da Guilda)"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm h-10"
        />
        <div>
          <p className="mb-2 text-sm text-muted-foreground">Convidar players:</p>
          {others.length === 0 ? (
            <p className="text-sm text-muted-foreground italic" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Nenhum outro player disponível.</p>
          ) : (
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {others.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 cursor-pointer hover:bg-primary/5 hover:border-primary/30 transition-all duration-300"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    onChange={() => toggle(c.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm text-foreground">{c.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="h-9 rounded-lg border border-border px-4 text-sm text-muted-foreground hover:bg-secondary transition-all duration-300"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!name.trim()) return;
              create(name, creatorId, selected);
              onClose();
              playClickSound();
            }}
            disabled={!name.trim()}
            className="h-9 rounded-lg bg-primary px-4 text-sm text-primary-foreground glow-primary transition-all duration-300 hover:bg-primary/90 disabled:opacity-40"
          >
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================ History ============================ */

function TransactionHistory({ limit, filterCharacterId }: { limit: number; filterCharacterId?: string }) {
  const { transactions, currencies, wallets } = useMoneyStore();
  const filtered = useMemo(() => {
    let txs = transactions;
    if (filterCharacterId) {
      const myWalletIds = new Set(wallets.filter((w) => w.members.includes(filterCharacterId)).map((w) => w.id));
      txs = txs.filter(
        (t) => (t.fromWalletId && myWalletIds.has(t.fromWalletId)) || (t.toWalletId && myWalletIds.has(t.toWalletId)),
      );
    }
    return txs.slice(0, limit);
  }, [transactions, wallets, filterCharacterId, limit]);

  const curName = (id: string) => currencies.find((c) => c.id === id);
  const wName = (id: string | null) => {
    if (!id) return '—';
    const w = wallets.find((x) => x.id === id);
    if (!w) return '—';
    const base = w.name?.trim() || 'Panelinha';
    const dup = wallets.filter((x) => (x.name?.trim() || 'Panelinha') === base).length > 1;
    return dup ? `${base} #${w.id.slice(0, 4)}` : base;
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 card-enigmatic glow-border space-y-2 animate-fade-in">
      <h2 className="text-sm font-bold text-primary uppercase tracking-wider" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.06em' }}>Histórico</h2>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>Sem movimentações ainda.</p>
      ) : (
        <ul className="divide-y divide-border max-h-[500px] overflow-y-auto pr-1">
          {filtered.map((tx) => {
            const cur = curName(tx.currencyId);
            return (
              <li key={tx.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">
                    {tx.kind === 'grant' && `📥 ${wName(tx.toWalletId)} recebeu do Mestre`}
                    {tx.kind === 'spend' && `💸 ${wName(tx.fromWalletId)} gastou`}
                    {tx.kind === 'transfer' && `🔁 ${wName(tx.fromWalletId)} → ${wName(tx.toWalletId)}`}
                    {tx.kind === 'adjust' && `⚙️ ${wName(tx.toWalletId ?? tx.fromWalletId)} ajustado`}
                  </div>
                  <div className="text-xs text-muted-foreground truncate" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>{tx.reason}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-base font-semibold text-foreground">
                    {cur?.symbol}{tx.amount}
                  </div>
                  <div className="text-xs text-muted-foreground">{fmtDate(tx.at)}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}