import { useEffect, useState } from 'react';
import { Shield, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { authDb, type CloudProfile } from '@/lib/auth';
import { useCharacterStore } from '@/stores/useCharacterStore';

export function MasterAccountsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [profiles, setProfiles] = useState<CloudProfile[]>([]);
  const [masters, setMasters] = useState<Set<string>>(new Set());
  const [me, setMe] = useState<string | null>(null);
  const [error, setError] = useState('');
  const characters = useCharacterStore((s) => s.characters);
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);
  const fichas = characters.filter((c) => !c.isGrimorioCreature);

  const load = async () => {
    const [{ data: p }, { data: m }, { data: u }] = await Promise.all([
      authDb.from('profiles').select('id, nick, avatar').order('nick'),
      authDb.rpc('list_masters'),
      authDb.auth.getUser(),
    ]);
    setProfiles((p as CloudProfile[]) ?? []);
    setMasters(new Set(((m as string[] | null) ?? []).map((x) => (typeof x === 'string' ? x : (x as { list_masters: string }).list_masters))));
    setMe(u.user?.id ?? null);
  };

  useEffect(() => { if (open) void load(); }, [open]);

  const toggle = async (id: string, make: boolean) => {
    setError('');
    const { error: err } = await authDb.rpc('set_master', { _target: id, _make: make });
    if (err) setError(err.message);
    void load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Cinzel', serif" }}>Contas e Mestres</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-2">
          {profiles.map((p) => {
            const isM = masters.has(p.id);
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-secondary flex items-center justify-center">
                  {p.avatar ? <img src={p.avatar} alt="" className="w-full h-full object-cover" /> : <User className="h-4 w-4 text-muted-foreground" />}
                </div>
                <span className="flex-1 text-sm text-foreground">{p.nick}{p.id === me && ' (você)'}</span>
                <button
                  onClick={() => toggle(p.id, !isM)}
                  disabled={p.id === me}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs border transition-colors disabled:opacity-40 ${isM ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                >
                  <Shield className="h-3 w-3" /> {isM ? 'Mestre' : 'Tornar Mestre'}
                </button>
              </div>
            );
          })}
          {fichas.length > 0 && (
            <div className="pt-3 mt-2 border-t border-border space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dono de cada ficha</p>
              {fichas.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
                  <span className="flex-1 truncate text-sm text-foreground">{c.name || 'Sem nome'}</span>
                  <select
                    value={c.profileId ?? ''}
                    onChange={(ev) => updateCharacter(c.id, { profileId: ev.target.value || undefined })}
                    className="h-8 max-w-[45%] rounded-md border border-border bg-background px-2 text-xs text-foreground"
                  >
                    <option value="">Sem dono</option>
                    {profiles.map((p) => <option key={p.id} value={p.id}>{p.nick}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
          {profiles.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conta ainda.</p>}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
