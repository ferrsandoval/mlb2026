// =============================================================================
// seed.ts — Datos semilla de la MLB 2026 (30 equipos, 6 divisiones)
// -----------------------------------------------------------------------------
// Alineación de ligas/divisiones: la actual desde el realineamiento de 2013
// (Astros a la Liga Americana), estable y no sujeta a cambios de temporada.
//
// ELO / ATTACK / DEFENSE: estimaciones iniciales razonables (punto de partida),
// no un ranking oficial. AJÚSTALAS a tu criterio en Ajustes; el modelo recalcula
// el Elo automáticamente conforme registres resultados reales.
//   attack  > 1.0 → anota más carreras de lo esperado por su Elo
//   defense < 1.0 → concede menos carreras (mejor pitcheo/defensa)
// =============================================================================

export type League = 'AL' | 'NL'
export type Division = 'East' | 'Central' | 'West'

export interface Team {
  id: string;          // código de 3 letras (p.ej. "NYY")
  name: string;         // nombre completo
  league: League;
  division: Division;
  elo: number;          // rating inicial (tunable)
  attack: number;       // fuerza ofensiva relativa a carreras/juego liga (default 1.0)
  defense: number;      // factor defensivo — menor = mejor (default 1.0)
  primaryColor: string; // hex, para TeamBadge
  secondaryColor: string;
  venue: string;        // estadio local
  city: string;
}

export interface Game {
  id: string;           // "G1".."G2430"
  date: string;          // YYYY-MM-DD
  homeId: string;
  awayId: string;
  stage: 'regular';
  played?: boolean;
  homeRuns?: number;
  awayRuns?: number;
  homePitcherId?: string; // abridor probable local (id de la MLB Stats API, como string)
  awayPitcherId?: string; // abridor probable visitante
}

// -----------------------------------------------------------------------------
// Estimación de ataque/defensa a partir del Elo semilla (simplificación:
// evita tener que calibrar 60 números a mano para 30 equipos; el usuario puede
// re-ajustar cada valor individualmente después en la pantalla de Ajustes).
// -----------------------------------------------------------------------------
function deriveOffenseDefense(elo: number): { attack: number; defense: number } {
  const d = (elo - 1500) / 1000
  return {
    attack: Math.round((1 + d) * 100) / 100,
    defense: Math.round((1 - d * 0.9) * 100) / 100,
  }
}

interface TeamSeedInput {
  id: string; name: string; league: League; division: Division; elo: number
  primaryColor: string; secondaryColor: string; venue: string; city: string
}

