import { useRef, useState } from 'react';
import { User, Lock, ImagePlus, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { JjkSwirl } from '@/components/JjkSwirl';
import { authDb, nickToEmail, normalizeNick, NICK_RE, applyUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Tab = 'login' | 'signup';

export function AuthScreen() {
  const [tab, setTab] = useState<Tab>('login');
  const [nick, setNick] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickAvatar = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 1024 * 1024) return setError('Imagem muito grande (máx 1MB)');
    const r = new FileReader();
    r.onload = () => setAvatar(typeof r.result === 'string' ? r.result : null);
    r.readAsDataURL(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const n = normalizeNick(nick);
    if (!NICK_RE.test(n)) return setError('Nick: 3 a 20 caracteres (letras, números, _ . -)');
    if (password.length < 6) return setError('A senha precisa de pelo menos 6 caracteres');
    setBusy(true);
    try {
      if (tab === 'signup') {
        if (password !== confirm) {
          setError('As senhas não conferem');
          return;
        }
        const { data: taken } = await authDb.from('profiles').select('id').eq('nick', n).maybeSingle();
        if (taken) {
          setError('Este nick já está em uso');
          return;
        }
        const { data, error: err } = await authDb.auth.signUp({
          email: nickToEmail(n),
          password,
          options: { data: { nick: n, avatar } },
        });
        if (err) {
          setError(err.message.includes('registered') ? 'Este nick já está em uso' : 'Não foi possível criar a conta');
          return;
        }
        if (data.user && data.session) await applyUser(data.user);
      } else {
        const { data, error: err } = await authDb.auth.signInWithPassword({ email: nickToEmail(n), password });
        if (err || !data.user) {
          setError('Nick ou senha incorretos');
          return;
        }
        await applyUser(data.user);
      }
    } catch {
      setError('Não foi possível conectar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const changeTab = (next: Tab) => {
    if (busy || next === tab) return;
    setTab(next);
    setError('');
    setConfirm('');
  };

  const input = 'h-12 rounded-lg border-border/70 bg-background/70 pl-10 pr-11 text-sm shadow-inner';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background px-4 py-8 animate-fade-in">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <JjkSwirl size={820} className="opacity-[0.08]" />
      </div>
      <div className="pointer-events-none absolute left-4 top-4 h-12 w-12 border-l border-t border-border/70" aria-hidden />
      <div className="pointer-events-none absolute bottom-4 right-4 h-12 w-12 border-b border-r border-border/70" aria-hidden />

      <section className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-7 shadow-[var(--shadow-occult)] backdrop-blur-2xl sm:p-9 animate-scale-in">
        <div className="pointer-events-none absolute inset-0 rounded-2xl border border-foreground/5" aria-hidden />
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground glow-text tracking-[0.18em]">THE PROMISSE</h1>
          <p className="mt-2 text-xs uppercase text-muted-foreground tracking-[0.14em]">Conecte-se ao destino</p>
        </header>

        <div className="grid grid-cols-2 gap-1 rounded-xl border border-border/50 bg-background/50 p-1" role="tablist" aria-label="Tipo de acesso">
            {(['login', 'signup'] as Tab[]).map((t) => (
              <Button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => changeTab(t)}
                variant="ghost"
                className={`h-9 rounded-lg text-xs uppercase transition-all duration-300 ${tab === t ? 'bg-secondary text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {t === 'login' ? 'Entrar' : 'Criar conta'}
              </Button>
            ))}
        </div>

        <form onSubmit={submit} className="mt-7 space-y-5" aria-busy={busy}>
          <div className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${tab === 'signup' ? 'grid-rows-[1fr] opacity-100 mb-1' : 'grid-rows-[0fr] opacity-0 -mb-5'}`}>
            <div className="overflow-hidden">
              <div className="flex flex-col items-center pb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Escolher foto de perfil"
                  onClick={() => fileRef.current?.click()}
                  className="h-20 w-20 overflow-hidden rounded-full border-dashed bg-background/60 hover:border-primary"
                >
                  {avatar ? <img src={avatar} alt="Foto escolhida" className="h-full w-full object-cover" /> : <ImagePlus className="text-primary/70" />}
                </Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickAvatar(f); e.target.value = ''; }} />
                <p className="mt-2 text-[10px] uppercase text-muted-foreground tracking-[0.12em]">Foto opcional</p>
              </div>
            </div>
          </div>

          <label className="block space-y-2">
            <span className="ml-1 text-[11px] uppercase text-muted-foreground tracking-[0.12em]">Nick</span>
            <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Ex: noctis" maxLength={20} autoComplete="username" spellCheck={false} disabled={busy} className={input} />
            </div>
          </label>
          <label className="block space-y-2">
            <span className="ml-1 text-[11px] uppercase text-muted-foreground tracking-[0.12em]">Senha</span>
            <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} disabled={busy} className={input} />
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </label>

          <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${tab === 'signup' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden">
              <label className="block space-y-2">
                <span className="ml-1 text-[11px] uppercase text-muted-foreground tracking-[0.12em]">Confirmar senha</span>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type={showPassword ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repita sua senha" autoComplete="new-password" disabled={busy} className={input} />
                </div>
              </label>
            </div>
          </div>

          <div className="min-h-5" aria-live="polite">
            {error && <p className="text-center text-sm text-destructive animate-fade-in">{error}</p>}
          </div>

          <Button type="submit" variant="mystic" disabled={busy} className="h-12 w-full rounded-lg text-xs uppercase tracking-[0.12em] active:scale-[0.98]">
            {busy && <LoaderCircle className="animate-spin" />}
            {busy ? 'Conectando…' : tab === 'login' ? 'Prosseguir jornada' : 'Criar e prosseguir'}
          </Button>
        </form>
      </section>
    </div>
  );
}
