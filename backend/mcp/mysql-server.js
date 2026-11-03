'use strict';

const mysql = require('mysql2/promise');

const MAX_ROWS = 1000;
const MAX_SQL_LENGTH = 10_000;
const MAX_WRITE_ROWS = 100;
const WRITE_ENABLED = process.env.MYSQL_MCP_ALLOW_WRITES === 'true';
let connectionPromise;

function getConfig() {
  const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = process.env;
  if (!MYSQL_HOST || !MYSQL_USER) {
    throw new Error('Configura MYSQL_HOST y MYSQL_USER en el cliente MCP; MYSQL_PASSWORD y MYSQL_DATABASE pueden estar vacíos.');
  }
  return {
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT || 3306),
    user: MYSQL_USER,
    password: MYSQL_PASSWORD || '',
    ...(MYSQL_DATABASE ? { database: MYSQL_DATABASE } : {}),
    multipleStatements: false,
    connectTimeout: 10_000,
    enableKeepAlive: true,
  };
}

function connection() {
  if (!connectionPromise) connectionPromise = mysql.createConnection(getConfig());
  return connectionPromise;
}

function identifier(value, label) {
  if (typeof value !== 'string' || !/^[\p{L}\p{N}_$-]+$/u.test(value)) {
    throw new Error(`${label} no es un identificador válido.`);
  }
  return `\`${value.replace(/`/g, '``')}\``;
}

function validateReadQuery(sql) {
  if (typeof sql !== 'string' || !sql.trim() || sql.length > MAX_SQL_LENGTH) {
    throw new Error(`sql debe ser una consulta de hasta ${MAX_SQL_LENGTH} caracteres.`);
  }
  const statement = sql.trim().replace(/;\s*$/, '');
  if (statement.includes(';')) throw new Error('Solo se permite una consulta por llamada.');
  const withoutLeadingComments = statement
    .replace(/^(?:\s|\/\*[\s\S]*?\*\/|--[^\n]*(?:\n|$)|#[^\n]*(?:\n|$))+/g, '')
    .trim();
  if (!/^(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN)\b/i.test(withoutLeadingComments)) {
    throw new Error('Solo se permiten consultas SELECT, SHOW, DESCRIBE, DESC y EXPLAIN.');
  }
  if (/\bINTO\s+(?:OUTFILE|DUMPFILE)\b|\bFOR\s+UPDATE\b|\bLOCK\s+IN\s+SHARE\s+MODE\b/i.test(withoutLeadingComments)) {
    throw new Error('La consulta intenta escribir, bloquear filas o crear un archivo y no está permitida.');
  }
  return statement;
}

const tools = [
  {
    name: 'mysql_list_databases',
    description: 'Lista las bases de datos a las que el usuario MySQL tiene acceso.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'mysql_list_tables',
    description: 'Lista las tablas y vistas de una base de datos; sin database usa MYSQL_DATABASE.',
    inputSchema: {
      type: 'object',
      properties: { database: { type: 'string', description: 'Nombre de la base de datos (opcional).' } },
      additionalProperties: false,
    },
  },
  {
    name: 'mysql_describe_table',
    description: 'Describe las columnas de una tabla o vista.',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Nombre de la tabla.' },
        database: { type: 'string', description: 'Nombre de la base de datos (opcional).' },
      },
      required: ['table'],
      additionalProperties: false,
    },
  },
  {
    name: 'mysql_read_query',
    description: 'Ejecuta una única consulta SQL de solo lectura. Acepta placeholders ? y valores en params.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'Una consulta SELECT, SHOW, DESCRIBE, DESC o EXPLAIN.' },
        params: { type: 'array', description: 'Valores para los placeholders ? (opcional).' },
      },
      required: ['sql'],
      additionalProperties: false,
    },
  },
  {
    name: 'mysql_write_query',
    description: 'Ejecuta una sentencia INSERT, UPDATE o DELETE parametrizada en una transacción, con un máximo de 100 filas afectadas. Requiere MYSQL_MCP_ALLOW_WRITES=true y permisos MySQL de escritura.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'Una única sentencia INSERT, UPDATE o DELETE, nunca DDL.' },
        params: { type: 'array', description: 'Valores para placeholders ?.' },
        confirm: { type: 'boolean', description: 'Debe ser true para confirmar la modificación.' },
        reason: { type: 'string', description: 'Breve explicación del cambio solicitado.' },
      },
      required: ['sql', 'confirm'],
      additionalProperties: false,
    },
  },
];

function selectedDatabase(database) {
  const name = database || process.env.MYSQL_DATABASE;
  if (!name) throw new Error('Indica database o configura MYSQL_DATABASE en el cliente MCP.');
  return name;
}

