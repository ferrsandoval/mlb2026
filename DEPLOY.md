# Despliegue en SiteGround

Esta app es un sitio **estático** (Vite + React). Se compila a la carpeta `dist/`
y esa carpeta se sube al hosting. No necesita Node.js ni base de datos en el
servidor: los datos vienen en vivo de la MLB Stats API desde el navegador.

## 1. Compilar (en tu computadora)

```bash
npm install     # solo la primera vez
npm run build
```

Esto genera la carpeta **`dist/`** con `index.html`, la carpeta `assets/` y el
`.htaccess`. Todo lo que hay dentro de `dist/` es lo que se sube.

## 2. Subir a SiteGround

Elige **una** de estas opciones:

### Opción A — File Manager (la más simple)
1. Site Tools → **Sitio → File Manager**.
2. Entra a `public_html` (o a la subcarpeta del dominio/subdominio).
3. Sube **todo el contenido de `dist/`** (no la carpeta `dist` en sí, sino lo de
   adentro: `index.html`, `assets/`, `.htaccess`). Asegúrate de que se suba
   también el archivo oculto `.htaccess`.

### Opción B — FTP
1. Site Tools → **Sitio → FTP Accounts**, crea una cuenta.
2. Con FileZilla, sube el contenido de `dist/` a `public_html`.

### Opción C — Git (Site Tools)
SiteGround puede clonar el repo, pero **no compila** en shared hosting. Si usas
Git, hay que **incluir `dist/` en el repositorio** (ver nota abajo) y apuntar la
raíz del sitio a `dist/`. Para la mayoría de los casos, la Opción A es más simple.

## 3. Listo
Abre tu dominio. La app carga y se autosincroniza con la MLB Stats API
(calendario, abridores, bullpen) sin tocar botones.

---

## Notas
- **Rutas relativas**: `vite.config.ts` usa `base: './'`, así que funciona tanto
  en la raíz del dominio como en un subdirectorio.
- **`.htaccess`**: se genera dentro de `dist/` (viene de `public/.htaccess`) y
  configura compresión, caché y el fallback a `index.html`.
- **Actualizar el sitio**: repite el paso 1 y vuelve a subir `dist/`
  (reemplazando los archivos). El `index.html` no se cachea, así que los cambios
  se ven al recargar.
- **HTTPS**: el sitio hace `fetch` a `https://statsapi.mlb.com`. Sirve tu dominio
  por **HTTPS** (SiteGround da certificado Let's Encrypt gratis) para evitar
  bloqueos de contenido mixto.
- **history.csv (opcional)**: si quieres calibrar los ratings con datos
  históricos, sube tu `history.csv` a la raíz junto a `index.html` (ver
  `HISTORY_DATA.md`).
