const express = require("express");
const os = require("os");
const { Pool } = require("pg");

const PORT = process.env.PORT || 3000;

// Toute la configuration de la base vient des variables d'environnement :
// rien n'est codé en dur dans l'image.
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Si PostgreSQL redémarre, les connexions inactives du pool sont coupées.
// Sans ce gestionnaire, l'erreur ferait planter tout le processus Node.
pool.on("error", (err) => {
  console.error("Connexion PostgreSQL perdue :", err.message);
});

// Passe à true quand la table messages est créée (voir initDb).
let dbPrete = false;

const app = express();
app.use(express.json());

// Route 1 : réponse simple de l'API, sans base de données.
app.get("/api1", (req, res) => {
  res.json({
    route: "/api1",
    message: "Bonjour depuis le backend Express !",
    conteneur: os.hostname(),
    date: new Date().toISOString(),
  });
});

// Les routes /api2 répondent 503 tant que la base n'est pas initialisée.
app.use("/api2", (req, res, next) => {
  if (!dbPrete) {
    return res.status(503).json({ erreur: "Base de données pas encore disponible" });
  }
  next();
});

// Route 2 : lecture des messages stockés dans PostgreSQL.
app.get("/api2", async (req, res) => {
  try {
    const version = await pool.query("SELECT version()");
    const messages = await pool.query(
      "SELECT id, texte, cree_le FROM messages ORDER BY id"
    );
    res.json({
      route: "/api2",
      base: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
      postgres: version.rows[0].version,
      messages: messages.rows,
    });
  } catch (err) {
    console.error("Erreur PostgreSQL :", err.message);
    res.status(500).json({ erreur: err.message });
  }
});

// Route 2 : ajout d'un message en base (test de persistance).
app.post("/api2", async (req, res) => {
  const texte = (req.body && req.body.texte || "").trim();
  if (!texte) {
    return res.status(400).json({ erreur: "Le champ 'texte' est obligatoire" });
  }
  try {
    const result = await pool.query(
      "INSERT INTO messages (texte) VALUES ($1) RETURNING id, texte, cree_le",
      [texte]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Erreur PostgreSQL :", err.message);
    res.status(500).json({ erreur: err.message });
  }
});

// Utilisée par le healthcheck Docker du backend.
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Crée la table au démarrage. On réessaie tant que PostgreSQL n'est pas
// joignable, sans bloquer l'API : /api1 fonctionne même sans base.

async function initDb() {
  for (let i = 1; ; i++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          texte TEXT NOT NULL,
          cree_le TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      dbPrete = true;
      console.log(`Connecté à PostgreSQL sur ${process.env.DB_HOST}:${process.env.DB_PORT}`);
      return;
    } catch (err) {
      console.error(`PostgreSQL indisponible (tentative ${i}) : ${err.message || err.code}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

// 0.0.0.0 : écoute sur toutes les interfaces du conteneur,
// sinon les autres conteneurs (Nginx) ne pourraient pas le joindre.
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend en écoute sur 0.0.0.0:${PORT}`);
});

// docker stop envoie SIGTERM, Ctrl+C envoie SIGINT. Node lancé en PID 1
// ne s'arrête pas tout seul : sans ces gestionnaires, docker stop attend
// 10 s puis le tue (SIGKILL, code 137) et Ctrl+C est ignoré.
function arreter(signal) {
  console.log(`${signal} reçu, arrêt propre`);
  server.close(() => pool.end().finally(() => process.exit(0)));
}
process.on("SIGTERM", arreter);
process.on("SIGINT", arreter);

initDb();
