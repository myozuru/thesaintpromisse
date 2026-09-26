import { useRef, useState } from 'react';
import { User, Lock, ImagePlus } from 'lucide-react';
import { JjkSwirl } from '@/components/JjkSwirl';
import { authDb, nickToEmail, normalizeNick, NICK_RE, applyUser } from '@/lib/auth';

type Tab = 'login' | 'signup';

export function AuthScreen() {
  const [tab, setTab] = useState<Tab>('login');
  const [nick, setNick] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
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
        if (password !== confirm) return setError('As senhas não conferem');
        const { data: taken } = await authDb.from('profiles').select('id').eq('nick', n).maybeSingle();
        if (taken) return setError('Este nick já está em uso');
        const { data, error: err } = await authDb.auth.signUp({
          email: nickToEmail(n),
          password,
          options: { data: { nick: n, avatar } },
        });
        if (err) return setError(err.message.includes('registered') ? 'Este nick já está em uso' : 'Não foi possível criar a conta');
        if (data.user && data.session) await applyUser(data.user);
      } else {
        const { data, error: err } = await authDb.auth.signInWithPassword({ email: nickToEmail(n), password });
        if (err || !data.user) return setError('Nick ou senha incorretos');
        await applyUser(data.user);
      }
    } finally {
      setBusy(false);
    }
  };

  const input =
    'w-full h-10 rounded-lg border border-input bg-background pl-9 pr-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center overflow-y-auto animate-fade-in">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <JjkSwirl size={800} className="opacity-[0.06]" />
      </div>
      <div className="relative z-10 w-full max-w-md px-6 py-10">
        <h1
          className="text-4xl text-center text-primary tracking-[0.2em] mb-8"
          style={{ fontFamily: "'Cinzel Decorative', serif", textShadow: '0 0 20px hsla(270, 100%, 50%, 0.6)' }}
        >
          {tab === 'login' ? 'Entrar' : 'Criar Conta'}
        </h1>

        <form onSubmit={submit} className="rounded-2xl border-2 border-primary/40 bg-card p-7 space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1 mb-2">
            {(['login', 'signup'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setError(''); }}
                className={`h-8 rounded-md text-sm transition-colors ${tab === t ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {t === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          {tab === 'signup' && (
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary/50 bg-secondary flex items-center justify-center hover:border-primary"
              >
                {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="h-7 w-7 text-primary/70" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickAvatar(f); e.target.value = ''; }} />
              <p className="text-[10px] text-muted-foreground mt-1">Foto (opcional)</p>
            </div>
          )}

          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Nick" maxLength={20} autoComplete="username" className={input} />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} className={input} />
          </div>
          {tab === 'signup' && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirmar senha" autoComplete="new-password" className={input} />
            </div>
          )}

          {error && <p className="text-sm text-hp text-center">{error}</p>}

          <button type="submit" disabled={busy} className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-bold hover:opacity-90 disabled:opacity-50">
            {busy ? 'Aguarde…' : tab === 'login' ? 'Entrar' : 'Criar e entrar'}
          </button>
        </form>

      </div>
    </div>
  );
}
