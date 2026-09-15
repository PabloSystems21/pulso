# Pulso · Evaluación de residentes de Anestesiología

Prototipo *mobile-first* (React + Vite + TypeScript, sin backend) de la propuesta de evaluación digital:

- **Registro por caso** del residente en ~1 minuto: flujo conversacional ("¿Lo lograste? → ¿Al primer intento? → ¿En cuál?").
- **Evaluación del adscrito** en ~2 minutos (versión corta) o ~6 minutos (versión completa):
  - **O-SCORE**: supervisión que requirió + prospectiva/entrustment.
  - **ANTS**: habilidades no técnicas.
  - **Mini-CEX**: juicio clínico.
  - **Desempeño global** y **profesionalismo** (solo versión completa).
  - **Retroalimentación obligatoria** y **cierre**.
- **CUSUM automática** por residente y procedimiento: líneas de decisión, competencia alcanzada, alertas por caída de desempeño y periodos sin exposición.
- **Tableros**:
  - Progreso longitudinal con la banda esperada según el grado (R1/R2/R3).
  - Portafolio por residente.
  - Reporte mensual o trimestral por grado.

En computadora se ve con el mismo layout de celular (marco centrado).

---

## Correrlo en tu compu

```bash
cd "C:\Users\Pablo R\React\pulso"
npm install        # solo la primera vez
npm run dev        # abre http://localhost:5173 (si está ocupado, Vite usa otro puerto)
```

Para probar en tu celular en la misma red Wi-Fi, usa la URL "Network" que imprime `npm run dev`.

---

## Guion del demo (happy path, ~5 minutos)

1. Entra como **Pablo Rodríguez (R1)** y toca **"Regístralo en 1 minuto"**.
2. Llena la identificación: quirófano Q3, **Dr. Felipe González** → Siguiente.
3. Llena la cirugía: Cirugía general → Colecistectomía laparoscópica → Electivo → ASA 2 → Siguiente.
4. Llena el contexto: General · Media · Obesidad → Siguiente.
5. Toca **"Agregar procedimiento"** y responde: Intubación → ¿Primer operador? Sí → ¿Lo lograste? Sí → ¿Al primer intento? **No** → ¿En cuál? **2º** → 5–10 min → Solo verbal → Sin incidentes → Seguridad Sí.
   - La app te dice si cuenta como éxito o falla para la CUSUM.
6. Enviar → pantalla de éxito ("Lo registraste en 0:45 min").
7. Toca **"Entrar como Dr. Felipe González"** y se abre directo la evaluación. Recorre:
   - Supervisión → prospectiva → juicio clínico → ANTS → retroalimentación (con frases rápidas) → cierre.
   - Al terminar: "Completada en 1:40 min", y las curvas se actualizan.
