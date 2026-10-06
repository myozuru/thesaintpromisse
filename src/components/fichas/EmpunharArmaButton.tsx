import { useState } from 'react';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { armaDoPersonagem, armaEstaEmpunhada } from '@/lib/omni/armaDoPersonagem';
import { requiresTwoHands } from '@/lib/weapons';

export function EmpunharArmaButton({ charId, nome, instanceId }: { charId: string; nome: string; instanceId?: string }) {
  const char = useCharacterStore(s => s.characters.find(c => c.id === charId));
  const [erro, setErro] = useState<string | null>(null);
  if (!char) return null;
  if (instanceId ? char.mainHandWeaponInstanceId === instanceId || char.offHandWeaponInstanceId === instanceId : armaEstaEmpunhada(char, nome)) return <span className="text-xs text-emerald-300">Empunhada</span>;
  return <span className="inline-flex flex-col"><button type="button" className="rounded border border-primary/50 px-2 py-1 text-xs" onClick={e => {
    e.stopPropagation();
    const arma = armaDoPersonagem(charId, nome, instanceId);
    const duasMaosJa = char.mainHandWeaponInstanceId && char.offHandWeaponInstanceId
      ? char.mainHandWeaponInstanceId === char.offHandWeaponInstanceId
      : char.mainHandWeaponName === char.offHandWeaponName;
    const off = (arma && requiresTwoHands(arma)) || duasMaosJa ? null : char.offHandWeaponName;
    const result = useCharacterStore.getState().equipWeapons(charId, {
      mainHandName: nome, offHandName: off, mainHandInstanceId: instanceId ?? null,
      offHandInstanceId: (arma && requiresTwoHands(arma)) || duasMaosJa ? null : char.offHandWeaponInstanceId ?? null,
    });
    setErro(result.ok ? null : result.reason ?? 'Não foi possível empunhar.');
  }}>Empunhar</button>{erro && <span role="alert" className="text-xs text-destructive">{erro}</span>}</span>;
}
