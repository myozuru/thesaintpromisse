# Reconstruir o TP Fichas

## Objetivo
Recriar no workspace atual o aplicativo completo contido no ZIP, mantendo sua aparência, módulos, dados locais, sons, dados de referência e experiência interativa.

## Implementação
- Migrar todos os componentes, estados, regras, testes e arquivos visuais/sonoros necessários do pacote.
- Adaptar a entrada do aplicativo para a estrutura atual do Lovable, mantendo a experiência como uma única tela interativa.
- Preservar a abertura “The Promisse”, escolha de Mestre/Jogador, fichas e todos os módulos disponíveis por perfil.
- Converter o tema místico existente para o sistema visual atual sem alterar sua identidade.
- Manter armazenamento local e o modo offline seguro, sem copiar credenciais, usuários ou dados do projeto original.
- Instalar apenas as bibliotecas já exigidas pelo código importado.

## Segurança e isolamento
- Não importar `.env`, credenciais, histórico Git, dados de usuários ou configuração do Cloud original.
- Usar o cliente offline já previsto no pacote quando não houver uma configuração própria deste workspace.
- Não executar automaticamente migrações SQL nem criar dados remotos.

## Verificação
- Confirmar que o projeto compila sem erros.
- Abrir a experiência no navegador, atravessar a tela inicial e validar a seleção de perfil em desktop.
- Conferir a apresentação em uma largura móvel e verificar erros visíveis do navegador.

## Limites desta reconstrução
- Esta etapa traz o aplicativo e seus dados estáticos, mas não replica fichas, mapas, usuários ou outros registros do projeto original.
- Multiplayer publicado dependerá de uma configuração própria posterior; nenhuma conexão antiga será reutilizada.
