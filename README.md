# Pulso · Evaluación de residentes de Anestesiología

Prototipo *mobile-first* (React + Vite + TypeScript, sin backend) de la herramienta de evaluación.
Versión **v0.4**: incorpora las notas de la segunda y tercera junta con enseñanza (umbrales, CUSUM por grado, login del demo, aviso para todos).

- **El residente registra el caso** en ~1 minuto. Ese registro **es su autoevaluación**.
  Flujo conversacional: "¿Lo lograste? → ¿Al primer intento? → ¿En cuál?".
- **El adscrito solo evalúa registros ya hechos** (no captura casos):
  - **O-SCORE por procedimiento** (si hubo 3 procedimientos, son 3 calificaciones).
  - **Entrustment, ANTS y Mini-CEX por caso.**
  - Retroalimentación obligatoria y cierre.
- **El profesor** (siempre es adscrito) además **modera el programa**: ve todas las alertas,
  el estado del equipo de adscritos, los reportes y valida los casos marcados.
- **CUSUM automática** por residente y procedimiento, con líneas de decisión y alertas.
- **Reportes** mensuales y trimestrales por grado.

En computadora se ve con el mismo layout de celular (marco centrado).

---

## Correrlo en tu compu

```bash
cd "C:\Users\Pablo R\React\pulso"
npm install        # solo la primera vez
npm run dev
```

---

## Usuarios del demo

El usuario **es el código de empleado** (todos, residentes incluidos; algunos residentes podrían usar matrícula).
La contraseña genérica inicial es `Anes.<código>`; la app pide cambiarla.

**Login del demo:** primero se escoge *Demo · modo adscrito* o *Demo · modo residente*; luego aparece el login
real ya lleno y solo se le da **Continuar** (hay un selector para escoger otro usuario). En el demo no se valida
la contraseña: se controla con `DEMO_NO_PASSWORD` en `src/store.tsx`. Lo primero que sale al abrir la app,
para todos, es el **aviso** en un modal con "Entendido, continuar" (texto en `src/data/legal.ts`).

| Código | Quién | Rol |
|---|---|---|
| 10482 | Dr. Carlos Felipe González | Adscrito · **Profesor** |
| 10517 | Dra. Ana Sofía Treviño | Adscrito · **Profesor** |
| 10603 | Dra. Mariana Ortiz | Adscrito |
| 10744 | Dr. Luis Herrera | Adscrito |
| 10896 | Dr. Raúl Vega | Adscrito |
| 10921 | Dra. Paula Ibarra | Adscrito |
| 26104 | Pablo Rodríguez | Residente R1 |
| 26118 | Daniela Cruz | Residente R1 |
| 25073 / 25089 | Jorge Salinas / Valeria Mendoza | Residentes R2 |
| 24035 / 24042 | Andrés Fuentes / Regina Lara | Residentes R3 |

**Links directos:** `https://TU-SITIO/?as=10482` (Carlos Felipe) · `https://TU-SITIO/?as=26104` (Pablo).

---

## Guion del demo (~6 minutos)

1. **Demo · modo residente** → Continuar (entra Pablo Rodríguez, 26104) y toca **"Regístralo en 1 minuto"**.
2. Identificación: área **Quirófano**, jornada **Ordinaria**, supervisó **Dr. Carlos Felipe González**.
   - Enséñale también la opción **"Sin adscrito"**: pregunta si estuvo solo o con un residente mayor, avisa que se notifica a todos los profesores, y que ese caso **no se evalúa ni suma a la CUSUM**.
3. El caso: Electivo · ASA 2 · General · Obesidad. (Si marcas evento crítico, exige explicación y **siempre** alerta a los profesores.)
4. Procedimiento: **Laringoscopia directa** → primer operador Sí → ¿lo lograste? Sí → ¿al primer intento? **No** → **2º** → 5–10 min → solo verbal → sin incidentes.
   - La app dice sola si cuenta como **éxito o falla** para la CUSUM, con la tolerancia de su grado (al R1 se le tolera más).
5. Autoevaluación obligatoria: "¿Identificaste alguna fortaleza, dificultad u oportunidad de mejora?" → **Enviar**.
6. Toca **"Entrar como Dr. Carlos Felipe González"**: se abre la evaluación.
   - O-SCORE **de ese procedimiento** → entrustment **del caso** → ANTS → Mini-CEX → retroalimentación → cierre → **revisa antes de enviar**.
7. Toca **"Entrar como Pablo Rodríguez"**: ahí se ve **separada** su autoevaluación de la evaluación del adscrito.
   - En **Progreso**: O-SCORE contra el umbral del grado, ANTS (≥ 3) y CUSUM por procedimiento. Dentro de cada procedimiento, la curva marca qué intentos fueron de R1, R2 y R3.
8. **Vista de profesor** (Carlos Felipe): pestaña **Alertas** → casos sin adscrito, eventos críticos, riesgos, casos que ameritan revisión y caídas de CUSUM (ej. Daniela Cruz en bloqueo espinal).
   - Dentro, **Equipo de adscritos**: quién tiene pendientes y qué O-SCORE promedio pone cada quien (con botón para restablecer contraseña).
   - **Reportes**: consolidado mensual y trimestral por grado, y la **curva de la sede** por procedimiento.
9. **Contraste de roles:** entra como **Dr. Raúl Vega (10896)**, que es adscrito sin ser profesor: solo ve sus pendientes y lo que ha evaluado. Sin alertas, sin reportes.

