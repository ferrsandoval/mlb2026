# Datos históricos de MLB — Formato y fuentes

## Archivo esperado

`/public/history.csv`

Si el archivo **no existe**, la app sigue funcionando en modo degradado: los
ratings de ataque/defensa se derivan automáticamente del Elo semilla (ver
`src/data/seed.ts`). No es necesario tener el CSV para usar la app; solo
mejora la precisión del modelo (calibra `attack`/`defense` con datos reales
vía `estimateRatings()` en `src/engine/ratings.ts`).

---

## Formato del CSV

```
date,home,away,home_runs,away_runs,neutral,comp
2025-03-28,New York Yankees,Milwaukee Brewers,4,5,false,Regular Season
2025-03-28,Los Angeles Dodgers,San Diego Padres,7,3,false,Regular Season
```

| Columna      | Tipo    | Descripción |
|--------------|---------|-------------|
| `date`       | string  | Fecha ISO `YYYY-MM-DD` |
| `home`       | string  | Código o nombre del equipo local (ver mapeo abajo) |
| `away`       | string  | Código o nombre del equipo visitante |
| `home_runs`  | entero  | Carreras del equipo local |
| `away_runs`  | entero  | Carreras del equipo visitante |
| `neutral`    | bool    | `true` si la sede es neutral (Series en México/Japón/Londres, etc.) |
| `comp`       | string  | `Regular Season` \| `Postseason` \| `Spring Training` (puede contener comas) |

- Separador: **coma** (`,`), sin comillas.
- Encoding: UTF-8 (el loader tolera BOM).
- El béisbol no tiene empates — cada juego tiene un ganador.

---

## Fuente recomendada

**Retrosheet** (https://www.retrosheet.org) publica game logs completos de
todas las temporadas de MLB, de forma gratuita. El formato original de
Retrosheet tiene ~160 columnas; este proyecto usa un CSV simplificado con
solo las 7 columnas de arriba — deberás extraerlas del game log completo
(por ejemplo con un script corto en Python/pandas).

Los códigos de equipo de Retrosheet difieren de los usados en `seed.ts` para
algunos equipos (ej. `NYA` = Yankees, `SLN` = Cardinals). El mapeo completo
vive en `src/data/teamNameMap.ts` (`RETROSHEET_TO_ID`) y se aplica
automáticamente al parsear el CSV vía `teamKey()`.

### Alternativa: MLB Stats API

`src/engine/mlbStatsApi.ts` ya sincroniza el calendario y resultados en vivo
directamente desde `statsapi.mlb.com` (pública, sin API key) — útil para la
temporada en curso. El CSV histórico es solo para calibrar el modelo con
temporadas *anteriores* completas.

---

## Columna `comp` y ponderación

`src/engine/ratings.ts` pondera cada juego según `comp`:

| Valor de `comp`     | Peso  | Motivo |
|---------------------|-------|--------|
| `Postseason`        | 1.2   | Mayor intensidad competitiva |
| `Regular Season`     | 1.0   | Referencia base |
| `Spring Training`    | 0.2   | Rosters rotados, bajo valor predictivo |
