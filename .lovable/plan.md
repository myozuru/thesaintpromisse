# Intensificar as rolagens dramáticas

## O que será ajustado
- Criar uma progressão clara por nível: Normal preserva o comportamento atual; Tenso, Épico e Lendário ficam sucessivamente mais lentos.
- Aumentar progressivamente o impulso vertical e a elasticidade dos dados, produzindo quiques visivelmente mais altos sem permitir que escapem da bandeja.
- Reforçar o áudio dramático em cada nível com impacto mais encorpado, abafamento de “copo” e ressonância crescente, mantendo cada som sincronizado com a colisão física real.
- Manter limites de duração, volume e quantidade de sons simultâneos para evitar rolagens intermináveis ou áudio estourado.

## Verificação
- Adicionar testes para a escala de velocidade e os multiplicadores de quique por nível.
- Executar os testes focados nos dados e verificar a compilação e os registros da prévia.

## Detalhes técnicos
- Centralizar os parâmetros de drama em uma configuração compartilhada pela bandeja e pelos dados.
- Aplicar o nível ao passo da física, impulso vertical, restituição e processamento de áudio, sem alterar o resultado final calculado pela orientação real do dado.
