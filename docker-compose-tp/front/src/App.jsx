import { useEffect, useState } from "react";

// Les URLs sont relatives : le navigateur appelle Nginx (localhost:80),
// qui transmet /api1 et /api2 au backend.
async function getJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.erreur || `HTTP ${res.status}`);
  return data;
}

export default function App() {
  const [api1, setApi1] = useState(null);
  const [api2, setApi2] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [texte, setTexte] = useState("");

  const charger = () => {
    setErreur(null);
    getJson("/api1").then(setApi1).catch((e) => setErreur(`/api1 : ${e.message}`));
    getJson("/api2").then(setApi2).catch((e) => setErreur(`/api2 : ${e.message}`));
  };

  useEffect(charger, []);

  const ajouter = async (e) => {
    e.preventDefault();
    if (!texte.trim()) return;
    try {
      await getJson("/api2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texte }),
      });
      setTexte("");
      charger();
    } catch (err) {
      setErreur(`/api2 : ${err.message}`);
    }
  };

  return (
    <main>
      <h1>TP Docker Compose</h1>
      <p className="sous-titre">
        Frontend React → Nginx → Backend Express → PostgreSQL
      </p>

      {erreur && <p className="erreur">{erreur}</p>}

      <section>
        <h2>/api1</h2>
        <pre>{api1 ? JSON.stringify(api1, null, 2) : "Chargement…"}</pre>
      </section>

      <section>
        <h2>/api2</h2>
        {api2 ? (
          <>
            <p>
              Base : <code>{api2.base}</code>
            </p>
            <p className="petit">{api2.postgres}</p>
            <h3>Messages en base ({api2.messages.length})</h3>
            <ul>
              {api2.messages.map((m) => (
                <li key={m.id}>
                  <strong>#{m.id}</strong> {m.texte}{" "}
                  <span className="petit">
                    {new Date(m.cree_le).toLocaleString("fr-FR")}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>Chargement…</p>
        )}
        <form onSubmit={ajouter}>
          <input
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="Nouveau message"
          />
          <button type="submit">Ajouter</button>
          <button type="button" onClick={charger}>
            Rafraîchir
          </button>
        </form>
      </section>
    </main>
  );
}