const TEAM_INPUTS: TeamSeedInput[] = [
  // ── AL East ──
  { id: 'NYY', name: 'New York Yankees',    league: 'AL', division: 'East', elo: 1560, primaryColor: '#0C2340', secondaryColor: '#C4CED4', venue: 'Yankee Stadium',         city: 'Nueva York' },
  { id: 'BOS', name: 'Boston Red Sox',      league: 'AL', division: 'East', elo: 1520, primaryColor: '#BD3039', secondaryColor: '#0C2340', venue: 'Fenway Park',            city: 'Boston' },
  { id: 'TOR', name: 'Toronto Blue Jays',   league: 'AL', division: 'East', elo: 1530, primaryColor: '#134A8E', secondaryColor: '#1D2D5C', venue: 'Rogers Centre',          city: 'Toronto' },
  { id: 'BAL', name: 'Baltimore Orioles',   league: 'AL', division: 'East', elo: 1510, primaryColor: '#DF4601', secondaryColor: '#000000', venue: 'Oriole Park at Camden Yards', city: 'Baltimore' },
  { id: 'TB',  name: 'Tampa Bay Rays',      league: 'AL', division: 'East', elo: 1500, primaryColor: '#092C5C', secondaryColor: '#8FBCE6', venue: 'Steinbrenner Field',     city: 'Tampa' },

  // ── AL Central ──
  { id: 'CLE', name: 'Cleveland Guardians', league: 'AL', division: 'Central', elo: 1520, primaryColor: '#00385D', secondaryColor: '#E50022', venue: 'Progressive Field',   city: 'Cleveland' },
  { id: 'MIN', name: 'Minnesota Twins',     league: 'AL', division: 'Central', elo: 1500, primaryColor: '#002B5C', secondaryColor: '#D31145', venue: 'Target Field',        city: 'Minneapolis' },
  { id: 'DET', name: 'Detroit Tigers',      league: 'AL', division: 'Central', elo: 1515, primaryColor: '#0C2340', secondaryColor: '#FA4616', venue: 'Comerica Park',       city: 'Detroit' },
  { id: 'CWS', name: 'Chicago White Sox',   league: 'AL', division: 'Central', elo: 1420, primaryColor: '#27251F', secondaryColor: '#C4CED4', venue: 'Rate Field',          city: 'Chicago' },
  { id: 'KC',  name: 'Kansas City Royals',  league: 'AL', division: 'Central', elo: 1495, primaryColor: '#004687', secondaryColor: '#BD9B60', venue: 'Kauffman Stadium',    city: 'Kansas City' },

  // ── AL West ──
  { id: 'HOU', name: 'Houston Astros',      league: 'AL', division: 'West', elo: 1535, primaryColor: '#002D62', secondaryColor: '#EB6E1F', venue: 'Daikin Park',          city: 'Houston' },
  { id: 'SEA', name: 'Seattle Mariners',    league: 'AL', division: 'West', elo: 1525, primaryColor: '#0C2C56', secondaryColor: '#005C5C', venue: 'T-Mobile Park',        city: 'Seattle' },
  { id: 'TEX', name: 'Texas Rangers',       league: 'AL', division: 'West', elo: 1500, primaryColor: '#003278', secondaryColor: '#C0111F', venue: 'Globe Life Field',     city: 'Arlington' },
  { id: 'LAA', name: 'Los Angeles Angels',  league: 'AL', division: 'West', elo: 1480, primaryColor: '#BA0021', secondaryColor: '#003263', venue: 'Angel Stadium',        city: 'Anaheim' },
  { id: 'ATH', name: 'Athletics',           league: 'AL', division: 'West', elo: 1440, primaryColor: '#003831', secondaryColor: '#EFB21E', venue: 'Sutter Health Park',   city: 'Sacramento' },

  // ── NL East ──
  { id: 'ATL', name: 'Atlanta Braves',      league: 'NL', division: 'East', elo: 1540, primaryColor: '#CE1141', secondaryColor: '#13274F', venue: 'Truist Park',          city: 'Atlanta' },
  { id: 'NYM', name: 'New York Mets',       league: 'NL', division: 'East', elo: 1530, primaryColor: '#002D72', secondaryColor: '#FF5910', venue: 'Citi Field',           city: 'Nueva York' },
  { id: 'PHI', name: 'Philadelphia Phillies', league: 'NL', division: 'East', elo: 1545, primaryColor: '#E81828', secondaryColor: '#002D72', venue: 'Citizens Bank Park', city: 'Filadelfia' },
  { id: 'MIA', name: 'Miami Marlins',       league: 'NL', division: 'East', elo: 1460, primaryColor: '#00A3E0', secondaryColor: '#EF3340', venue: 'loanDepot Park',       city: 'Miami' },
  { id: 'WSH', name: 'Washington Nationals', league: 'NL', division: 'East', elo: 1470, primaryColor: '#AB0003', secondaryColor: '#14225A', venue: 'Nationals Park',      city: 'Washington D.C.' },

  // ── NL Central ──
  { id: 'MIL', name: 'Milwaukee Brewers',   league: 'NL', division: 'Central', elo: 1515, primaryColor: '#12284B', secondaryColor: '#FFC52F', venue: 'American Family Field', city: 'Milwaukee' },
  { id: 'CHC', name: 'Chicago Cubs',        league: 'NL', division: 'Central', elo: 1520, primaryColor: '#0E3386', secondaryColor: '#CC3433', venue: 'Wrigley Field',       city: 'Chicago' },
  { id: 'STL', name: 'St. Louis Cardinals', league: 'NL', division: 'Central', elo: 1490, primaryColor: '#C41E3A', secondaryColor: '#0C2340', venue: 'Busch Stadium',       city: 'San Luis' },
  { id: 'CIN', name: 'Cincinnati Reds',     league: 'NL', division: 'Central', elo: 1500, primaryColor: '#C6011F', secondaryColor: '#000000', venue: 'Great American Ball Park', city: 'Cincinnati' },
  { id: 'PIT', name: 'Pittsburgh Pirates',  league: 'NL', division: 'Central', elo: 1460, primaryColor: '#27251F', secondaryColor: '#FDB827', venue: 'PNC Park',            city: 'Pittsburgh' },

  // ── NL West ──
  { id: 'LAD', name: 'Los Angeles Dodgers', league: 'NL', division: 'West', elo: 1585, primaryColor: '#005A9C', secondaryColor: '#EF3E42', venue: 'Dodger Stadium',       city: 'Los Ángeles' },
  { id: 'SD',  name: 'San Diego Padres',    league: 'NL', division: 'West', elo: 1530, primaryColor: '#2F241D', secondaryColor: '#FFC425', venue: 'Petco Park',           city: 'San Diego' },
  { id: 'SF',  name: 'San Francisco Giants', league: 'NL', division: 'West', elo: 1505, primaryColor: '#FD5A1E', secondaryColor: '#27251F', venue: 'Oracle Park',         city: 'San Francisco' },
  { id: 'ARI', name: 'Arizona Diamondbacks', league: 'NL', division: 'West', elo: 1510, primaryColor: '#A71930', secondaryColor: '#E3D4AD', venue: 'Chase Field',         city: 'Phoenix' },
  { id: 'COL', name: 'Colorado Rockies',    league: 'NL', division: 'West', elo: 1440, primaryColor: '#333366', secondaryColor: '#C4CED4', venue: 'Coors Field',         city: 'Denver' },
]

export const TEAMS: Team[] = TEAM_INPUTS.map((t) => ({
  ...t,
  ...deriveOffenseDefense(t.elo),
}))

export const teamById = (id: string): Team | undefined => TEAMS.find((t) => t.id === id)

// -----------------------------------------------------------------------------
// Divisiones (derivado de TEAMS, por conveniencia)
// -----------------------------------------------------------------------------
export type DivisionKey = `${League}-${Division}`

export const divisionKey = (t: Pick<Team, 'league' | 'division'>): DivisionKey =>
  `${t.league}-${t.division}`

export const DIVISIONS: Record<DivisionKey, string[]> = TEAMS.reduce((acc, t) => {
  const k = divisionKey(t)
  ;(acc[k] ||= []).push(t.id)
  return acc
}, {} as Record<DivisionKey, string[]>)

export const ALL_DIVISION_KEYS: DivisionKey[] = [
  'AL-East', 'AL-Central', 'AL-West', 'NL-East', 'NL-Central', 'NL-West',
]

export const DIVISION_LABELS: Record<DivisionKey, string> = {
  'AL-East': 'AL Este', 'AL-Central': 'AL Central', 'AL-West': 'AL Oeste',
  'NL-East': 'NL Este', 'NL-Central': 'NL Central', 'NL-West': 'NL Oeste',
}

// -----------------------------------------------------------------------------
// Ventana de temporada regular 2026
// -----------------------------------------------------------------------------
export const SEASON_START = '2026-03-26'
export const SEASON_END   = '2026-09-27'
