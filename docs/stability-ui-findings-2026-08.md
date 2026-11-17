# Bateria de estabilidade — evidências de UI

Durante o teste local em `http://localhost:3000/`, o Dashboard carregou sem erro de renderização e exibiu o Centro Operacional com quatro cartões acionáveis e rótulos acessíveis.

No Inventário, a pesquisa global aceitou `iron`, criou apenas uma barra de pesquisa, exibiu resumo de quantidade e registros e não duplicou os cards. O cadastro de `Stability Test Iron 4000` com localização `New Babbage Test Locker` e quantidade `0.5456` foi concluído; apareceu uma única vez, com um registro e quantidade correta. O formulário abriu e fechou sem erro.

Na tela Todas as Armaduras, os filtros e o agrupamento por base/variante carregaram; a busca `calico` manteve o grupo correspondente visível.

No Rastreador de Missões, o painel do monitor, abas, filtros e formulário de nova missão abriram. O cancelamento do formulário não criou missão parcial e os contadores permaneceram em zero.

A aplicação React foi iniciada em modo de desenvolvimento sem falha de carregamento. O teste visual foi feito sobre dados de demonstração locais do renderer, sem acessar dados reais do usuário.

No Baú de Minério, o formulário de novo minério abriu sem erro e apresentou explicitamente `un`, `SCU`, `cSCU`, `mSCU` e `μSCU`, além da qualidade separada da quantidade. O teste visual confirmou que a tela está preparada para analisar a conversão e que o formulário não foi submetido durante esta etapa.

No teste manual do Baú, `Iron`, qualidade `916` e `0.5456` foram preenchidos; após selecionar `SCU`, a tela exibiu `0,5456 SCU` e `54,56 cSCU`, com ação explícita para trocar para cSCU. O formulário foi cancelado e o contador continuou em zero.

A calculadora abriu pelo botão flutuante. A sequência manual `1 + 2 =` no modo normal exibiu `3`, confirmando entrada de dígitos, operador, cálculo e atualização do visor.

O Acompanhamento UEX abriu com estado vazio estável, apresentando campos de IGN, sincronização, venda manual, abas, busca e filtros sem erro. Nenhuma ação de sincronização foi executada, pois exigiria credenciais externas.
