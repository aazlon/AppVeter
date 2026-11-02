# mcp-vercel

Servidor **MCP (Model Context Protocol)** en stdio que conecta cualquier proyecto con Vercel: listar proyectos y despliegues, ver el estado y los logs de un despliegue, consultar logs de runtime, vincular carpetas y desplegar.

Al ser un servidor **local e independiente de la carpeta del proyecto**, se registra **una sola vez en la configuración global** del cliente MCP y sirve para todos los proyectos.

## Requisitos

- Node.js 18 o superior.
- Un token de Vercel: <https://vercel.com/account/tokens> (o `vercel tokens add "mcp" --project <id>`).
- `npm install` dentro de esta carpeta (ya incluye el CLI de Vercel como dependencia, no hace falta instalarlo aparte).

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `VERCEL_TOKEN` | sí | Token de la API de Vercel. |
| `VERCEL_TEAM_ID` | no | Id del equipo/organización, si los proyectos viven en un scope de equipo. |

**Nunca** pegues el token dentro de los archivos del proyecto ni en el chat: va siempre en el bloque `env` de la configuración del MCP (o en el entorno del sistema).

## Registro global (una vez, para todos los proyectos)

Ruta absoluta del servidor: `C:/Users/Aaron/Desktop/Poyecto/Pet's-Product's/mcp-vercel/server.js`

### JSON genérico (Cursor, VS Code, Windsurf, y la mayoría de clientes)

Añade esto a la configuración **global** del cliente (no al `.cursor/mcp.json` del proyecto):

```json
{
  "mcpServers": {
    "vercel": {
      "command": "node",
      "args": ["C:/Users/Aaron/Desktop/Poyecto/Pet's-Product's/mcp-vercel/server.js"],
      "env": {
        "VERCEL_TOKEN": "vcp_...",
        "VERCEL_TEAM_ID": ""
      }
    }
  }
}
```

- Cursor: `~/.cursor/mcp.json` (global) frente a `.cursor/mcp.json` (solo ese proyecto).
- VS Code: `mcp.json` de usuario → *MCP: Add Server* → *Command* → marcar **Global**.
- Windsurf: `mcp_config.json` del usuario.

### Claude Code (alcance de usuario)

```bash
claude mcp add --scope user vercel \
  --env VERCEL_TOKEN=vcp_... \
  -- node "C:/Users/Aaron/Desktop/Poyecto/Pet's-Product's/mcp-vercel/server.js"
```

### Comprobación

```bash
cd mcp-vercel && npm start   # debe imprimir en stderr: mcp-vercel listo (stdio) — VERCEL_TOKEN detectado
```

Luego, desde el cliente MCP: `vercel_list_projects` debe devolver tus proyectos.

## Herramientas

| Herramienta | Qué hace |
|---|---|
| `vercel_list_projects` | Proyectos: id, nombre, framework, repo enlazado y último despliegue. |
| `vercel_list_deployments` | Despliegues recientes con estado (`READY`, `ERROR`…), entorno y URL. |
| `vercel_get_deployment` | Detalle de un despliegue (`dpl_…`): estado, inspector, commit, error. |
| `vercel_get_build_logs` | Registro de build; clave cuando el despliegue acaba en `ERROR`. |
| `vercel_logs` | Logs de runtime del CLI con filtro KQL, `--since` y límite. |
| `vercel_link` | Vincula una carpeta (`/path/al/proyecto`) con un proyecto existente. |
| `vercel_deploy` | Despliega una carpeta: previsualización por defecto, `production: true` para prod. |

Toda carpeta se pasa en `directory`, así que sirve igual para el backend, el frontend o cualquier otro repo.

## Alternativa: MCP oficial de Vercel

Vercel tiene un MCP remoto en <https://mcp.vercel.com> (OAuth, todos los planes). Configuración global con:

```bash
npx -y add-mcp https://mcp.vercel.com -g
```

Limitación: Vercel solo permite clientes de IA revisados y aprobados (Claude Code, Cursor, ChatGPT, Codex CLI…). Este MCP local no tiene esa restricción: funciona con cualquier cliente y además no depende de que el navegador esté autenticado, solo de `VERCEL_TOKEN`.

## Seguridad

- El token se lee solo de variables de entorno y nunca se escribe en logs ni en la salida MCP.
- `vercel_deploy` usa `--yes` y trabaja en modo no interactivo; por defecto crea un despliegue de **previsualización** (producción requiere `production: true` explícito).