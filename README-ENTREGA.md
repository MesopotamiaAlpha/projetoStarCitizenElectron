# Companheiro Emoto 3.0.0 — Servidor Mobile

## Arquivos para substituir

| Arquivo do pacote | Caminho no projeto |
|---|---|
| `electron/main.js` | `electron/main.js` |
| `electron/preload.js` | `electron/preload.js` |
| `electron/mobileServer.js` | novo arquivo em `electron/mobileServer.js` |
| `electron/mobileServer.test.cjs` | novo teste em `electron/mobileServer.test.cjs` |
| `src/pages/DataDirectoryPage.js` | `src/pages/DataDirectoryPage.js` |
| `package.json` | `package.json` |
| `package-lock.json` | `package-lock.json` |
| `README.md` | `README.md` |
| `MANUAL-DO-PROGRAMADOR.md` | novo nome do manual técnico |
| `Manual Usuário — Companheiro Emoto.md` | manual do usuário atualizado |

## Como instalar

Faça uma cópia de segurança do projeto. Substitua os arquivos mantendo as pastas indicadas. Se o projeto antigo ainda tiver o manual técnico com o nome `README.md`, ele foi separado: o novo `README.md` é público para GitHub e `MANUAL-DO-PROGRAMADOR.md` é o documento técnico.

Depois execute:

```powershell
npm install
npm run verify
npm run dev
```

## Como usar

Abra **Sistema → Diretório de Dados → Servidor Mobile**, escolha a porta e pressione **Ligar servidor**. Abra no celular um dos endereços exibidos, usando a mesma rede Wi-Fi. Para revogar o acesso, pressione **Desligar servidor** ou **Renovar token**.

## Escopo mobile desta primeira entrega

A interface mobile v3.0.0 oferece Resumo, Inventário e Armaduras em modo de consulta e pesquisa. O computador continua responsável pelo banco, arquivos, Game.log, tokens UEX e operações privilegiadas. O servidor é local e não deve ser publicado na internet.