> Sin backend: lo que captures se guarda **en ese navegador**. Para el demo, hagan todo en un mismo
> teléfono con los botones "Entrar como…". **Perfil → Reiniciar datos del demo** lo deja limpio.

---

## Fases del proyecto

1. **Demo / validación alfa** (hasta diciembre): la revisan los **adscritos** (por confirmar si también residentes). Se juntan observaciones.
2. **Beta con datos reales**: primera versión utilizable por residentes y adscritos; se pone un punto de corte para
   revisar que los datos sean reales y se escuchan comentarios reales.
3. **1.0** y después parches y actualizaciones periódicas en producción.
4. **A los 3 años**: validación con todos los datos recopilados (que mida lo que dice medir). Primeros años sin fines de lucro.

**Actualizaciones sin chocar con el caché:** el build genera los JS/CSS con un hash en el nombre, así que cada versión
nueva baja archivos nuevos; solo `index.html` no debe quedarse en caché (Vercel ya lo sirve así). Si cambia el formato
de los datos guardados, se sube la versión de `DATA_KEY` en `src/store.tsx`.

## Reglas de negocio ya implementadas

- Un procedimiento **no se puede repetir** dentro del mismo caso.
- **Nada se puede editar** después de enviarse (ni el residente ni el adscrito). Correcciones: por el administrador.
- Jornada: solo **Ordinaria** (matutino) o **Complementaria** (vespertino o guardia).
- Área: **Quirófano / Tococirugía / Fuera de quirófano**. No se pregunta el número de quirófano ni la cirugía.
- **ASA 1 a 6.**
- Comorbilidades: vía aérea difícil, obesidad, embarazo y **paciente pediátrico** (sustituye a la edad).
- Evento crítico: Sí/No; si es Sí, explicación **obligatoria** y **siempre** alerta a los profesores.
- Caso **sin adscrito**: alerta a todos los profesores, **no se evalúa** y **no suma a la CUSUM**.
- "¿Amerita revisión de un profesor?" = "no cuenta para la progresión": el caso queda **fuera de gráficas y CUSUM** hasta que un profesor lo incluya.
- El adscrito ve una pantalla de **revisa antes de enviar**.
- **Umbrales:** O-SCORE R1 ≥ 3, R2/R3 ≥ 4 · mayor riesgo (línea arterial, CVC, fibroscopio) R1 2–3, R2/R3 ≥ 4 · ANTS ≥ 3 · Entrustment R1 ≥ 3, R2/R3 ≥ 4.
- **Éxito CUSUM por grado:** R1 = lo logró sin que el adscrito tomara el control (relevo u O-SCORE 1). R2/R3 = además ≤ 2 intentos, ≤ 10 min y sin ayuda o solo verbal.
- **Grado automático:** se calcula con el año de ingreso; cada 1 de marzo todos suben. Al pasar de R3 quedan como egresados (se conserva su historial).
- **Contraseñas:** solo el super admin ve quién no la ha cambiado y solo él las restablece (columna `changed`, empieza en `false`).
- **Hora y jornada** las pone el residente (obligatorias, sin valor por defecto). Reportes compara ordinaria vs. complementaria.
- Riesgo al paciente: Sí/No; si es Sí, explicación **obligatoria** y alerta a los profesores.
- **No hay cambios de rol**: si alguien cambia de puesto se crea un usuario nuevo; el anterior se conserva.
- No se registran residentes externos ni de intercambio.

---

## Publicarlo

El build es estático (`dist/`) y usa rutas con `#`, así que corre en cualquier hosting.

**Ya está en Vercel conectado a GitHub:** cada `git push` republica.

```bash
cd "C:\Users\Pablo R\React\pulso"
git add .
git commit -m "v0.2: cambios de la junta"
git push
```

**Alternativa sin Git (Netlify Drop):** `npm run build` y arrastra la carpeta `dist` a https://app.netlify.com/drop

**Para bajar el demo público** después de la presentación: en Vercel, *Settings → General → Delete Project*.
El código sigue en GitHub y lo pueden ver local con `npm run dev`.

---

## Estructura

```
src/
  types.ts              Modelo (caso, procedimiento, evaluación, revisión del profesor)
  data/catalog.ts       Escalas, anclas, procedimientos, umbrales CUSUM, expectativas por grado
  data/users.ts         Usuarios demo, códigos y contraseña genérica
  data/seed.ts          Generador determinista del historial simulado (~1,200 casos)
  lib/cusum.ts          CUSUM (Kestin/Bolsin): h0, h1, s, competencia, monitoreo de caídas
  lib/stats.ts          Promedios, ANTS por dominio, alertas del residente y del programa
  store.tsx             Estado, sesión, contraseñas y persistencia en localStorage
  components/           UI, gráficas SVG, flujo conversacional de procedimiento
  screens/              Residente · Adscrito · Profesor
```

## Pendientes de definición

- Lista **ampliada de ANTS** que dará enseñanza.
- **Leyenda completa del aviso** para adscritos (`src/data/legal.ts`). El consentimiento informado entra en la 1.0.
- **Cortes propios de la CUSUM (p0, p1)**: hoy son de literatura; se definirán con la curva de la sede.
- Confirmar: qué procedimiento es "intubación difícil" (hoy: fibroscopio), si una complicación con el
  procedimiento logrado cuenta como falla (hoy no), si la tolerancia del R1 es todo el año, y si el umbral de
  "supervisión indirecta / sin supervisión" es el del entrustment.
- Vista de **super admin** (contraseñas, correcciones).
- **Backend en .NET** (ASP.NET Core + SQLite local).
