#!/usr/bin/env node
/**
 * mcp-vercel — servidor MCP (stdio) que conecta cualquier proyecto con Vercel.
 *
 * Autenticación:
 *   VERCEL_TOKEN     obligatorio — https://vercel.com/account/tokens
 *   VERCEL_TEAM_ID   opcional    — id del equipo/organización (scope)
 *
 * Como es un servidor stdio independiente de la carpeta del proyecto,
 * se registra una única vez en la configuración global del cliente MCP
 * y sirve para todos los proyectos.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const require = createRequire(import.meta.url);
const API = "https://api.vercel.com";
const MAX_TEXT = 20000;

/* ------------------------------------------------------------------ utils */

function getToken() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    throw new Error(
      "Falta la variable de entorno VERCEL_TOKEN. Créala en https://vercel.com/account/tokens y declárala en el bloque \"env\" de la configuración global del MCP."
    );
  }
  return token;
}

function buildUrl(pathname, params = {}) {
  const url = new URL(API + pathname);
  const team = process.env.VERCEL_TEAM_ID || process.env.VERCEL_TEAM;
  if (team) url.searchParams.set("teamId", team);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function apiGet(pathname, params = {}, alternatives = []) {
  let lastError;
  for (const candidate of [pathname, ...alternatives]) {
    const res = await fetch(buildUrl(candidate, params), {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) return res.json();
    const body = await res.text().catch(() => "");
    lastError = new Error(`Vercel API ${res.status} en ${candidate}: ${body.slice(0, 500)}`);
    if (res.status !== 404 && res.status !== 400) throw lastError;
  }
  throw lastError;
}

function clip(value) {
  const text = String(value ?? "");
  return text.length > MAX_TEXT
    ? `${text.slice(0, MAX_TEXT)}\n… [salida truncada: ${text.length} caracteres en total]`
    : text;
}

function json(payload) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: "text", text: clip(text) }] };
}

function failure(error) {
  return { isError: true, content: [{ type: "text", text: clip(error?.message ?? String(error)) }] };
}

function isoTime(value) {
  return value ? new Date(value).toISOString() : null;
}

function resolveDir(directory) {
  const dir = path.resolve(directory || process.cwd());
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`No existe el directorio: ${dir}`);
  }
  return dir;
}

/* ------------------------------------------------------------- vercel cli */

let vercelBinCache;

