import { describe, expect, it } from 'vitest';
import { atributosIniciaisShikigami, grausDisponiveis, pontosRestantesShikigami, regrasGrau, validarAtributosShikigami, valoresShikigami, invocacoesConhecidasPeloLivro } from '@/lib/controlador/regrasShikigami';

describe('Editor de Shikigamis — texto original',()=>{
 it('libera os graus nos marcos do livro',()=>{
  expect(grausDisponiveis(1)).toEqual(['quarto']);
  expect(grausDisponiveis(5)).toEqual(['quarto','terceiro']);
  expect(grausDisponiveis(9)).toEqual(['quarto','terceiro','segundo']);
  expect(grausDisponiveis(13)).toEqual(['quarto','terceiro','segundo','primeiro']);
  expect(grausDisponiveis(17)).toHaveLength(5);
 });
 it('valida orçamento e mínimo 6 com pontos recuperados',()=>{
  const a=atributosIniciaisShikigami();
  expect(pontosRestantesShikigami('quarto',a)).toBe(10);
  a.forca=16;a.inteligencia=6;
  expect(pontosRestantesShikigami('quarto',a)).toBe(4);
  a.destreza=12;
  expect(validarAtributosShikigami('quarto',a)).toBeNull();
  a.destreza=17;
  expect(validarAtributosShikigami('quarto',a)).not.toBeNull();
 });
 it('calcula PV com CON bruto e Defesa com mod DES e Treinamento',()=>{
  const a={...atributosIniciaisShikigami(),constituicao:12,destreza:14};
  expect(valoresShikigami('quarto',a,1,2)).toEqual({pv:17,defesa:14,deslocamentoM:9,custoPE:2});
  expect(valoresShikigami('segundo',a,9,4).pv).toBe(61);
  expect(regrasGrau('especial').pontos).toBe(40);
 });
 it('aplica regra de duas iniciais e uma a cada três níveis',()=>{
  expect([1,3,4,6,7,10,19].map(invocacoesConhecidasPeloLivro)).toEqual([2,2,3,3,4,5,8]);
 });
});
