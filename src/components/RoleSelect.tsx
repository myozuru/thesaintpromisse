import { useRef, useState } from 'react';
import { Shield, User, Lock, Plus, Trash2, X, ImagePlus, Camera, KeyRound } from 'lucide-react';
import { useRoleStore } from '@/stores/useRoleStore';
import { useProfileStore, type PlayerProfile } from '@/stores/useProfileStore';
import { JjkSwirl } from '@/components/JjkSwirl';

const MASTER_PASSWORD = '141204';
const UNIVERSAL_PASSWORD = '141204';
const CREATE_PROFILE_PASSWORD = '300293';

type Mode =
  | { kind: 'root' }
  | { kind: 'master' }
  | { kind: 'createGate' } // pede 300293 antes de abrir o form
  | { kind: 'createForm' }
  | { kind: 'login'; profile: PlayerProfile }
  | { kind: 'delete'; profile: PlayerProfile }
  | { kind: 'editGate'; profile: PlayerProfile }
  | { kind: 'editForm'; profile: PlayerProfile; canChangePassword: boolean };

export function RoleSelect() {
  const setRole = useRoleStore((s) => s.setRole);
  const profiles = useProfileStore((s) => s.profiles);
  const createProfile = useProfileStore((s) => s.createProfile);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const deleteProfile = useProfileStore((s) => s.deleteProfile);
  const setActiveProfile = useProfileStore((s) => s.setActiveProfile);
  const isProfileNameTaken = useProfileStore((s) => s.isProfileNameTaken);

  const [mode, setMode] = useState<Mode>({ kind: 'root' });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // form state
  const [newName, setNewName] = useState('');
  const [newAvatar, setNewAvatar] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const flashError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 2200);
  };

  const resetForm = () => {
    setNewName('');
    setNewAvatar(null);
    setNewPassword('');
  };

  const goRoot = () => {
    setMode({ kind: 'root' });
    setPassword('');
    setError('');
  };

  const handleMaster = () => {
    if (password === MASTER_PASSWORD) {
      setRole('MASTER');
    } else {
      flashError('Senha incorreta');
    }
  };

  const handleCreateGate = () => {
    if (password === CREATE_PROFILE_PASSWORD || password === UNIVERSAL_PASSWORD) {
      setPassword('');
      setError('');
      resetForm();
      setMode({ kind: 'createForm' });
    } else {
      flashError('Senha incorreta');
    }
  };

  const handleAvatarPick = (file: File, onLoad: (avatar: string | null) => void) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) {
      flashError('Imagem muito grande (máx 2MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onLoad(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const handleCreateSubmit = () => {
    const name = newName.trim();
    if (!name) {
      flashError('Informe um nome');
      return;
    }
    if (isProfileNameTaken(name)) {
      flashError('Este nome já está em uso por outro perfil');
      return;
    }
    const profile = createProfile({
      name,
      avatar: newAvatar,
      password: newPassword.trim() ? newPassword.trim() : null,
    });
    if (!profile) {
      flashError('Não foi possível criar: nome já em uso');
      return;
    }
    setActiveProfile(profile.id);
    setRole('PLAYER');
  };

  const handleLogin = (profile: PlayerProfile) => {
    if (!profile.password) {
      setActiveProfile(profile.id);
      setRole('PLAYER');
      return;
    }
    if (password === profile.password || password === UNIVERSAL_PASSWORD) {
      setActiveProfile(profile.id);
      setRole('PLAYER');
    } else {
      flashError('Senha incorreta');
    }
  };

  const handleDelete = (profile: PlayerProfile) => {
    const allowDefault = !profile.password && password === CREATE_PROFILE_PASSWORD;
    if (password === UNIVERSAL_PASSWORD || allowDefault) {
      deleteProfile(profile.id);
      goRoot();
    } else {
      flashError('Senha incorreta');
    }
  };

  const startEdit = (profile: PlayerProfile, canChangePassword: boolean) => {
    setEditAvatar(profile.avatar);
    setEditPassword(profile.password ?? '');
    setPassword('');
    setError('');
    setMode({ kind: 'editForm', profile, canChangePassword });
  };

  const handleEditGate = (profile: PlayerProfile) => {
    if (password === UNIVERSAL_PASSWORD) {
      startEdit(profile, true);
      return;
    }
    if (!profile.password && password === CREATE_PROFILE_PASSWORD) {
      startEdit(profile, true);
      return;
    }
    if (!profile.password || password === profile.password) {
      startEdit(profile, false);
    } else {
      flashError('Senha incorreta');
    }
  };

  const handleEditSubmit = (profile: PlayerProfile, canChangePassword: boolean) => {
    updateProfile(profile.id, {
      avatar: editAvatar,
      ...(canChangePassword ? { password: editPassword.trim() ? editPassword.trim() : null } : {}),
    });
    goRoot();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center overflow-hidden overflow-y-auto animate-fade-in">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <JjkSwirl size={800} className="opacity-[0.06]" />
      </div>

      <div className="relative z-10 w-full max-w-3xl px-6 py-10">
        <div className="text-center mb-10">
          <h1
            className="text-4xl md:text-5xl text-primary tracking-[0.2em] mb-3"
            style={{
              fontFamily: "'Cinzel Decorative', serif",
              textShadow: '0 0 20px hsla(270, 100%, 50%, 0.6), 0 0 60px hsla(270, 100%, 50%, 0.3)',
            }}
          >
            Escolha seu Papel
          </h1>
          <p
            className="text-muted-foreground text-lg"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}
          >
            Como deseja entrar na sessão?
          </p>
        </div>

        {mode.kind === 'root' && (
          <div className="space-y-8">
            {/* Perfis existentes */}
            {profiles.length > 0 && (
              <div>
                <h2
                  className="text-sm uppercase tracking-[0.25em] text-muted-foreground mb-3 text-center"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Perfis de Player
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {profiles.map((p) => (
                    <div
                      key={p.id}
                      className="group relative rounded-xl border-2 border-border bg-card p-3 hover:border-neon-green hover:shadow-lg hover:shadow-neon-green/20 transition-all duration-300"
                    >
                      <button
                        onClick={() => {
                          setPassword('');
                          setError('');
                          if (p.password) setMode({ kind: 'login', profile: p });
                          else handleLogin(p);
                        }}
                        className="w-full flex flex-col items-center gap-2"
                      >
                        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-neon-green/40 bg-secondary flex items-center justify-center">
                          {p.avatar ? (
                            <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="h-8 w-8 text-neon-green" />
                          )}
                        </div>
                        <div className="text-center">
                          <p
                            className="text-sm font-bold text-foreground truncate max-w-[8rem]"
                            style={{ fontFamily: "'Cinzel', serif" }}
                          >
                            {p.name}
                          </p>
                          {p.password && (
                            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                              <Lock className="h-2.5 w-2.5" /> protegido
                            </p>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setPassword('');
                          setError('');
                          setMode({ kind: 'editGate', profile: p });
                        }}
                        title="Editar foto/senha"
                        className="absolute top-1 left-1 h-6 w-6 rounded-full bg-card/80 border border-border text-muted-foreground hover:text-neon-green hover:border-neon-green opacity-80 transition-all flex items-center justify-center"
                      >
                        <Camera className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => {
                          setPassword('');
                          setError('');
                          if (!p.password) {
                            if (confirm(`Excluir o perfil "${p.name}"?`)) {
                              deleteProfile(p.id);
                            }
                            return;
                          }
                          setMode({ kind: 'delete', profile: p });
                        }}
                        title="Excluir perfil"
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-card/80 border border-border text-muted-foreground hover:text-hp hover:border-hp opacity-80 transition-all flex items-center justify-center"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mestre — destaque principal */}
            <button
              onClick={() => {
                setPassword('');
                setError('');
                setMode({ kind: 'master' });
              }}
              className="group relative w-full rounded-2xl border-2 border-primary/60 bg-gradient-to-br from-primary/15 via-card to-card p-8 hover:border-primary hover:shadow-xl hover:shadow-primary/40 transition-all duration-300 hover:scale-[1.02] overflow-hidden"
              style={{
                boxShadow: '0 0 40px hsla(270, 100%, 50%, 0.15), inset 0 0 30px hsla(270, 100%, 50%, 0.05)',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              <div className="relative flex items-center justify-center gap-5">
                <Shield
                  className="h-20 w-20 text-primary group-hover:scale-110 transition-transform shrink-0"
                  style={{ filter: 'drop-shadow(0 0 12px hsla(270, 100%, 50%, 0.6))' }}
                />
                <div className="text-left">
                  <h2
                    className="text-3xl font-bold text-primary mb-1 tracking-[0.15em]"
                    style={{
                      fontFamily: "'Cinzel Decorative', serif",
                      textShadow: '0 0 16px hsla(270, 100%, 50%, 0.5)',
                    }}
                  >
                    Mestre
                  </h2>
                  <p className="text-sm text-muted-foreground">Acesso completo. Requer senha.</p>
                </div>
              </div>
            </button>

            {/* Criar perfil — secundário */}
            <button
              onClick={() => {
                setPassword('');
                setError('');
                setMode({ kind: 'createGate' });
              }}
              className="group relative w-full rounded-2xl border-2 border-border bg-card p-5 hover:border-neon-green hover:shadow-lg hover:shadow-neon-green/20 transition-all duration-300 hover:scale-[1.01]"
            >
              <div className="flex items-center justify-center gap-3">
                <Plus className="h-8 w-8 text-neon-green group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <h2 className="text-base font-bold text-foreground" style={{ fontFamily: "'Cinzel', serif" }}>
                    Criar Perfil de Player
                  </h2>
                  <p className="text-xs text-muted-foreground">Player com nome e foto.</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {mode.kind === 'master' && (
          <PasswordPanel
            icon={<Shield className="h-12 w-12 mx-auto mb-4 text-primary" />}
            title="Acesso do Mestre"
            password={password}
            setPassword={setPassword}
            error={error}
            onCancel={goRoot}
            onConfirm={handleMaster}
            confirmLabel="Entrar"
          />
        )}

        {mode.kind === 'createGate' && (
          <PasswordPanel
            icon={<Plus className="h-12 w-12 mx-auto mb-4 text-neon-green" />}
            title="Criar Perfil de Player"
            subtitle="Informe a senha de criação"
            password={password}
            setPassword={setPassword}
            error={error}
            onCancel={goRoot}
            onConfirm={handleCreateGate}
            confirmLabel="Continuar"
            accent="neon-green"
          />
        )}

        {mode.kind === 'createForm' && (
          <div className="rounded-2xl border-2 border-neon-green/40 bg-card p-8 max-w-md mx-auto animate-scale-in">
            <h2 className="text-xl font-bold text-center text-foreground mb-5" style={{ fontFamily: "'Cinzel', serif" }}>
              Novo Perfil
            </h2>

            <div className="flex flex-col items-center mb-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-neon-green/50 bg-secondary flex items-center justify-center hover:border-neon-green transition-all group"
              >
                {newAvatar ? (
                  <img src={newAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus className="h-8 w-8 text-neon-green/70 group-hover:text-neon-green" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarPick(f, setNewAvatar);
                  e.target.value = '';
                }}
              />
              <p className="text-xs text-muted-foreground mt-2">Foto (opcional)</p>
            </div>

            <label className="block text-xs text-muted-foreground mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
              Nome
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={32}
              placeholder="Nome do jogador"
              className={`w-full h-10 rounded-lg border bg-background px-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 mb-1 ${
                newName.trim() && isProfileNameTaken(newName)
                  ? 'border-destructive focus:border-destructive focus:ring-destructive/30'
                  : 'border-input focus:border-neon-green focus:ring-neon-green/30'
              }`}
            />
            {newName.trim() && isProfileNameTaken(newName) ? (
              <p className="text-xs text-destructive mb-2">Este nome já está em uso por outro perfil.</p>
            ) : (
              <div className="mb-2" />
            )}

            <label className="block text-xs text-muted-foreground mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
              Senha do perfil (opcional)
            </label>
            <div className="relative mb-3">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                maxLength={32}
                placeholder="Deixe em branco para não pedir"
                className="w-full h-10 rounded-lg border border-input bg-background pl-9 pr-3 text-foreground placeholder:text-muted-foreground focus:border-neon-green focus:outline-none focus:ring-2 focus:ring-neon-green/30"
              />
            </div>

            {error && (
              <p className="text-sm text-hp text-center mb-3 animate-fade-in">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={goRoot}
                className="flex-1 h-10 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateSubmit}
                disabled={!newName.trim() || isProfileNameTaken(newName)}
                className="flex-1 h-10 rounded-lg bg-neon-green text-background text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Criar e Entrar
              </button>
            </div>
          </div>
        )}

        {mode.kind === 'login' && (
          <PasswordPanel
            icon={
              <div className="w-16 h-16 mx-auto mb-3 rounded-full overflow-hidden border-2 border-neon-green/50 bg-secondary flex items-center justify-center">
                {mode.profile.avatar ? (
                  <img src={mode.profile.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="h-8 w-8 text-neon-green" />
                )}
              </div>
            }
            title={mode.profile.name}
            subtitle="Senha do perfil"
            password={password}
            setPassword={setPassword}
            error={error}
            onCancel={goRoot}
            onConfirm={() => handleLogin(mode.profile)}
            confirmLabel="Entrar"
            accent="neon-green"
          />
        )}

        {mode.kind === 'delete' && (
          <PasswordPanel
            icon={<Trash2 className="h-12 w-12 mx-auto mb-4 text-hp" />}
            title={`Excluir "${mode.profile.name}"?`}
            subtitle={mode.profile.password ? 'Senha universal para confirmar' : 'Senha universal ou senha padrão (300293) para confirmar'}
            password={password}
            setPassword={setPassword}
            error={error}
            onCancel={goRoot}
            onConfirm={() => handleDelete(mode.profile)}
            confirmLabel="Excluir"
            accent="hp"
          />
        )}

        {mode.kind === 'editGate' && (
          <PasswordPanel
            icon={<Camera className="h-12 w-12 mx-auto mb-4 text-neon-green" />}
            title={`Editar "${mode.profile.name}"`}
            subtitle={mode.profile.password ? 'Senha do perfil para trocar foto; senha universal para trocar senha também' : 'Sem senha: use senha padrão (300293) ou universal para definir uma nova senha'}
            password={password}
            setPassword={setPassword}
            error={error}
            onCancel={goRoot}
            onConfirm={() => handleEditGate(mode.profile)}
            confirmLabel="Continuar"
            accent="neon-green"
          />
        )}

        {mode.kind === 'editForm' && (
          <div className="rounded-2xl border-2 border-neon-green/40 bg-card p-8 max-w-md mx-auto animate-scale-in relative">
            <button onClick={goRoot} className="absolute top-3 right-3 h-7 w-7 rounded-full text-muted-foreground hover:bg-secondary flex items-center justify-center">
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-xl font-bold text-center text-foreground mb-5" style={{ fontFamily: "'Cinzel', serif" }}>
              Editar Perfil
            </h2>

            <div className="flex flex-col items-center mb-4">
              <button onClick={() => editFileInputRef.current?.click()} className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-neon-green/50 bg-secondary flex items-center justify-center hover:border-neon-green transition-all group">
                {editAvatar ? <img src={editAvatar} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="h-8 w-8 text-neon-green/70 group-hover:text-neon-green" />}
              </button>
              <input
                ref={editFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarPick(f, setEditAvatar);
                  e.target.value = '';
                }}
              />
              <p className="text-xs text-muted-foreground mt-2">Foto de perfil</p>
            </div>

            {mode.canChangePassword && (
              <>
                <label className="block text-xs text-muted-foreground mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
                  Senha do perfil
                </label>
                <div className="relative mb-3">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    maxLength={32}
                    placeholder="Deixe em branco para remover"
                    className="w-full h-10 rounded-lg border border-input bg-background pl-9 pr-3 text-foreground placeholder:text-muted-foreground focus:border-neon-green focus:outline-none focus:ring-2 focus:ring-neon-green/30"
                  />
                </div>
              </>
            )}

            <div className="flex gap-2">
              <button onClick={goRoot} className="flex-1 h-10 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleEditSubmit(mode.profile, mode.canChangePassword)} className="flex-1 h-10 rounded-lg bg-neon-green text-background text-sm font-bold hover:opacity-90 transition-opacity">
                Salvar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface PasswordPanelProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  password: string;
  setPassword: (v: string) => void;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  accent?: 'primary' | 'neon-green' | 'hp';
}

function PasswordPanel({
  icon, title, subtitle, password, setPassword, error,
  onCancel, onConfirm, confirmLabel, accent = 'primary',
}: PasswordPanelProps) {
  const borderClass =
    accent === 'neon-green' ? 'border-neon-green/40'
    : accent === 'hp' ? 'border-hp/40'
    : 'border-primary/40';
  const ringClass =
    accent === 'neon-green' ? 'focus:border-neon-green focus:ring-neon-green/30'
    : accent === 'hp' ? 'focus:border-hp focus:ring-hp/30'
    : 'focus:border-primary focus:ring-primary/30';
  const btnClass =
    accent === 'neon-green' ? 'bg-neon-green text-background hover:opacity-90'
    : accent === 'hp' ? 'bg-hp text-background hover:opacity-90'
    : 'bg-primary text-primary-foreground hover:bg-primary/90';

  return (
    <div className={`rounded-2xl border-2 ${borderClass} bg-card p-8 max-w-md mx-auto animate-scale-in relative`}>
      <button
        onClick={onCancel}
        className="absolute top-3 right-3 h-7 w-7 rounded-full text-muted-foreground hover:bg-secondary flex items-center justify-center"
      >
        <X className="h-4 w-4" />
      </button>
      {icon}
      <h2 className="text-xl font-bold text-center text-foreground mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
        {title}
      </h2>
      {subtitle && (
        <p className="text-xs text-muted-foreground text-center mb-4">{subtitle}</p>
      )}
      <div className="relative mb-3 mt-2">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
          placeholder="Senha"
          autoFocus
          className={`w-full h-11 rounded-lg border border-input bg-background pl-10 pr-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${ringClass}`}
        />
      </div>
      {error && (
        <p className="text-sm text-hp text-center mb-3 animate-fade-in">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 h-10 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
        >
          Voltar
        </button>
        <button
          onClick={onConfirm}
          className={`flex-1 h-10 rounded-lg text-sm font-bold transition-all ${btnClass}`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
