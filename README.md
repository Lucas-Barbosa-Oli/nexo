# Nexo

Aplicativo pessoal de notas conectadas, planilhas e fórmulas, em português.

Produção: https://nexo-second-brain.vercel.app/

## Executar

Use Node.js 22 ou superior. Crie um projeto Supabase próprio e aplique `database/schema.sql` no SQL Editor do projeto vazio. Copie `.env.example` para `.env.local` e preencha a URL e a chave publicável do seu projeto. Rode `npm ci` e `npm run dev`. Para validar, use `npm test` e `npm run build`.

## Recursos

- Notas Markdown, pastas, tags, favoritos, busca, nota diária, lixeira com restauração.
- Links `[[Título]]`, backlinks e grafo interativo com D3 Force. Arraste os nós para fixá-los, mova o fundo para navegar e use a roda do mouse ou dois dedos para dar zoom. As posições fixadas ficam no dispositivo.
- KaTeX para matemática inline e em bloco; calculadora segura sem eval.
- Planilhas A1, intervalos, operações e SOMA/MÉDIA/MÍNIMO/MÁXIMO (também em inglês), exportação CSV.
- Importação Markdown/texto, exportação de nota e backup JSON.
- Cadastro/login por e-mail, cache por usuário, fila persistente, sincronização por foco/retorno de conexão e a cada 12 segundos, conflitos explícitos.
- PWA com manifesto, ícones e cache do aplicativo. É preciso abrir online ao menos uma vez.
- Modo demo apenas local, claramente identificado.

## Autenticação e privacidade

Em Authentication → URL Configuration no Supabase, use o endereço do seu aplicativo como Site URL e inclua o endereço exato nas Redirect URLs. Para desenvolvimento, adicione a URL local mostrada pelo Vite. Para cadastro por e-mail fora da equipe do projeto, configure um provedor SMTP e mantenha a confirmação de e-mail ligada.

O banco aplica políticas de segurança por linha (RLS) em notas, planilhas e pastas. A conta autenticada só pode ler e alterar as linhas de sua propriedade. As requisições de cada espaço usam a sessão da própria conta, inclusive durante uma troca de login. O cache offline também é separado por conta e fica no navegador.

O repositório contém o código e um modelo de configuração. Mantenha os arquivos de ambiente, backups pessoais, chaves administrativas e credenciais SMTP fora do Git. O frontend precisa apenas da chave publicável. Para conferir as permissões de um projeto, execute `database/isolation-test.sql` no SQL Editor. O teste simula duas contas e desfaz as alterações ao terminar.

## Limitações desta primeira versão

Não replica todo o Obsidian: não inclui seus plugins, canvas livre, histórico de versões, colaboração simultânea ou upload de anexos. Grafo exibe até 150 notas filtradas. Planilhas até 500 linhas e 52 colunas. Cache local usa localStorage, sujeito à cota do navegador; exporte backups. Importação JSON cria novas cópias, não restaura IDs nem substitui notas existentes. O estado de lixeira no backup é exportado, mas as cópias importadas ficam ativas.

A navegação é responsiva, mas instalação/offline em aparelho físico e sincronização autenticada entre aparelhos ainda exigem validação. Testes automatizados cobrem fórmulas, referências, fila offline e conflitos. Banco separado com RLS por proprietário; teste transacional em `database/isolation-test.sql`.

## Hospedagem

Vercel, projeto `nexo-second-brain`. Build: `npm run build`; saída `dist`. Banco e autenticação: Supabase. O app não usa Lovable em execução nem API de IA paga.
