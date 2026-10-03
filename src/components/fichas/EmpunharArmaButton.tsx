import { useState } from 'react';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { armaDoPersonagem, armaEstaEmpunhada } from '@/lib/omni/armaDoPersonagem';
import { requiresTwoHands } from '@/lib/weapons';

export function EmpunharArmaButton({ charId, nome }: { charId: string; nome: string }) {
  const char = useCharacterStore(s => s.characters.find(c => c.id === charId));
  const [erro, setErro] = useState<string | null>(null);
  if (!char) return null;
  if (armaEstaEmpunhada(char, nome)) return <span className="text-xs text-emerald-300">Empunhada</span>;
  return <span className="inline-flex flex-col"><button type="button" className="rounded border border-primary/50 px-2 py-1 text-xs" onClick={e => {
    e.stopPropagation();
    const arma = armaDoPersonagem(charId, nome);
    const off = (arma && requiresTwoHands(arma)) || char.mainHandWeaponName === char.offHandWeaponName ? null : char.offHandWeaponName;
    const result = useCharacterStore.getState().equipWeapons(charId, { mainHandName: nome, offHandName: off });
    setErro(result.ok ? null : result.reason ?? 'Não foi possível empunhar.');
  }}>Empunhar</button>{erro && <span role="alert" className="text-xs text-destructive">{erro}</span>}</span>;
}