function vercelBin() {
  if (vercelBinCache) return vercelBinCache;
  let pkgPath;
  try {
    pkgPath = require.resolve("vercel/package.json");
  } catch {
    throw new Error("No se encontró el paquete 'vercel'. Ejecuta `npm install` dentro de la carpeta mcp-vercel.");
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const rel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.vercel;
  if (!rel) throw new Error("El paquete 'vercel' no expone el binario esperado.");
  vercelBinCache = path.resolve(path.dirname(pkgPath), rel);
  return vercelBinCache;
}

function runVercel(args, { cwd = process.cwd(), timeoutMs = 600000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [vercelBin(), ...args], {
      cwd,
      env: { ...process.env, NO_COLOR: "1", CI: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Tiempo agotado ejecutando: vercel ${args.join(" ")}`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}

async function cliOutput(args, options) {
  const result = await runVercel(args, options);
  const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n--- stderr ---\n");
  if (result.code !== 0) {
    throw new Error(`\`vercel ${args.join(" ")}\` terminó con código ${result.code}:\n${output || "(sin salida)"}`);
  }
  return output || "(sin salida)";
}

/* ---------------------------------------------------------------- servidor */

const server = new McpServer({ name: "vercel", version: "1.0.0" });

server.registerTool(
  "vercel_list_projects",
  {
    title: "Listar proyectos de Vercel",
    description: "Devuelve los proyectos de la cuenta o equipo de Vercel: id, nombre, framework, repositorio enlazado y último despliegue.",
    inputSchema: {
      limit: z.number().int().min(1).max(100).optional().describe("Máximo de proyectos (por defecto 100)"),
      search: z.string().optional().describe("Filtra proyectos cuyo nombre contenga este texto"),
    },
  },
  async ({ limit, search }) => {
    try {
      const data = await apiGet("/v10/projects", { limit: limit ?? 100 });
      let projects = Array.isArray(data) ? data : (data.projects ?? []);
      if (search) {
        const needle = search.toLowerCase();
        projects = projects.filter((p) => String(p.name).toLowerCase().includes(needle));
      }
      return json(
        projects.map((p) => ({
          id: p.id,
          name: p.name,
          framework: p.framework ?? null,
          updatedAt: isoTime(p.updatedAt),
          link: p.link ? `${p.link.type}:${p.link.repo}` : null,
          latestDeployment: p.latestDeployment
            ? {
                url: p.latestDeployment.url ? `https://${p.latestDeployment.url}` : null,
                state: p.latestDeployment.readyState ?? null,
                created: isoTime(p.latestDeployment.createdAt),
              }
            : null,
        }))
      );
    } catch (error) {
      return failure(error);
    }
  }
);

server.registerTool(
  "vercel_list_deployments",
  {
    title: "Listar despliegues de Vercel",
    description: "Lista los despliegues recientes, con su estado (READY, BUILDING, ERROR…), entorno y URL. El más reciente va primero.",
    inputSchema: {
      project: z.string().optional().describe("Filtra por nombre de proyecto"),
      environment: z.enum(["production", "preview", "staging"]).optional().describe("Entorno del despliegue"),
      status: z.enum(["QUEUED", "INITIALIZING", "BUILDING", "READY", "ERROR", "CANCELED"]).optional(),
      limit: z.number().int().min(1).max(100).optional().describe("Máximo de despliegues (por defecto 20)"),
    },
  },
  async ({ project, environment, status, limit }) => {
    try {
      const data = await apiGet("/v6/deployments", { limit: limit ?? 20 });
      let items = data.deployments ?? [];
      if (project) {
        const needle = project.toLowerCase();
        items = items.filter((d) => String(d.name).toLowerCase() === needle || String(d.projectId) === project);
      }
      if (environment) items = items.filter((d) => d.target === environment);
      if (status) items = items.filter((d) => d.readyState === status);
      return json(
        items.map((d) => ({
          id: d.id,
          project: d.name,
          url: d.url ? `https://${d.url}` : null,
          environment: d.target ?? null,
          state: d.readyState ?? null,
          createdAt: isoTime(d.createdAt),
          commit: d.githubCommitSha ?? null,
          message: d.meta?.githubCommitMessage ?? null,
        }))
      );
    } catch (error) {
      return failure(error);
    }
  }
);

server.registerTool(
  "vercel_get_deployment",
  {
    title: "Detalle de un despliegue",
    description: "Devuelve el estado, URL, inspector y metadatos (commit, rama) de un despliegue concreto a partir de su id (dpl_…).",
    inputSchema: {
      id: z.string().describe("Id del despliegue, p. ej. dpl_abc123"),
    },
  },
  async ({ id }) => {
    try {
      const d = await apiGet(
        `/v13/deployments/${encodeURIComponent(id)}`,
        {},
        [`/v12/deployments/${encodeURIComponent(id)}`, `/v11/deployments/${encodeURIComponent(id)}`]
      );
      return json({
        id: d.id,
        project: d.name,
        url: d.url ? `https://${d.url}` : null,
        environment: d.target ?? null,
        state: d.readyState ?? null,
        createdAt: isoTime(d.createdAt),
        buildingAt: isoTime(d.buildingAt),
        readyAt: isoTime(d.ready),
        inspector: d.inspectorUrl ?? null,
        commit: d.meta?.githubCommitSha ?? d.githubCommitSha ?? null,
        message: d.meta?.githubCommitMessage ?? null,
        error: d.errorMessage ?? null,
      });
    } catch (error) {
      return failure(error);
    }
  }
);

server.registerTool(
  "vercel_get_build_logs",
  {
    title: "Logs de build de un despliegue",
    description: "Devuelve el registro de construcción (build log) de un despliegue. Útil cuando el estado es ERROR para ver la causa.",
    inputSchema: {
      id: z.string().describe("Id del despliegue (dpl_…) o su URL"),
      limit: z.number().int().min(1).max(5000).optional().describe("Máximo de eventos (por defecto 500)"),
    },
  },
  async ({ id, limit }) => {
    try {
      const events = await apiGet(`/v3/deployments/${encodeURIComponent(id)}/events`, { limit: limit ?? 500 });
      const text = Array.isArray(events)
        ? events.map((e) => e.payload?.text ?? e.text ?? "").join("")
        : JSON.stringify(events, null, 2);
      return json(text.trim() || "(sin eventos de build)");
    } catch (error) {
      return failure(error);
    }
  }
);

server.registerTool(
  "vercel_logs",
  {
    title: "Logs en tiempo real de Vercel",
    description: "Consulta los logs de runtime (o de peticiones) de un proyecto con el CLI de Vercel. Soporta filtro KQL y rango temporal.",
    inputSchema: {
      project: z.string().describe("Nombre del proyecto en Vercel"),
      deployment: z.string().optional().describe("Id o URL de un despliegue concreto"),
      environment: z.enum(["production", "preview", "staging"]).optional(),
      query: z.string().optional().describe("Filtro KQL, p. ej. 'level:error AND timeout'"),
      since: z.string().optional().describe("Rango, p. ej. 2h, 30m"),
      limit: z.number().int().min(1).max(10000).optional().describe("Número de registros (por defecto 200)"),
    },
  },
  async ({ project, deployment, environment, query, since, limit }) => {
    try {
      const args = ["logs", "--project", project];
      if (deployment) args.push("--deployment", deployment);
      if (environment) args.push("--environment", environment);
      if (query) args.push("--query", query);
      if (since) args.push("--since", since);
      args.push("--limit", String(limit ?? 200));
      return json(await cliOutput(args, { timeoutMs: 120000 }));
    } catch (error) {
      return failure(error);
    }
  }
);

server.registerTool(
  "vercel_link",
  {
    title: "Vincular un directorio con un proyecto de Vercel",
    description: "Crea el enlace .vercel/link.json de un directorio con un proyecto existente. Necesario antes de desplegar desde una carpeta que todavía no está vinculada.",
    inputSchema: {
      directory: z.string().optional().describe("Carpeta del proyecto (por defecto, el directorio de trabajo)"),
      project: z.string().describe("Nombre del proyecto en Vercel"),
    },
  },
  async ({ directory, project }) => {
    try {
      const cwd = resolveDir(directory);
      return json(await cliOutput(["link", "--yes", "--project", project], { cwd, timeoutMs: 120000 }));
    } catch (error) {
      return failure(error);
    }
  }
);

server.registerTool(
  "vercel_deploy",
  {
    title: "Desplegar en Vercel",
    description:
      "Despliega un directorio en Vercel. Por defecto crea un despliegue de previsualización; usa production:true para producción. Devuelve la URL del despliegue.",
    inputSchema: {
      directory: z.string().optional().describe("Carpeta del proyecto a desplegar (por defecto, el directorio de trabajo)"),
      production: z.boolean().optional().describe("Desplegar a producción (--prod). Por defecto es previsualización"),
      noWait: z.boolean().optional().describe("No esperar a que termine el build: devuelve la URL al instante"),
      args: z.array(z.string()).optional().describe("Flags extra del CLI, p. ej. ['--regions','mad1']"),
    },
  },
  async ({ directory, production, noWait, args: extra }) => {
    try {
      const cwd = resolveDir(directory);
      const args = ["deploy", "--yes"];
      if (production) args.push("--prod");
      if (noWait) args.push("--no-wait");
      if (extra?.length) args.push(...extra);
      const output = await cliOutput(args, { cwd });
      return json(`${output}\n\n(despliegue lanzado desde ${cwd}; usa vercel_list_deployments para ver su estado)`);
    } catch (error) {
      return failure(error);
    }
  }
);

/* ------------------------------------------------------------------- main */

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(
  `mcp-vercel listo (stdio) — VERCEL_TOKEN ${process.env.VERCEL_TOKEN ? "detectado" : "NO configurado"}${
    process.env.VERCEL_TEAM_ID ? `, equipo ${process.env.VERCEL_TEAM_ID}` : ""
  }`
);