8. Toca **"Entrar como Pablo Rodríguez"** para ver la retroalimentación que recibe el residente.
   - Luego ve a **Progreso**: O-SCORE vs. lo esperado para R1, ANTS y CUSUM por procedimiento (intubación: competencia en el intento #33).
9. **El peor caso:** como Felipe, abre **Residentes → Daniela Cruz**.
   - Tiene una alerta de *caída de desempeño en neuroaxial* (6 de 6 como falla, la CUSUM cruzó el límite inaceptable) y seguimientos activos.
   - En **Reportes** está el consolidado mensual y trimestral por grado.

**Links directos** para mandar por WhatsApp:

- `https://TU-SITIO/?as=fgonzalez` entra como Felipe.
- `https://TU-SITIO/?as=prodriguez` entra como Pablo.

> Importante: no hay backend. Lo que captures se guarda **en el navegador de ese celular** (localStorage).
> Si tu hermano abre el link en su teléfono, verá el historial simulado, pero **no** los casos que tú capturaste en el tuyo.
> Para el demo, hagan todo en un mismo teléfono usando los botones "Entrar como…".
> **Perfil → Reiniciar datos del demo** borra lo capturado.

---

## Publicarlo (hosting)

El build es 100% estático (`dist/`) y usa rutas con `#`, así que funciona en cualquier hosting estático sin configuración extra.

### Opción A — Netlify Drop (la más rápida, gratis, ~3 min)

1. Genera el build:
   ```bash
   cd "C:\Users\Pablo R\React\pulso"
   npm run build
   ```
   Esto crea la carpeta `C:\Users\Pablo R\React\pulso\dist`.
2. Abre https://app.netlify.com/drop y crea tu cuenta gratis (con GitHub o correo).
3. **Arrastra la carpeta `dist`** a la página. En segundos te da una URL tipo `https://nombre-raro-123.netlify.app`.
4. Para ponerle un nombre bonito, entra al sitio y ve a **Site configuration → Change site name**, por ejemplo `pulso-anestesia`. Queda `https://pulso-anestesia.netlify.app`.
5. Para actualizar después: `npm run build`, luego **Deploys** en tu sitio, y arrastra de nuevo la carpeta `dist`.

### Opción B — GitHub + Vercel (recomendada: cada `git push` se publica solo, gratis)

1. Crea un repositorio vacío en https://github.com/new, llamado `pulso` (puede ser privado, sin README).
2. En PowerShell:
   ```bash
   cd "C:\Users\Pablo R\React\pulso"
   git init
   git add .
   git commit -m "Pulso v0.1"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/pulso.git
   git push -u origin main
   ```
3. Ve a https://vercel.com/signup y entra con GitHub (plan **Hobby**, gratis).
4. Haz clic en **Add New… → Project**, busca `pulso` y dale **Import**.
5. Vercel detecta **Vite** solo. Confirma estos valores y dale **Deploy**:
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. En ~1 minuto tienes `https://pulso-xxxx.vercel.app`. Cada cambio que subas con `git push` se vuelve a publicar solo.

### Opción C — Vercel desde la terminal (sin GitHub)

```bash
cd "C:\Users\Pablo R\React\pulso"
npx vercel login      # abre el navegador para iniciar sesión
npx vercel            # primera vez: acepta las opciones por defecto
npx vercel --prod     # publica en la URL de producción
```

### Dominio propio (opcional, lo único que cuesta)

1. Compra el dominio en Cloudflare Registrar, Porkbun o Namecheap. Un `.com` cuesta ≈ 10–15 USD al año.
2. Conéctalo:
   - **Vercel:** Project → Settings → Domains → Add. Vercel te muestra los registros DNS exactos (un A o un CNAME); cópialos en tu proveedor del dominio.
   - **Netlify:** Domain management → Add a domain, y sigue el asistente.
3. El HTTPS se configura solo.

### Instalarlo como "app" en el celular

- **iPhone (Safari):** abre la URL → Compartir → **Agregar a pantalla de inicio**.
- **Android (Chrome):** abre la URL → menú ⋮ → **Agregar a pantalla principal**.

---

## Estructura

```
src/
  types.ts              Modelo de datos (caso, procedimiento, evaluación)
  data/catalog.ts       Escalas, anclas, procedimientos, umbrales CUSUM, expectativas por grado
  data/users.ts         Usuarios demo (adscritos y residentes)
  data/seed.ts          Generador determinista del historial simulado (~1,100 casos)
  lib/cusum.ts          CUSUM (Kestin/Bolsin): h0, h1, s, competencia, monitoreo de caídas
  lib/stats.ts          Promedios, ANTS por dominio, alertas, resúmenes por procedimiento
  store.tsx             Estado global + persistencia en localStorage
  components/           UI, gráficas SVG, flujo conversacional de procedimiento
  screens/              Pantallas del residente y del adscrito
```

## Siguiente paso: backend real

Cuando se valide el flujo, la opción más directa es **Supabase** (Postgres + Auth + permisos por fila; el plan gratis alcanza de sobra para un programa de residencia):

- Tablas `users`, `cases`, `procedures`, `evaluations`, con el mismo modelo de `src/types.ts`.
- Reemplazar `store.tsx` por llamadas a Supabase. Las pantallas no cambian.
- Permisos: el residente ve solo lo suyo; el adscrito ve y evalúa a todos; el equipo de enseñanza ve los reportes.
- Antes de usar datos reales, revisar privacidad (LFPDPPP): la app **no** guarda nombre ni expediente del paciente.
