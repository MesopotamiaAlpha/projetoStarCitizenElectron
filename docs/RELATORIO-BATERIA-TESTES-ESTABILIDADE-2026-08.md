# Relatório de bateria de testes — Companheiro Emoto 2.0.0

## Resultado executivo

A bateria foi executada sobre o projeto React/Electron em ambiente de desenvolvimento. Foram usados **4.000 registros sintéticos de Inventário** e **4.000 peças de armadura** no benchmark de coleção. A validação terminou sem falhas na suíte completa, no build React, na checagem Electron ou no benchmark de agrupamento e paginação.

Durante os testes de cálculo foi encontrado e corrigido um bug real na interpretação de valores numéricos internos. A heurística brasileira que interpreta `2.000.000` como separador de milhar podia tratar um número decimal JavaScript como texto e converter incorretamente valores como `109.891 SCU`. Agora números internos são preservados numericamente; a heurística de milhar continua aplicada somente às entradas textuais digitadas pelo usuário.

## Cobertura automatizada

| Área | Resultado |
|---|---:|
| Suítes React | **34 aprovadas** |
| Testes React | **142 aprovados** |
| Testes Electron/Node | **1 aprovado** |
| Build de produção | **Aprovado** |
| Checagem de sintaxe Electron | **Aprovada** |
| `git diff --check` | **Sem erros** |
| Benchmark de armaduras | **Aprovado** |

## Carga de 4.000 registros

O teste `src/data/stabilityLoad.test.js` gera 4.000 itens com sistemas, locais, categorias, fabricantes, notas, quantidades e valores. Ele repete filtros por sistema, nome, categoria e ordenação, verifica que a coleção original não é mutada e exige resultado finito.

O benchmark de armaduras em `scripts/benchmark-armor-collection.cjs` usa 800 conjuntos com cinco peças cada, totalizando 4.000 peças. O resultado observado foi:

| Métrica | Resultado |
|---|---:|
| Conjuntos | 800 |
| Peças | 4.000 |
| Grupos | 320 |
| Itens visíveis por página | 24 |
| Iterações | 100 |
| Tempo total | 56,92 ms |
| Média por iteração | 0,569 ms |
| Heap utilizado | 5,1 MB |
| Status | **PASS** |

## Fluxos manuais de interface

Foram abertos e verificados o Dashboard, Inventário de Itens, Todas as Armaduras, Rastreador de Missões, Baú de Minério, Calculadora e Acompanhamento UEX.

No Inventário, a busca global com `iron` não duplicou barras nem registros. Um item de teste foi cadastrado com sucesso, apareceu uma única vez e apresentou localização e quantidade corretas. O formulário de novo item foi aberto e fechado sem gerar dados incompletos.

No Rastreador de Missões, o painel do monitor, abas, filtros e formulário de nova missão abriram. O cancelamento do formulário manteve os contadores zerados, sem criar missão parcial.

No Baú de Minério, o formulário mostrou as unidades `un`, `SCU`, `cSCU`, `mSCU` e `μSCU`. O caso `0.5456 SCU` exibiu `54,56 cSCU` e a ação de troca para cSCU. O formulário foi cancelado sem persistir dados de laboratório.

Na Calculadora, a sequência `1 + 2 =` retornou `3` no modo normal. O Acompanhamento UEX abriu com filtros, busca, abas e estado vazio sem erros. A sincronização externa não foi executada porque exigiria credenciais reais.

O console do navegador não apresentou exceções de React ou erros de runtime durante os fluxos testados; foram observadas apenas mensagens informativas do React DevTools e do painel do monitor.

## Arquivos alterados nesta bateria

| Arquivo | Alteração |
|---|---|
| `src/data/cargoUnits.js` | Preserva números internos em `parseCargoInput` e `normalizeCargoQuantity`, evitando interpretação indevida como milhar. |
| `src/data/stabilityLoad.test.js` | Novos testes de carga com 4.000 registros e casos-limite de SCU/cSCU. |
| `scripts/benchmark-armor-collection.cjs` | Benchmark ajustado para 4.000 peças. |
| `docs/stability-ui-findings-2026-08.md` | Evidências dos fluxos manuais de interface. |
| `docs/RELATORIO-BATERIA-TESTES-ESTABILIDADE-2026-08.md` | Este relatório. |

## Limitações

A bateria local não pode confirmar a sincronização real da UEX, autenticação, leitura de um `Game.log` real do Windows ou comportamento do instalador no computador do usuário sem acesso aos dados e credenciais reais. Esses fluxos permanecem cobertos por testes de contrato e devem ser validados no ambiente do usuário após a instalação, sem compartilhar tokens ou arquivos privados.

## Reprodução

```bash
npm run verify
node scripts/benchmark-armor-collection.cjs
```
