const fs = require('fs');
const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
  });
  const [tables] = await conn.query('SHOW TABLES');
  console.log('TABLAS:', JSON.stringify(tables));
  const sql = fs.readFileSync(process.argv[2], 'utf8');
  const stmts = sql.split(/;\s*(?:\r?\n|$)/).map(s => s.trim()).filter(s => s && !s.startsWith('--'));
  for (let i = 0; i < stmts.length; i++) {
    try {
      await conn.query(stmts[i]);
    } catch (e) {
      console.log('--- FALLO stmt', i, ':', stmts[i].slice(0, 150).replace(/\n/g, ' '), '| ERROR:', e.code, e.message);
    }
  }
  await conn.end();
  console.log('fin');
})().catch(e => { console.error('CONN:', e.message); process.exit(1); });
