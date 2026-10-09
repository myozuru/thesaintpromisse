import { useState } from 'react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { ATRIBUTOS_SHIKIGAMI, atributosIniciaisShikigami, grausDisponiveis, pontosRestantesShikigami, regrasGrau, validarAtributosShikigami, valoresShikigami, type GrauShikigami } from '@/lib/controlador/regrasShikigami';
import { limiteInvocacoesConhecidas } from '@/lib/controlador/tipos';

const rotulos = {forca:'Força',destreza:'Destreza',constituicao:'Constituição',inteligencia:'Inteligência',sabedoria:'Sabedoria',presenca:'Presença'};
const graus = {quarto:'Quarto Grau',terceiro:'Terceiro Grau',segundo:'Segundo Grau',primeiro:'Primeiro Grau',especial:'Grau Especial'};

export function CriadorShikigami({character}:{character:Character}){
  const update=useCharacterStore(s=>s.updateCharacter);
  const [nome,setNome]=useState('');
  const [grau,setGrau]=useState<GrauShikigami>('quarto');
  const [atributos,setAtributos]=useState(atributosIniciaisShikigami);
  const [erro,setErro]=useState('');
  const controlador=character.specialization==='Controlador';
  const disponiveis=controlador?grausDisponiveis(character.level):(['quarto','terceiro','segundo','primeiro','especial'] as GrauShikigami[]);
  const regras=regrasGrau(grau);
  const saldo=pontosRestantesShikigami(grau,atributos);
  const valores=valoresShikigami(grau,atributos,character.level,getTrainingBonusByLevel(character.level));
  const cadastrar=()=>{
    const mensagem=validarAtributosShikigami(grau,atributos);
    const catalogo=character.invocacoesConhecidas??[];
    if(!nome.trim()){setErro('Informe o nome do Shikigami.');return;}
    if(!disponiveis.includes(grau)){setErro('Grau indisponível para este nível.');return;}
    if(mensagem){setErro(mensagem);return;}
    // O livro exige Interlúdio para não Controladores e invocações extras;
    // o editor informa a regra, preservando as exceções livres autorizadas.
    update(character.id,{invocacoesConhecidas:[...catalogo,{
      id:crypto.randomUUID(),donoCharacterId:character.id,nome:nome.trim(),tipo:'shikigami',
      origem:{tipo:'manual'},grau,atributos:{...atributos},
      hpAtual:valores.pv,hpMaximo:valores.pv,defesa:valores.defesa,
      deslocamentoM:valores.deslocamentoM,porte:'Médio',
      custoInvocacaoPE:valores.custoPE,acoes:[],
    }]});
    setNome('');setAtributos(atributosIniciaisShikigami());setErro('');
  };
  return <div className="space-y-3 rounded-lg border border-border p-3">
    <h3 className="font-semibold">Criar Shikigami</h3>
    <p className="text-xs text-muted-foreground">Regras originais de Invocações · criação por grau e distribuição de atributos.</p>
    <p className="text-xs text-amber-600">{controlador ? `Controlador: ${limiteInvocacoesConhecidas(character.level)} invocações pela progressão do livro; adicionais exigem Interlúdio.` : "Outras especializações: obtenção por Interlúdio (talismãs/corpos). O livro não define limite numérico de invocações conhecidas para elas."}</p>
    <label className="block text-xs">Nome
      <input className="mt-1 w-full rounded border border-input bg-background p-2" value={nome} onChange={e=>setNome(e.target.value)} aria-label="Nome do Shikigami"/>
    </label>
    <label className="block text-xs">Grau
      <select className="mt-1 w-full rounded border border-input bg-background p-2" value={grau} onChange={e=>{setGrau(e.target.value as GrauShikigami);setErro('');}} aria-label="Grau do Shikigami">
        {disponiveis.map(g=><option key={g} value={g}>{graus[g]}</option>)}
      </select>
    </label>
    <p className="text-xs">Pontos restantes: <strong>{saldo}</strong> de {regras.pontos} · Máximo por atributo: {regras.maximo} · Mínimo: 6</p>
    <div className="grid grid-cols-2 gap-2">
      {ATRIBUTOS_SHIKIGAMI.map(k=><label key={k} className="text-xs">{rotulos[k]}
        <input aria-label={rotulos[k]} type="number" min={6} max={regras.maximo} step={1}
          className="mt-1 w-full rounded border border-input bg-background p-2" value={atributos[k]}
          onChange={e=>setAtributos(prev=>({...prev,[k]:Number(e.target.value)}))}/>
      </label>)}
    </div>
    <div className="grid grid-cols-2 gap-2 text-xs">
      <span>PV máximo: <strong>{valores.pv}</strong></span>
      <span>Defesa: <strong>{valores.defesa}</strong></span>
      <span>Deslocamento: <strong>{valores.deslocamentoM} m</strong></span>
      <span>Custo base: <strong>{valores.custoPE} PE</strong></span>
    </div>
    {erro&&<p role="alert" className="text-xs text-destructive">{erro}</p>}
    <button type="button" onClick={cadastrar} className="rounded bg-primary px-3 py-2 text-xs text-primary-foreground">Salvar Shikigami na biblioteca</button>
  </div>;
}
