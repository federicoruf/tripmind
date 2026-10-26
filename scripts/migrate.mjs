// backend/scripts/migrate.mjs
// Uso: node --env-file=.env scripts/migrate.mjs <dev|prod>
//
// Ejecuta los archivos .sql de backend/script_sql/ en orden alfabético.
// Guarda los ya aplicados en la tabla schema_migrations, así que
// es seguro correrlo varias veces (no repite lo ya ejecutado).

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_DIR = path.join(__dirname, "..", "script_sql");

const target = process.argv[2];
const urls = {
  dev: process.env.DATABASE_URL_DEV,
  prod: process.env.DATABASE_URL_PROD,
};

if (!["dev", "prod"].includes(target)) {
  console.error("Uso: node scripts/migrate.mjs <dev|prod>");
  process.exit(1);
}

const connectionString = urls[target];
if (!connectionString) {
  console.error(`Falta la variable DATABASE_URL_${target.toUpperCase()}`);
  process.exit(1);
}

// Prod exige confirmación manual escribiendo "prod".
if (target === "prod") {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await rl.question(
    'Vas a modificar PRODUCCIÓN. Escribe "prod" para continuar: '
  );
  rl.close();
  if (answer.trim() !== "prod") {
    console.log("Cancelado.");
    process.exit(0);
  }
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await client.query("SELECT filename FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.filename));

  const files = (await readdir(SQL_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = await readFile(path.join(SQL_DIR, file), "utf8");
    console.log(`[${target}] Aplicando ${file}...`);

    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        [file]
      );
      await client.query("COMMIT");
      count++;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`Error en ${file}:`, err.message);
      process.exit(1);
    }
  }

  console.log(
    count === 0
      ? `[${target}] Nada nuevo que aplicar.`
      : `[${target}] ${count} migración(es) aplicada(s).`
  );
} finally {
  await client.end();
}
