# Manual Usuário — Companheiro Emoto

> **Este manual foi feito para quem quer usar o Companheiro Emoto sem precisar conhecer programação.** Leia a seção que corresponde à tarefa que você deseja executar; não é necessário decorar todas as funções antes de começar.

O **Companheiro Emoto** é uma ferramenta desktop para organizar atividades no *Star Citizen*. Ele reúne coleção de armaduras, inventário, blueprints, materiais, mineração, missões, Wikelo, marketplace UEX, Hangar de Naves, notas e cópias de segurança em um só lugar.[1]

> **Atualização 2.0.0 — agosto de 2026:** o aplicativo recebeu melhorias de desempenho para bases grandes, sincronização UEX em lote, alertas de compra mais estáveis, cálculo de scrip para Wikelo Favor, limpeza seletiva, correções no teclado da calculadora e uma interface com contraste e textos auxiliares mais legíveis. As instruções abaixo refletem o comportamento atual do programa.

## Novidades importantes da versão atual

| Recurso | Como funciona para o usuário |
|---|---|
| **Adicionar todos — UEX** | Depois de sincronizar seus anúncios, você pode importar todos os registros que ainda não existem em uma única ação, sem clicar item por item. Registros duplicados são ignorados. |
| **Wikelo Favor e scrip** | Para cada Wikelo Favor faltante, o programa calcula 50 scrip. O saldo é descontado somando MG Scrip, Council Scrip e ConCuI Scrip cadastrados no Inventário de Itens. |
| **Limpeza Seletiva** | Em Diretório de Dados, escolha o módulo que deseja limpar. O programa cria um snapshot antes da exclusão; confirme cuidadosamente porque a limpeza do módulo é destrutiva. |
| **Legibilidade** | Textos secundários, metadados, placeholders, labels e tabelas usam contraste maior. O foco pelo teclado também fica visível. |
| **Calculadora aberta durante o chat** | A calculadora aceita teclado quando está em foco, mas não captura números nem Backspace enquanto você escreve em português ou inglês no chat UEX. |
| **Minha Coleção e Acompanhamento UEX** | Quantidades e anúncios usam atualizações seletivas e índices reutilizáveis para reduzir congelamentos em bases grandes. |

## Sumário

