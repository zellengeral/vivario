# Vivaro

Aplicação web de gerenciamento, controle e finalização de tarefas pessoais e profissionais, com Kanban e priorização por matriz de Eisenhower.

## Publicar no Netlify (arrastar e soltar o zip)

1. Extraia o conteúdo deste .zip em uma pasta no seu computador.
2. Acesse https://app.netlify.com e faça login.
3. **Não** arraste a pasta extraída direto — o Netlify precisa primeiro rodar o build. Duas formas simples:

### Opção A — Netlify puxa de um repositório Git (recomendado)
1. Suba a pasta extraída para um repositório no GitHub/GitLab.
2. No Netlify: **Add new site → Import an existing project**, conecte o repositório.
3. O Netlify detecta automaticamente `npm run build` e a pasta `dist` (já configurado em `netlify.toml`).
4. Clique em Deploy.

### Opção B — Build local e arrastar a pasta `dist`
1. No terminal, dentro da pasta do projeto:
   ```
   npm install
   npm run build
   ```
2. Isso gera uma pasta `dist/`.
3. No Netlify, vá em **Add new site → Deploy manually** e arraste a pasta `dist` (não a raiz do projeto).

## Rodar localmente

```
npm install
npm run dev
```

## Funcionalidades

- Categorias Pessoal / Profissional, matriz de Eisenhower, 5 estados de tarefa
- 5 visões: Dashboard, Kanban, Lista, Calendário e Timeline
- Recorrência inteligente: todo dia, todo dia útil, semanalmente (dias específicos), a cada X dias, mensal (mesmo dia), último dia útil do mês, primeiro dia do mês, e "a cada X dias após concluir"
- Subtarefas com barra de progresso (`3/5 concluídas · 60%`)
- Anexos clicáveis: fotos, imagens, PDF/documentos, links, notas e localização
- Responsável, observadores e comentários por tarefa (colaboração local, pronta para evoluir para multiusuário)
- Criação de tarefa por voz (botão de microfone) com interpretação de data/hora em português
- Exportação para Google Agenda e backup local (.json)

## Observações

- Os dados (incluindo anexos) ficam salvos no `localStorage` do navegador — locais a cada dispositivo/navegador. Use a tela **Backup** para exportar/importar um `.json` e migrar entre dispositivos.
- O botão "Exportar para Google Agenda" abre uma nova aba com o evento pré-preenchido — a confirmação final é manual (sem integração OAuth automática).
- A criação por voz usa a Web Speech API do navegador (funciona melhor no Google Chrome, requer permissão de microfone e HTTPS). A transcrição é interpretada por um analisador de datas/horas em português (ex.: "amanhã às 10", "segunda-feira", "daqui a 3 dias") — sempre revise os campos antes de salvar.
- Responsável/observadores/comentários funcionam localmente (sem contas de usuário reais); a estrutura de dados já está pronta para, no futuro, virar colaboração multiusuário de verdade com um backend.
- Recorrência gera a próxima ocorrência automaticamente quando a tarefa atual é marcada como "Concluído".

## Notificações de lembrete

- Ao abrir o app, ele pede permissão para enviar notificações do navegador. É preciso clicar em "Ativar" no aviso que aparece no topo (ou permitir quando o navegador perguntar).
- **Instale o Vivaro no celular para receber os lembretes em formato de notificação de verdade:** o app agora é um PWA (Progressive Web App) instalável. Um banner aparece no topo oferecendo a instalação:
  - **Android/Chrome:** toque em "Instalar" no banner (ou no menu do navegador, em "Instalar app"/"Adicionar à tela inicial").
  - **iPhone/Safari:** toque no ícone de Compartilhar e depois em "Adicionar à Tela de Início".
  - Depois de instalado, o Vivaro ganha um ícone próprio na tela do celular e as notificações passam a se comportar como as de um app normal.
- **Importante:** como o Vivaro não tem servidor por trás (é um site estático), os lembretes só disparam **enquanto o app estiver aberto ou tiver sido usado recentemente em segundo plano**. Se o sistema encerrar o app por completo (ex.: depois de muito tempo sem uso, ou reinício do celular), a checagem para até você abrir o app de novo. Não é um push notification real de servidor — para isso, seria necessário adicionar um backend (ver observação abaixo).
- Mesmo sem a permissão do navegador concedida, os lembretes também aparecem como um aviso dentro do próprio app (canto inferior direito), enquanto o app estiver aberto.
- Se as notificações não aparecerem: (1) confira se a permissão foi concedida; (2) confira se as notificações do site/app não estão bloqueadas nas configurações do celular; (3) confira se a tarefa tem prazo (data/hora) definido — sem prazo, o lembrete não tem uma hora de referência para disparar.
