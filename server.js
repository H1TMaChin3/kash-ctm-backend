const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ALLOWED_ORIGINS = [
  'https://kash-martinique.com',
  'https://www.kash-martinique.com',
  'https://kash-ktk.netlify.app',
  'https://kash-ctm.netlify.app',
  'https://kash-martinique.netlify.app',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'null'
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS bloqué : origine non autorisée — ' + origin));
  }
}));

app.use(express.json({ limit: '20kb' }));

// ── Systèmes KASH CTM ──────────────────────────────────────────────
const SYSTEMS = {
  veille: `Tu es KASH, expert en veille foncière et immobilière Martinique 2026.
Les 13 biens CTM mis en vente :
• Immeuble Saint Cyr — 80 400€, 330m², 3 niveaux, Fort-de-France
• Immeuble SCI La Savane — 132 000€, 170m², 4 niveaux, Fort-de-France
• Immeuble Dunlopillo — 193 800€, 470m², 2 niveaux, Fort-de-France
• Villa Fleur de Jade — Fort-de-France (prix NC)
• Villa Nicole — Fort-de-France (prix NC)
• Villa Côte de Grâce — Fort-de-France (prix NC)
• Terrain Pointe des Nègres — 36 036€, 273m², Fort-de-France
• Terrain Dervain — Fort-de-France (prix NC)
• Terrains Dillon — 660 000€, 3 201m², Fort-de-France
• Ex écoles IUFM — Route du Phare, Fort-de-France (prix NC)
• Ex villa Directeur AFPA — Schoelcher (prix NC)
• Ex Fermier des Antilles — François (prix NC)
• Immeuble Aqualand — 2 624 400€, Le Carbet
Critères CTM : 70% prix proposé / 30% qualité du projet. Anti-spéculation 5 ans. Deadline 24 juillet 2026 12h00.
TVA DOM 8,5%. DMTO Martinique 5,09%. Tu connais les zones PLU, PPR, loi littoral Martinique.
Réponds en français. Sois précis et actionnable pour un investisseur caribéen professionnel.`,

  bilan: `Tu es KASH, spécialiste du bilan promoteur immobilier dans les DOM-TOM, expert Martinique.
Tu maîtrises : charge foncière, TVA 8,5% DOM, DMTO 5,09%, coût construction moyen 1 159€ HT/m², charge foncière ~430€/m², GFA, VEFA, TRI, VAN, cashflow, financement promoteur.
Contexte CTM 2026 : 13 biens en cession amiable, deadline 24 juillet.
Réponds avec chiffres précis, tableaux structurés si pertinent, en français.`,

  sci: `Tu es KASH, expert des montages juridiques immobiliers pour investisseurs caribéens et entrepreneurs antillais.
Tu maîtrises : SCI IS/IR, SCCV, SPV, bail emphytéotique, démembrement, pacte d'associés, droit des sociétés français, fiscalité DOM-TOM.
Contexte CTM 2026 : clause anti-spéculation 5 ans imposée par la CTM. KANTEKANT Group SAS SIREN 104 108 493, Lamentin, Martinique.
Réponds avec avantages/risques précis selon le contexte martiniquais, en français.`,

  fisc: `Tu es KASH, expert de la fiscalité immobilière dans les DOM-TOM, spécialisé Martinique.
Tu maîtrises :
- Pinel Outre-Mer : 20% (6 ans) ou 23% (9 ans) vs 12/14% métropole
- Girardin logement social : 50-60% réduction IS, agrément LLS
- TVA 8,5% DOM sur constructions et travaux
- Déficit foncier : 10 700€/an plafond DOM
- DMTO Martinique : 5,09%
- Plus-values immobilières : abattement pour durée de détention
- Optimisation SCI IR vs IS
Contexte CTM 2026. Tu calcules des simulations précises avec chiffres réels, en français.`,

  process: `Tu es KASH, expert du processus de candidature CTM Martinique 2026.
Tu connais la procédure complète de cession amiable :
- Dossier téléchargeable sur collectiviteterritorialedemartinique.achatpublic.com
- Critères de sélection : 70% prix proposé / 30% qualité du projet
- Deadline dépôt des offres : 24 juillet 2026 à 12h00
- Demandes de visite : avant le 10 juillet 2026
- Clause anti-spéculation : 5 ans à compter de l'acte authentique
Tu connais : PC Martinique (2-3 mois instruction + 2 mois purge de recours), normes sismiques PS92, règles Alizés/cyclones, loi littoral Martinique, zones PPR.
Tu guides l'investisseur étape par étape, en français, avec checklist opérationnelle.`
};

const VALID_MODULES = Object.keys(SYSTEMS);

// ── Route principale ────────────────────────────────────────────────
app.post('/api/kash', async (req, res) => {
  const { module, messages } = req.body;

  if (!module || !VALID_MODULES.includes(module)) {
    return res.status(400).json({ error: 'Module invalide. Valeurs acceptées : ' + VALID_MODULES.join(', ') });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages requis (tableau non vide).' });
  }
  if (messages.length > 40) {
    return res.status(400).json({ error: 'Historique trop long (max 40 messages).' });
  }

  const sanitized = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content).slice(0, 4000)
  }));

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEMS[module],
      messages: sanitized
    });

    const text = response.content?.[0]?.text || '';
    res.json({ text, module, tokens: response.usage });

  } catch (err) {
    console.error('[KASH API error]', err.message);
    res.status(500).json({ error: 'Erreur API Anthropic : ' + err.message });
  }
});

// ── Health check ────────────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'KASH CTM Backend',
    version: '1.0.0',
    modules: VALID_MODULES,
    deadline: '2026-07-24T12:00:00'
  });
});

app.get('/', (_, res) => {
  res.json({ service: 'KASH CTM — KANTEKANT Group', status: 'running' });
});

app.listen(PORT, () => {
  console.log(`KASH Backend actif sur le port ${PORT}`);
  console.log(`Modules disponibles : ${VALID_MODULES.join(', ')}`);
});