1. [Primeiros passos](#1-primeiros-passos)
2. [Como navegar no aplicativo](#2-como-navegar-no-aplicativo)
3. [Dashboard](#3-dashboard)
4. [Armaduras](#4-armaduras)
5. [Inventário, blueprints e materiais](#5-inventário-blueprints-e-materiais)
6. [Mineração e baú de minério](#6-mineração-e-baú-de-minério)
7. [Cofre do Clã e Missões](#7-cofre-do-clã-e-missões)
8. [UEX: configuração, vendas e negociações](#8-uex-configuração-vendas-e-negociações)
9. [Inteligência UEX e Alertas de Compra](#9-inteligência-uex-e-alertas-de-compra)
10. [Acompanhamento Wikelo](#10-acompanhamento-wikelo)
11. [Hangar de Naves](#11-hangar-de-naves)
12. [Sistema: notas, locais, backups e pasta de dados](#12-sistema-notas-locais-backups-e-pasta-de-dados)
13. [Ferramentas disponíveis em qualquer tela](#13-ferramentas-disponíveis-em-qualquer-tela)
14. [Dicas importantes, unidades e cuidados](#14-dicas-importantes-unidades-e-cuidados)
15. [Solução de problemas comuns](#15-solução-de-problemas-comuns)

---

## 1. Primeiros passos

Ao abrir o programa pela primeira vez, você verá a **Dashboard**. Ela é o resumo da sua conta dentro do aplicativo e funciona como o ponto inicial para as tarefas mais comuns.

Antes de preencher muitos dados, defina onde suas informações serão guardadas em **Sistema → Diretório de Dados**. O programa cria uma pasta chamada `CompanheiroEmoto` no local escolhido. Essa pasta concentra o banco de dados, backups e informações locais do aplicativo.

> **Recomendação:** escolha uma pasta fácil de encontrar, como `C:\CompanheiroEmoto` ou uma unidade de dados que você use para seus jogos. Evite apagar essa pasta manualmente.

### Roteiro recomendado para começar

| Ordem | O que fazer | Onde fazer |
|---|---|---|
| 1 | Conferir a pasta de dados | **Sistema → Diretório de Dados** |
| 2 | Criar um backup inicial | **Sistema → Backup & Restauração** |
| 3 | Configurar UEX, se utilizar Marketplace | **UEX → UEX API (Live)** |
| 4 | Sincronizar itens, locais, minérios e veículos | **UEX → UEX API (Live)** |
| 5 | Cadastrar ou revisar locais do jogo | **Sistema → Adicionar Local** |
| 6 | Começar pelo inventário, missões ou hangar | Menu lateral correspondente |

O aplicativo salva a maioria das alterações automaticamente. Sempre que uma ação possuir confirmação de exclusão, leia a mensagem antes de confirmar.

---

## 2. Como navegar no aplicativo

A barra lateral esquerda organiza as telas em grupos. Clique no nome de um grupo para abrir ou recolher suas páginas. Para ocupar mais espaço na tela, use o botão no canto superior esquerdo da barra lateral: ele recolhe o menu e deixa somente os ícones visíveis. Clique novamente para expandir.

| Grupo do menu | Para que serve |
|---|---|
| **Início** | Dashboard com visão geral da conta. |
| **Armaduras** | Catálogo, coleção pessoal e cadastro de armaduras próprias. |
| **Itens & Crafting** | Inventário, blueprints e materiais necessários para crafting. |
| **Mineração** | Builds de mineração, grupo de mineração e baú de minério. |
| **Clã & Missões** | Cofre compartilhado, rastreador de missões e monitor automático. |
| **UEX** | Integração com UEX, mercado, negociações, alertas, Wikelo e Hangar. |
| **Sistema** | Notas, locais, gerenciador de missões, backups e pasta de dados. |

Em telas com muitos registros, use primeiro a **busca**, depois os **filtros** e por último a **ordenação**. Isso evita percorrer listas grandes manualmente.

---

## 3. Dashboard

A Dashboard apresenta um resumo rápido dos dados já registrados. Ela ajuda a localizar uma necessidade sem abrir cada módulo individualmente.

Os cartões podem mostrar, conforme os dados existentes, resumo de armaduras, itens, fila de crafting, materiais pendentes, missões, receita UEX, mineração, naves do hangar, progresso Wikelo, cartões DCHS e chaves PAF.

### Atalhos e interpretações importantes

| Indicador | O que significa |
|---|---|
| **Fila de Craft** | Quantidade de blueprints que você marcou como desejadas para crafting. Clique para abrir o Tracking de Materiais. |
| **Materiais pendentes** | O que ainda falta coletar para atender à fila de blueprints. |
| **Naves no Hangar** | Total de naves e veículos registrados em **Meu Hangar**. |
| **Receita UEX** | Soma das vendas concretizadas registradas no Acompanhamento UEX. |
| **PAF — Satélites** | Cada `Laser Activation Keycard` no inventário conta como um PAF completo. |
| **Hangares Executivos DCHS** | Cada conjunto com um cartão de cada tipo DCHS-01 a DCHS-07 permite montar um hangar executivo. |
| **Wikelo Favors** | Considera Favors diretos e a conversão dos scripts disponíveis no inventário. |

A Dashboard é apenas uma visão de resumo. Para corrigir um valor, abra a página de origem indicada pelo cartão.

---

## 4. Armaduras

### 4.1 Todas as Armaduras

A tela **Armaduras → Todas as Armaduras** é o catálogo geral. Use a busca e os filtros para encontrar um set por nome, tipo, fabricante ou característica.

Ao abrir uma armadura, você pode marcar cada peça como **possuída**, colocar na **lista de desejos** e salvar observações. Essas marcações atualizam sua coleção pessoal.

### 4.2 Minha Coleção

Em **Armaduras → Minha Coleção**, o foco é somente o que você já possui ou deseja conseguir. Use esta tela para conferir quais peças faltam para completar um set e acompanhar quantidades quando houver itens repetidos.

### 4.3 Cadastrar Armadura

Use **Armaduras → Cadastrar Armadura** quando encontrar um set que ainda não existe no catálogo ou quando quiser criar uma coleção personalizada.

Preencha o nome do conjunto, variante, fabricante e tipo. Depois adicione as peças. Você poderá editar o conjunto ou cada peça mais tarde. Não é necessário preencher campos que você não conhece; coloque as informações disponíveis e complemente depois.

---

## 5. Inventário, blueprints e materiais

### 5.1 Inventário de Itens

O inventário também é a fonte usada pelo Acompanhamento Wikelo para consultar **MG Scrip**, **Council Scrip** e **ConCuI Scrip**. Cadastre cada tipo com o nome correspondente e informe a quantidade real; registros em locais diferentes são somados. Itens reservados para outra pessoa não devem ser confundidos com saldo livre quando você estiver planejando uma entrega.



A tela **Itens & Crafting → Inventário de Itens** serve para registrar qualquer item que você possui: armas, roupas, cartões, recursos, peças, itens de missão e outros.

Para adicionar um item, clique no botão de cadastro e informe o nome, quantidade e localização. Quando o catálogo UEX tiver sido sincronizado, o campo de item pode oferecer sugestões automáticas. Selecionar uma sugestão ajuda a preencher o nome de forma consistente e permite usar recursos ligados à UEX.

#### Ações rápidas no card do item

| Ação | Resultado |
|---|---|
| **+** | Aumenta rapidamente a quantidade do item. |
| **−** | Diminui rapidamente a quantidade. |
| **Abrir/Editar** | Mostra todos os campos do item para correção detalhada. |
| **Transferir para...** | Move o item para outro local cadastrado. |
| **Importar preço** | Busca a média local da UEX para preencher o valor em aUEC, quando houver dados compatíveis. |
| **Excluir** | Remove o registro após confirmação. |

Para organizar corretamente os locais, selecione na ordem: **Sistema**, depois **Tipo de local**, e por último **Localização**. A lista é a mesma usada por Inventário, Baú de Minério e transferência de itens.

> **Dica:** antes de usar **Importar preço**, sincronize os itens e médias na tela **UEX API (Live)**. Sem sincronização local, o programa não terá de onde consultar o valor médio.

### 5.2 Blueprints

Em **Itens & Crafting → Blueprints**, você pode acompanhar projetos conhecidos, marcá-los como possuídos, adicioná-los à lista de desejos, registrar quantas vezes já foram craftados e escrever notas.

Quando quiser fabricar algo, clique em **Quero craftar**. O programa exibirá uma confirmação rápida e enviará a blueprint para a fila do Tracking de Materiais.

A tela possui filtros para facilitar a organização. O filtro de blueprints **com materiais** mostra apenas as blueprints que já possuem ingredientes cadastrados. Blueprints restauradas de backup SCMDB podem aparecer destacadas quando ainda faltarem dados de ingredientes; complete os materiais para que elas possam participar do tracking.

#### Restaurar backup SCMDB

Use o botão de restauração quando possuir um arquivo de backup exportado pelo SCMDB. Escolha o arquivo e confirme a importação. As blueprints restauradas serão marcadas como suas, mas uma blueprint sem ingredientes ainda precisa ter seus materiais cadastrados ou revisados manualmente.

### 5.3 Tracking de Materiais

A página **Itens & Crafting → Tracking Materiais** reúne as necessidades de todas as blueprints da fila. Ela mostra o que é necessário, quanto já foi coletado e quanto ainda falta.

O tracking não mistura materiais de qualidade diferente. Por exemplo, se uma blueprint exige `Iron` com qualidade mínima `800`, esse requisito aparece separado de um `Iron` sem requisito de qualidade. Assim, minério de qualidade inferior não é usado por engano para completar uma exigência superior.

#### Como registrar coleta

1. Localize o material na lista.
2. Escolha a unidade de coleta quando o material usar carga: **cSCU** ou **SCU**.
3. Digite a quantidade e use o botão de adicionar.
4. O programa converte automaticamente os valores para manter o cálculo correto.

Para retirada ou correção, use o controle de diminuir. Caso queira apagar somente a coleta registrada daquele material, use **Zerar coleta** no final do card. Isso não remove a blueprint da fila nem apaga o requisito; apenas volta a coleta daquele material para zero.

#### Prioridade da lista

Arraste um card pelo mouse para reorganizar a sequência. A lista salva sua ordem e o material definido como próxima prioridade respeita essa organização.

#### Concluir do Baú

Quando você já possui os minérios no **Baú de Minério**, use **Concluir do Baú** na blueprint desejada. O programa verifica se há quantidade suficiente e se a qualidade atende ao requisito. Se tudo estiver correto, os minérios são descontados do Baú e a coleta é concluída.

> **Atenção:** esse botão reduz o estoque do Baú de Minério. Confira a blueprint e a qualidade antes de confirmar.

---

## 6. Mineração e Baú de Minério

### 6.1 Guia de Mineração

O **Guia de Mineração** é uma área pessoal para registrar suas builds. Cadastre uma nave, a cabeça de mineração, módulos, peças equipadas, situação da build e observações.

A intenção é funcionar como um lembrete das configurações que você usa. Por isso, a tela não exibe números técnicos de potência, alcance, instabilidade ou extração.

### 6.2 Mineração em Grupo

Em **Mineração → Mineração em Grupo**, registre sessões com os participantes, materiais, refino, loot e observações. Use a tela para manter um histórico de operações compartilhadas e consultar como o resultado foi dividido.

### 6.3 Baú de Minério

O **Baú de Minério** representa seu estoque físico de recursos minerais. Ao adicionar um minério, informe a quantidade, a unidade, a qualidade e o local onde está armazenado.

O formulário deixa clara a unidade usada. Para carga, escolha **SCU** ou **cSCU**. O programa converte e salva o valor corretamente para que o Baú e o Tracking de Materiais trabalhem com o mesmo total.

#### O que é SCU e cSCU

| Unidade | Equivalência |
|---|---:|
| **1 SCU** | 100 cSCU |
| **1 cSCU** | 0,01 SCU |
| **1 SCU** | 1.000 mSCU |
| **1 SCU** | 1.000.000 μSCU |

Exemplo: se você registrar `12.911 cSCU`, o programa interpreta como **129,11 SCU**. Em valores grandes, use ponto para milhares e vírgula para casas decimais, seguindo o padrão brasileiro.

Cada minério recebe uma cor própria para tornar a lista mais fácil de ler. Você pode editar, transferir ou deduzir uma entrada quando usar o material.

---

## 7. Cofre do Clã e Missões

### 7.1 Cofre do Clã

O **Cofre do Clã** é um inventário compartilhado. Registre itens, quantidades, responsável, local e notas. A tela é útil para saber o que pertence ao grupo e evitar que dois jogadores utilizem o mesmo recurso sem combinar.

Use os controles de consumo quando algum item for gasto. Sempre inclua uma nota ou responsável em itens importantes para facilitar a conferência posterior.

### 7.2 Rastreador de Missões

Em **Clã & Missões → Missões**, você pode criar missões manualmente ou acompanhar missões detectadas pelo Monitor Automático.

A tela possui abas como **Hoje**, **Histórico**, **Estatísticas** e **Reaproveitar Missão**. Os nomes podem variar discretamente conforme o espaço da janela, mas as funções permanecem as mesmas.

#### Registrar uma missão manualmente

1. Clique para adicionar uma missão.
2. Informe título, facção, tipo, sistema, local e dificuldade.
3. Preencha a recompensa, quando conhecida.
4. Adicione participantes, objetivos, notas e loot, se necessário.
5. Atualize o status à medida que a missão evolui.

Use o status **Saiu da carteira** quando você gastou aUEC. Esse valor é tratado como saída de dinheiro no cálculo diário, em vez de receita.

#### Ver ou editar um registro

Clique no card ou no título da missão para abrir a janela de detalhes. Nela você consegue conferir status, recompensa, reputação, duração, objetivos, loot, notas e informações do monitor automático. Use **Editar** para corrigir qualquer campo.

#### Reaproveitar Missão

A função **Reaproveitar Missão** cria uma nova missão a partir de um registro antigo, sem alterar o histórico original. Pesquise pelo título, facção ou tipo; se houver versões semelhantes, expanda o grupo para escolher a variante com recompensa, local e dificuldade mais parecidos com a missão atual.

#### Loot e divisão de recompensa

Ao finalizar uma missão, você pode registrar o loot e escolher um modo de distribuição:

| Modo | Como funciona |
|---|---|
| **Divisão por igual** | O programa divide o valor ou a quantidade igualmente entre os participantes. |
| **Dividido por porcentagem** | Você informa quanto por cento cada pessoa recebe. A soma deve chegar a 100%. |
| **Dividido manualmente** | Você escreve os valores ou quantidades conforme o acordo do grupo. |

#### Estatísticas e reset

A aba **Estatísticas** reúne ganhos, perdas, status e desempenho. O botão **Resetar estatísticas e histórico** apaga o histórico e as perdas da carteira após confirmação.

> **Atenção:** o reset é uma ação destrutiva. Faça um backup antes se desejar guardar seus dados. As configurações do monitor automático e do Gerenciador de Missões são preservadas.

### 7.3 Monitor Automático de Missões

O Monitor Automático lê o `Game.log` do Star Citizen e integra eventos detectados ao mesmo Rastreador de Missões.

1. Na página de Missões, localize o painel **Monitor Automático**.
2. Escolha o arquivo `Game.log` do jogo.
3. Inicie o monitor.
4. Deixe o Companheiro Emoto aberto enquanto joga.

Missões reconhecidas recebem a marca **AUTO**. Quando o log não informar a recompensa em aUEC, a missão fica com o aviso de recompensa pendente. Use o preenchimento rápido ou a edição completa para informar o valor posteriormente.

O monitor também pode registrar conclusão, falha, duração, reputação e blueprints recebidas, quando essas informações aparecerem no log. Se uma missão não for detectada, confira se o caminho do `Game.log` está correto e se o monitor está ligado.

### 7.4 Gerenciador de Missões

Use **Sistema → Gerenciador de Missões** para administrar as opções que aparecem no Rastreador: **Facções**, **Tipos de missão** e **Sistemas**.

Você pode adicionar novos valores quando o jogo receber conteúdo novo, editar nomes e notas, desativar opções antigas ou reativá-las. Depois de salvar, o Rastreador de Missões atualiza suas listas automaticamente.

---

## 8. UEX: configuração, vendas e negociações

### 8.1 Configurar UEX API (Live)

A tela **UEX → UEX API (Live)** conecta o aplicativo aos dados da UEX. Nela você pode informar seu token e, quando sua conta exigir, a secret key.

1. Obtenha suas credenciais na UEX.
2. Abra **UEX API (Live)**.
3. Cole o token e a secret key, se aplicável.
4. Use o botão de teste para confirmar a conexão.
5. Abra as abas de dados desejadas e use **Atualizar** para salvar um catálogo local.

Os dados sincronizados podem incluir itens, locais, mineração, médias de marketplace e veículos. Eles são usados por outras telas, como Inventário, Alertas de Compra, Inteligência UEX e Hangar.

> **Segurança:** token e secret key são dados privados. Não envie capturas de tela, backups ou arquivos que contenham essas credenciais para outras pessoas.

### 8.2 Acompanhamento UEX

A página **UEX → Acompanhamento UEX** possui três áreas principais: **Meus Itens**, **Vendas** e **Tendências**.

#### Meus Itens

Use **Sincronizar UEX** para trazer seus anúncios, quando seu IGN estiver configurado. O programa atualiza preço, estoque e data de expiração dos anúncios encontrados.

Você também pode adicionar registros manualmente, inclusive itens esgotados. Nos cards de item, acompanhe preço, estoque, localização, qualidade, status do anúncio e dados de mercado quando disponíveis.

Um anúncio expirado aparece com destaque de alerta. Um anúncio próximo de expirar recebe destaque amarelo. Se você renovar o anúncio na UEX e sincronizar novamente, o programa tenta reconhecer a renovação e atualizar o status local.

#### Vendas

A aba **Vendas** guarda seu histórico de vendas concretizadas, tentativas sem sucesso e listagens expiradas. Use **Venda Manual** para registrar uma venda que não veio do chat da UEX.

Cada histórico pode ser aberto ao clicar na linha ou no botão de visualização. A janela de detalhes mostra item, status, data, preço unitário, quantidade, receita, qualidade, comprador, localização, notas e, em vendas vindas de negociação, os dados técnicos disponíveis da UEX.

Use **Editar histórico** para corrigir o registro. Ao alterar preço ou quantidade de uma venda concretizada, a receita total é recalculada automaticamente. As alterações ficam salvas no histórico e atualizam os resumos que dependem dessas vendas.

#### Tendências

A aba **Tendências** compara seus preços com dados de mercado quando houver dados sincronizados. Ela pode mostrar média atual, média de 30 dias, preço recomendado, quantidade de anúncios e negociações. Use essas informações como apoio, não como garantia de venda.

### 8.3 Negociações UEX

Em **UEX → Negociações UEX**, você visualiza negociações e mensagens da sua conta UEX. É necessário configurar ao menos o token na UEX API (Live).

A lista identifica visualmente cada comprador ou vendedor. Clique em uma negociação para abrir o chat completo.

#### Dentro de uma negociação

| Função | Como usar |
|---|---|
| **Abrir Spectrum** | Abre a comunidade Spectrum para você adicionar o comprador ou vendedor como amigo. |
| **Copiar o nick do comprador** | Copia o nome para a área de transferência; depois basta colar no Spectrum. |
| **Atualização automática** | O chat procura mensagens novas periodicamente enquanto a tela está aberta. |
| **Traduzir** | Abaixo de uma mensagem recebida, use o botão para mostrar uma tradução em português. |
| **Enviar em português** | Envia o texto da caixa em português. |
| **Enviar em inglês** | Envia a versão em inglês da caixa de tradução; revise antes de enviar. |
| **Concluir com sucesso e registrar venda** | Fecha o resultado apenas no aplicativo e cria/atualiza uma venda no Acompanhamento UEX. |
| **Encerrar sem sucesso** | Marca o resultado localmente sem criar uma venda. |

> **Importante:** registrar o encerramento não altera, avalia, compra, vende ou encerra nada no site da UEX. É um registro local para organizar seu histórico. O envio de mensagens, por outro lado, é uma ação real para a negociação selecionada; revise o texto antes de clicar em enviar.

---

## 9. Inteligência UEX e Alertas de Compra

### 9.1 Inteligência UEX

A tela **UEX → Inteligência UEX** reúne análises de dados de mercado. Ela serve para comparar oportunidades, preços por qualidade e refinarias.

#### Análise de lucro e oportunidades

Use filtros de margem, confiança, sucesso reportado, negociações, anúncios, risco, tendência, moeda, qualidade e origem de preço. Você também pode escolher uma estratégia de ordenação, como maior margem, maior liquidez, menor risco ou maior valor por unidade.

A tabela possui muitas colunas. Em telas menores, use a barra horizontal da própria tabela para ver as informações à direita. Clique nos títulos das colunas para alternar entre maior e menor valor, ou utilize o seletor de ordenação.

A origem do preço ajuda a distinguir dados do jogo e do marketplace de jogadores:

| Filtro de origem | Uso recomendado |
|---|---|
| **Somente mercado UEX** | Comparar preços entre anúncios e negociações de jogadores. |
| **Somente referência in-game** | Usar valores disponíveis no catálogo do jogo sincronizado. |
| **Comparar in-game + UEX** | Ver as duas referências lado a lado. |

Os gráficos e o score são ferramentas de apoio. Uma margem alta com pouca atividade, poucos anúncios ou baixo sucesso pode ser uma oportunidade arriscada, não uma venda garantida.

#### Mercado por qualidade

Esta aba ajuda a comprar ou vender considerando qualidade. Você pode filtrar por item, qualidade, preço, atividade e ordenação. Observe a diferença entre **Venda — quero comprar** e **Compra — quero vender** antes de decidir.

Dê preferência a resultados com mais anúncios e dados consistentes. Uma linha baseada em apenas um anúncio pode não representar o preço real de mercado.

#### Refinarias

Na aba **Refinarias**, pesquise uma commodity manualmente ou use filtros de terminal, método, rendimento e estado de jobs. Você pode ordenar por rendimento atual, sete dias, trinta dias ou nome da commodity e ativar filtros como **Somente rendimento positivo** e **Melhor resultado**.

Os jobs de refinaria pertencem à sua conta quando a UEX disponibiliza esses dados. O aplicativo exibe as informações; ele não cria nem altera jobs na UEX.

### 9.2 Alertas de Compra

A página **UEX → Alertas de Compra** permite criar regras para o programa procurar anúncios compatíveis e avisar você quando encontrar algo interessante.

#### Criar um alerta

1. Clique para adicionar um alerta.
2. Escolha um item do catálogo UEX ou use a opção de **item digitado manualmente** para itens não disponíveis no autocomplete.
3. Defina a origem desejada, se necessário.
4. Escolha qualquer qualidade, item looteado ou uma faixa de qualidade entre Q0 e Q1000.
5. Selecione **menor preço** ou defina uma faixa/teto de preço.
6. Se quiser, limite a atividade recente do vendedor.
7. Salve o alerta.

Depois, configure o intervalo de atualização, a quantidade máxima de anúncios por grupo e se a análise automática está ligada. O contador da tela mostra quanto falta para a próxima análise.

Os resultados ficam organizados por grupo de item. Clique em um grupo para abrir os detalhes dos anúncios encontrados, incluindo preço, qualidade, vendedor, atividade, horário e link da oferta. Você pode abrir ou copiar o link e remover grupos que não quer mais ver.

O sino global emite som quando há um novo resultado, desde que o som não esteja silenciado.

> **Limite importante:** a análise automática funciona somente enquanto o Companheiro Emoto está aberto. Ela consulta anúncios e mostra resultados; não compra, reserva, negocia ou modifica ofertas automaticamente.

---

## 10. Acompanhamento Wikelo

O Acompanhamento Wikelo permite cadastrar várias missões e itens repetidos sem reutilizar automaticamente a mesma unidade do inventário. Use **Escanear seus itens** para consultar o estoque sem removê-lo; a entrega só reduz o Inventário quando você confirma **Entregar para o Wikelo**.

### 10.1 Cálculo de Wikelo Favor e scrip

Quando o item da missão for **Wikelo Favor**, a tela mostra a quantidade faltante e converte esse saldo para scrip:

> **1 Wikelo Favor = 50 scrip.**

O programa soma todos os registros disponíveis de **MG Scrip**, **Council Scrip** e **ConCuI Scrip** no Inventário de Itens. O card mostra o scrip necessário, o saldo encontrado e quanto ainda falta. O cálculo é informativo: ele não remove scrip do inventário e não marca o Favor como coletado automaticamente.

### 10.2 Fluxo recomendado

1. Cadastre a missão e adicione `Wikelo Favor` como item, com a quantidade necessária.
2. Confira a indicação de Favors faltantes e scrip necessário.
3. Cadastre ou revise MG Scrip e Council/ConCuI Scrip no Inventário de Itens.
4. Use **Escanear seus itens** quando quiser considerar itens físicos disponíveis.
5. Corrija uma coleta acidental com **− Remover** ou **Zerar quantidade**.
6. Quando todos os itens estiverem completos, confirme a entrega. A redução do inventário ocorre somente nessa confirmação.



Em **UEX → Acompanhamento Wikelo**, acompanhe missões, scripts e o progresso de recompensas do Wikelo.

Registre ou ajuste suas quantidades de **Mg Scrip**, **Council Scrip** e **Wikelo Favor**. Os botões de adicionar e remover scripts salvam a quantidade atual. O total de Favors considera tanto os Favors diretos no inventário quanto a conversão de scripts.

A regra usada é simples:

| Recurso | Conversão |
|---|---:|
| Wikelo Favor direto | Conta como Favor imediatamente. |
| 50 Mg Scrip | 1 Wikelo Favor. |
| 50 Council Scrip | 1 Wikelo Favor. |

O acompanhamento serve para organização pessoal. Sempre confira dentro do jogo se uma troca ou recompensa já foi concluída antes de considerar o saldo como definitivo.

---

## 11. Hangar de Naves

A tela **UEX → Hangar de Naves** tem duas abas: **Naves UEX** e **Meu Hangar**.

### 11.1 Preparar o catálogo de naves

Antes de usar o Hangar, abra **UEX → UEX API (Live)** e atualize a aba de veículos. O Hangar usa esse catálogo local para não repetir consultas desnecessárias.

Se a tela informar que ainda não existe catálogo local, volte à UEX API (Live), abra **Veículos** e use **Atualizar**. Depois retorne ao Hangar e clique em **Recarregar dados locais**.

### 11.2 Naves UEX

Nesta aba, você consulta as naves e veículos conhecidos pela UEX. Use a busca para localizar por nome, fabricante ou slug. Os filtros permitem separar naves, veículos terrestres e funções como carga, mineração, salvamento, medicina, exploração, militar ou passageiros.

Use a ordenação para priorizar nome, capacidade de carga ou tripulação. Você pode alternar entre **Cards** e **Lista**; a preferência de visualização é guardada separadamente para esta aba.

Ao expandir uma nave, a tela pode mostrar especificações, carga em SCU, tripulação, dimensões, combustível, compra, aluguel e terminais conhecidos. Quando a UEX não informar um dado, o programa mostra um traço em vez de inventar um valor.

### 11.3 Registrar uma compra

No card ou linha da nave, clique em **Comprei**. Informe a quantidade, o preço pago por unidade e observações, se desejar.

O preço é opcional. Caso não saiba quanto pagou, registre a nave mesmo assim; ela aparecerá no hangar, mas ficará como **custo não informado** e não será incluída no total de aUEC gasto até que você complete o preço na edição.

Quando uma nave do catálogo já tiver sido registrada como compra, o catálogo mostra um contador e um contorno visual para facilitar a identificação.

### 11.4 Meu Hangar

A aba **Meu Hangar** mostra somente suas naves registradas localmente. Ela apresenta indicadores de quantidade, tipos, naves compradas, Edições Wikelo e total gasto em compras.

Use a busca, o filtro de origem e a ordenação para encontrar um registro rapidamente. Você pode escolher **Cards** ou **Lista** nesta aba de forma independente da visualização do catálogo.

| Origem | Como é tratada |
|---|---|
| **Comprada** | Pode ter preço por unidade e entra no total de aUEC gasto. |
| **Edição Wikelo** | É gratuita, aparece em grupo e cor próprios e nunca entra no total gasto. |

Em cada registro, você pode aumentar ou diminuir a quantidade, editar observações, preencher/corrigir o preço pago e remover a nave. Ao editar uma compra, o custo total é recalculado como **quantidade × preço por unidade**.

### 11.5 Naves do Wikelo

Clique em **Naves do Wikelo** para abrir o mesmo catálogo usado pela aba Naves UEX. Pesquise e escolha a nave recebida. Ela será salva com o mesmo nome e características do catálogo, mas identificada como **Edição Wikelo**.

Essas naves aparecem em um grupo visual separado, com cor diferente, custo `0 aUEC` e sem impacto no contador de gastos. Não é necessário informar preço, pois a edição Wikelo é tratada como gratuita no aplicativo.

> **Importante:** o Meu Hangar é um controle local. Registrar uma nave aqui não compra, vende, aluga nem altera sua frota real no jogo ou na UEX.

---

## 12. Sistema: notas, locais, backups e pasta de dados

### 12.1 Bloco de Notas

Use **Sistema → Bloco de Notas** para guardar textos livres. Cada nota pode ter uma aparência diferente para facilitar a identificação visual.

A área **Textos UEX** é indicada para frases que você envia repetidamente em negociações. Salve cada texto e use o botão de copiar para colocá-lo na área de transferência. Depois, cole onde precisar com `Ctrl + V`.

### 12.2 Adicionar Local

A tela **Sistema → Adicionar Local** permite cadastrar, editar, ativar ou remover locais do Star Citizen. Você pode informar sistema, tipo de local e nome, por exemplo planeta, estação, hangar, posto avançado ou outra categoria.

Esses locais são reutilizados no Inventário, Baú de Minério e transferências. Sempre cadastre um local aqui em vez de criar grafias diferentes em cada tela.

### 12.3 Backup & Restauração

Em **Sistema → Backup & Restauração**, você pode gerar um **backup seletivo** das categorias escolhidas, como missões, notas, mineração, baú, tracking, Wikelo, Hangar e informações locais da UEX.

O backup seletivo é ideal para guardar somente partes específicas dos dados. Ele não é a melhor opção para transportar tudo para outro computador, pois Inventário e Armaduras usam o banco local do aplicativo.

### 12.4 Diretório de Dados e Backup Completo

Em **Sistema → Diretório de Dados**, você visualiza e pode alterar a pasta central do programa. A mesma tela permite criar um **Backup Completo**.

| Tipo de backup | Quando usar | O que inclui |
|---|---|---|
| **Backup seletivo** | Antes de alterar uma área específica ou compartilhar apenas dados escolhidos. | Categorias selecionadas do armazenamento local. |
| **Backup completo** | Antes de reinstalar, trocar de computador ou fazer grandes mudanças. | Dados locais completos e o banco do aplicativo. |

Para restaurar um backup completo em outro computador, mantenha juntos o arquivo JSON e o arquivo de banco associado. A restauração pode pedir reinício do programa para carregar os dados corretamente.

> **Segurança:** backups completos podem incluir token UEX, secret key e chave opcional de tradução. Guarde-os como arquivos privados e não envie para desconhecidos.

---

## 13. Ferramentas disponíveis em qualquer tela

### 13.1 Calculadora flutuante

O botão de calculadora fica no canto inferior direito. Clique para abrir a calculadora sem sair da tela atual.

A calculadora aceita operações de soma, subtração, multiplicação, divisão e porcentagem. Você pode usar os botões ou o teclado. O resultado utiliza o padrão brasileiro para facilitar a leitura:

| Valor calculado | Como aparece |
|---:|---:|
| 1000 | 1.000 |
| 12500 | 12.500 |
| 2500000 | 2.500.000 |
| 1234.56 | 1.234,56 |

A formatação visual não altera o cálculo. Você pode continuar uma conta depois de obter um resultado ou fechar a calculadora pelo botão `X`.

### 13.2 Sino de notificações UEX

O sino mostra avisos relacionados a negociações e Alertas de Compra. Quando houver uma nova oferta compatível com um alerta, ele pode emitir som e levar você diretamente ao grupo de anúncios correspondente.

Use o sino para abrir a central de notificações, conferir mensagens e marcar avisos como visualizados. Se preferir não ouvir alertas, utilize o controle de som disponível na interface de notificações.

---

## 14. Dicas importantes, unidades e cuidados

### Como interpretar os números

O aplicativo usa o formato brasileiro em campos e resultados visuais:

| Símbolo | Exemplo | Significado |
|---|---|---|
| Ponto | `1.500` | Separador de milhares. |
| Vírgula | `1,5` | Casa decimal. |
| aUEC | `250.000 aUEC` | Moeda usada pelo aplicativo para valores do jogo e mercado. |

Em campos numéricos, se o sistema solicitar uma quantidade de carga, verifique a unidade antes de confirmar. `1 SCU` e `100 cSCU` representam a mesma carga, mas escrever o valor na unidade errada pode confundir sua conferência visual.

### Boas práticas de organização

1. Use nomes consistentes para itens e locais. Selecionar sugestões da UEX reduz duplicidades.
2. Registre a qualidade dos minérios quando ela for relevante para uma blueprint.
3. Faça um backup completo antes de reinstalar o programa, trocar de computador ou restaurar arquivos antigos.
4. Sincronize dados UEX antes de usar preço médio, Hangar ou análises de mercado.
5. Trate preços, tendências e scores como referências; confirme condições e disponibilidade no site/jogo antes de tomar uma decisão.
6. Não compartilhe token, secret key, chave de tradução ou backups completos.

---

## 15. Solução de problemas comuns

| Situação | O que fazer primeiro |
|---|---|
| **Hangar informa que não existe catálogo local** | Abra **UEX API (Live) → Veículos**, clique em **Atualizar** e depois use **Recarregar dados locais** no Hangar. |
| **Preço do item não é importado** | Sincronize itens e médias na UEX API (Live), selecione o item pelo autocomplete e tente novamente. Nem todo item possui média disponível. |
| **Negociações UEX não aparecem** | Verifique token/secret key em **UEX API (Live)** e use **Atualizar** em Negociações UEX. |
| **Chat não atualiza ou falha ao enviar** | Confira sua conexão e credenciais UEX. Se a negociação estiver encerrada, novas mensagens não podem ser enviadas. |
| **Tradução não funciona** | Tente novamente mais tarde. O serviço gratuito pode ter limite temporário; a tradução deve sempre ser revisada antes do envio. |
| **Missão AUTO não foi detectada** | Confirme se o Monitor está ligado e se o caminho selecionado aponta para o `Game.log` correto. |
| **Concluir do Baú não funciona** | Confira se existe minério suficiente no Baú e se a qualidade atende ao mínimo pedido pela blueprint. |
| **Local não aparece em um seletor** | Cadastre ou ative o local em **Sistema → Adicionar Local** e reabra o formulário. |
| **Quero recuperar dados após troca de PC** | Use o **Backup Completo**, levando o JSON e o banco associado juntos. |
| **A tela mostra dados de mercado antigos** | Atualize o módulo correspondente em UEX API (Live) ou use o botão de atualização da própria tela. |

Se um problema persistir, faça um backup completo antes de qualquer tentativa de reinstalação. Assim, seus registros podem ser restaurados depois.

---

## Referências

[1]: MANUAL-DO-PROGRAMADOR.md "Manual do programador do Companheiro Emoto"

---

**Fim do manual.**

> Para começar de forma simples, use a Dashboard, registre seus itens e missões, sincronize a UEX quando necessário e mantenha um backup completo atualizado.


## Servidor Mobile — acesso pelo celular

A versão 3.0.0 permite consultar parte do Companheiro Emoto pelo navegador do celular, usando o computador como servidor local. O recurso é opcional e fica desligado até que você o ative.

### Como ligar

Abra **Sistema → Diretório de Dados** e localize o cartão **Servidor Mobile · v3.0.0**. Confira a porta sugerida, normalmente `47821`, e pressione **Ligar servidor**. O programa exibirá um ou mais endereços de rede, além de um token temporário.

O computador e o celular precisam estar conectados à mesma rede Wi-Fi. Copie o endereço completo mostrado pelo programa e abra-o no navegador do celular. O token já está incluído no link. Se preferir, copie o token separadamente e use o endereço com `?token=SEU_TOKEN`.

### O que está disponível no celular

A primeira versão mobile oferece uma interface compacta para **Resumo**, **Inventário** e **Armaduras**. É possível pesquisar os registros e atualizar a consulta. O computador continua sendo responsável pelo banco, arquivos, monitor do Game.log e integrações protegidas.

### Segurança e desligamento

Use o servidor somente em uma rede Wi-Fi confiável. Não publique a porta na internet e não compartilhe o endereço com o token em grupos ou redes sociais. Para encerrar o acesso, volte ao cartão do servidor e pressione **Desligar servidor**. Para invalidar links antigos sem desligar o serviço, pressione **Renovar token**.

O celular não acessa diretamente a pasta de dados do computador. Operações como backup, restauração, escolha de diretório, leitura do Game.log e acesso a arquivos continuam disponíveis apenas no aplicativo desktop nesta primeira versão.

### Solução de problemas

Se o celular não abrir o endereço, confirme que os dois dispositivos estão na mesma rede, que o servidor está marcado como **LIGADO**, que o endereço foi copiado completo e que o Firewall do Windows permitiu o aplicativo Electron na rede privada. Se a rede tiver mais de um endereço, tente os outros endereços exibidos pelo cartão.


## 16. Acesso pelo celular — versão 3.0.0

O Companheiro Emoto pode abrir uma versão adaptada para celular sem transferir o banco para a internet. O computador continua ligado e funcionando como servidor local; o celular apenas acessa os dados pela mesma rede Wi-Fi.

### 16.1 Ligar o servidor

1. Abra **Sistema → Diretório de Dados**.
2. Localize o cartão **Servidor Mobile**.
3. Escolha uma porta livre ou mantenha a porta sugerida.
4. Pressione **Ligar servidor**.
5. Copie a URL completa exibida pelo programa, incluindo o token depois de `?token=`.
6. Abra essa URL no navegador do celular.

O computador e o celular precisam estar conectados à mesma rede. O programa precisa permanecer aberto; se o computador for desligado, entrar em suspensão ou mudar de rede, o celular perderá a conexão.

### 16.2 O que está disponível no celular

| Tela | O que você pode fazer |
|---|---|
| **Resumo** | Consultar quantidades gerais de armaduras e itens. |
| **Inventário** | Pesquisar itens, ver local e quantidade, aumentar ou reduzir quantidade. |
| **Armaduras** | Pesquisar sets, variantes, peças e quantidade possuída. |
| **Wikelo** | Consultar missões e progresso sincronizado. |
| **Missões** | Consultar missões e usar as ações de concluir ou encerrar quando disponíveis. |
| **UEX** | Consultar anúncios locais sincronizados. |
| **Alertas** | Consultar alertas e dispensar um alerta após confirmação. |

### 16.3 Alterar uma quantidade do inventário

1. Abra a aba **Inventário** no celular.
2. Use o campo de pesquisa para localizar o item.
3. Pressione `+` para adicionar uma unidade ou `−` para reduzir uma unidade.
4. Aguarde a atualização do card.

A alteração é gravada no computador. Se a quantidade chegar a zero, o registro não é apagado; apenas fica com quantidade zero. O servidor impede valores negativos.

### 16.4 Atualizar uma missão

Na aba **Missões**, confira o registro desejado e pressione **Concluir** ou **Encerrar**. O aplicativo pedirá confirmação antes de enviar a alteração. Caso a missão não tenha um identificador compatível ou tenha sido removida no desktop, será exibida uma mensagem de erro e nenhum dado será alterado.

### 16.5 Atualizar Wikelo e dispensar alertas

A aba **Wikelo** mostra o snapshot sincronizado pelo desktop. O processo principal mantém o banco e o localStorage no computador; por isso, operações que dependem de inventário, scrip, entrega ou consumo continuam sendo realizadas na tela desktop para preservar todas as validações.

Na aba **Alertas**, pressione **Dispensar alerta** somente depois de conferir o item. A ação pede confirmação e remove o alerta da lista local sincronizada.

### 16.6 Atualização automática

Quando o desktop sincronizar Wikelo, UEX, missões ou alertas, o celular recebe uma atualização automática. O portal utiliza uma conexão de eventos em tempo real; se a rede cair, use **Atualizar** ou recarregue a página.

### 16.7 Segurança e desligamento

A URL completa contém um token temporário. Não publique esse endereço e não envie uma captura de tela que revele o token. Para bloquear imediatamente o acesso, volte ao desktop e pressione **Desligar servidor**. Para continuar usando o servidor com um novo endereço protegido, pressione **Renovar token**.

O servidor foi projetado para uso em rede local. Não encaminhe a porta no roteador e não disponibilize o endereço na internet. O celular não recebe tokens da UEX, secret-keys, caminhos de arquivos ou acesso direto ao banco.

### 16.8 Problemas comuns

| Problema | Solução |
|---|---|
| O celular não abre o endereço | Confirme que ambos estão na mesma Wi-Fi e que o firewall do Windows permite o aplicativo. |
| Aparece token inválido | Copie a URL completa novamente ou renove o token e abra o novo endereço. |
| A lista está desatualizada | Pressione **Atualizar** e confirme que o desktop continua aberto. |
| O servidor não inicia | Escolha outra porta; a porta informada pode estar ocupada por outro programa. |
| A conexão cai ao bloquear o computador | Retome o computador e reabra a URL; a suspensão interrompe o servidor. |


## 17. Escopo final e limites do acesso mobile

A versão atual permite consultar pelo celular: Resumo, Inventário, Armaduras, Blueprints, Tracking de Materiais, Mineração, Mineração em Grupo, Baú de Minério, Hangar, Cofre do Clã, Notas, Wikelo, Missões, anúncios UEX, Negociações UEX e Alertas de Compra. Também é possível ajustar quantidades do Inventário, registrar progresso Wikelo, alterar status de missão, dispensar alertas e abrir mensagens de uma negociação UEX.

Para preservar a segurança, backup, restauração, Limpeza Seletiva, escolha de pasta, leitura do Game.log, controle do Monitor Automático, configuração de tokens, sincronização de importação UEX, envio de mensagens, finalização de venda, criação/edição/exclusão de registros e operações de consumo continuam disponíveis somente no desktop. O celular não acessa diretamente arquivos, banco ou credenciais.

O portal não é um aplicativo offline instalado. Ele funciona no navegador enquanto o Companheiro Emoto estiver aberto e o celular permanecer na mesma rede local. Se o usuário precisar de acesso sem o computador ligado, será necessário desenvolver uma versão hospedada ou um aplicativo mobile separado, o que não faz parte desta entrega.


### Conexão rápida por QR Code

Com o Servidor Mobile ligado, a seção Sistema mostra um QR Code em um cartão próprio. Abra a câmera do celular, escaneie o código e confirme a abertura do endereço. O QR Code já contém o endereço IP, a porta e o token temporário; não é necessário digitar o token separadamente.

Se o token for renovado, o QR Code é recriado automaticamente. Os códigos anteriores deixam de funcionar por segurança. Ao desligar o servidor, todos os acessos mobile são encerrados.


### Tracking de Materiais pelo celular

Abra o portal mobile e selecione **Materiais**. O topo mostra quantos materiais estão faltando, quantos estão completos e o total acompanhado. Abaixo, a fila de blueprints exibe quais crafts estão sendo considerados.

Cada card informa o material, a unidade, a qualidade mínima, o total necessário, o total encontrado no Baú de Minério, o faltante e uma barra de progresso. Materiais com qualidade mínima só consideram entradas do Baú que atendam ou superem essa qualidade. Use o campo de pesquisa para encontrar rapidamente um minério ou blueprint. Pressione **Atualizar** depois de cadastrar minério no desktop; o portal também recebe atualizações automáticas quando o estado local é sincronizado.