async function callTool(name, args = {}) {
  const db = await connection();
  let rows;
  switch (name) {
    case 'mysql_list_databases':
      [rows] = await db.query('SHOW DATABASES');
      break;
    case 'mysql_list_tables': {
      const schema = selectedDatabase(args.database);
      [rows] = await db.execute(
        'SELECT TABLE_NAME AS name, TABLE_TYPE AS type FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME',
        [schema],
      );
      break;
    }
    case 'mysql_describe_table': {
      const schema = selectedDatabase(args.database);
      const table = identifier(args.table, 'table');
      const database = identifier(schema, 'database');
      [rows] = await db.query(`SHOW COLUMNS FROM ${database}.${table}`);
      break;
    }
    case 'mysql_read_query': {
      const sql = validateReadQuery(args.sql);
      const params = args.params === undefined ? [] : args.params;
      if (!Array.isArray(params)) throw new Error('params debe ser un array JSON.');
      if (/^\s*SELECT\b/i.test(sql.replace(/^(?:\s|\/\*[\s\S]*?\*\/|--[^\n]*(?:\n|$)|#[^\n]*(?:\n|$))+/g, ''))) {
        [rows] = await db.query(
          `SELECT * FROM (${sql}) AS mcp_read_only_result LIMIT ${MAX_ROWS + 1}`,
          params,
        );
        if (rows.length > MAX_ROWS) rows = rows.slice(0, MAX_ROWS);
      } else {
        [rows] = await db.query(sql, params);
        if (Array.isArray(rows) && rows.length > MAX_ROWS) rows = rows.slice(0, MAX_ROWS);
      }
      break;
    }
    case 'mysql_write_query': {
      if (!WRITE_ENABLED) throw new Error('Las modificaciones están desactivadas. Configura MYSQL_MCP_ALLOW_WRITES=true y reinicia VS Code.');
      if (!process.env.MYSQL_PASSWORD) throw new Error('Configura MYSQL_PASSWORD en VS Code para habilitar operaciones de escritura.');
      if (args.confirm !== true) throw new Error('Confirma esta modificación enviando confirm=true.');
      if (typeof args.sql !== 'string' || !args.sql.trim() || args.sql.length > MAX_SQL_LENGTH) {
        throw new Error(`sql debe ser una sentencia de hasta ${MAX_SQL_LENGTH} caracteres.`);
      }
      const statement = args.sql.trim();
      if (statement.endsWith(';') || statement.includes(';')) throw new Error('Solo se permite una sentencia sin punto y coma.');
      const normalized = statement;
      if (normalized.includes('/*') || normalized.includes('*/') || normalized.includes('--') || normalized.includes('#')) {
        throw new Error('No se permiten comentarios SQL en sentencias de escritura.');
      }
      const writeKind = normalized.match(/^(INSERT|UPDATE|DELETE)\b/i)?.[1].toUpperCase();
      if (!writeKind) throw new Error('Solo se permiten INSERT, UPDATE o DELETE; no se permiten DDL ni control de transacciones.');
      if ((writeKind === 'UPDATE' || writeKind === 'DELETE') && !/\bWHERE\b/i.test(normalized)) {
        throw new Error('UPDATE y DELETE requieren una cláusula WHERE.');
      }
      if (/\b(?:RETURNING|INTO\s+OUTFILE|INTO\s+DUMPFILE)\b/i.test(normalized)) {
        throw new Error('La sentencia incluye una cláusula no permitida.');
      }
      const params = args.params === undefined ? [] : args.params;
      if (!Array.isArray(params)) throw new Error('params debe ser un array JSON.');
      await db.beginTransaction();
      try {
        const [result] = await db.execute(statement, params);
        if (result.affectedRows > MAX_WRITE_ROWS) {
          await db.rollback();
          throw new Error(`La operación afectaría ${result.affectedRows} filas; el máximo permitido es ${MAX_WRITE_ROWS}. No se aplicaron cambios.`);
        }
        await db.commit();
        rows = { affectedRows: result.affectedRows, insertId: result.insertId || null, warningStatus: result.warningStatus };
      } catch (error) {
        try { await db.rollback(); } catch { /* Preserve the original database error. */ }
        throw error;
      }
      break;
    }
    default:
      throw new Error(`Herramienta desconocida: ${name}`);
  }
  return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handle(message) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return;
  const { id, method, params } = message;
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return;
  if (method === 'initialize') {
    return send({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {    name: 'mysql-database-mcp', version: '1.0.0' },
      },
    });
  }
  if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
  if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools } });
  if (method === 'tools/call') {
    try {
      const result = await callTool(params?.name, params?.arguments || {});
      return send({ jsonrpc: '2.0', id, result });
    } catch (error) {
      return send({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: error.message }], isError: true },
      });
    }
  }
  if (id !== undefined) {
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Método no soportado: ${method}` } });
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
  let newline;
  while ((newline = input.indexOf('\n')) !== -1) {
    const line = input.slice(0, newline).trim();
    input = input.slice(newline + 1);
    if (!line) continue;
    try {
      void handle(JSON.parse(line)).catch((error) => {
        process.stderr.write(`MCP error: ${error.message}\n`);
      });
    } catch (error) {
      process.stderr.write(`Invalid JSON-RPC message: ${error.message}\n`);
    }
  }
});
process.stdin.on('end', async () => {
  if (connectionPromise) {
    try { await (await connectionPromise).end(); } catch { /* Connection may not have completed. */ }
  }
});
