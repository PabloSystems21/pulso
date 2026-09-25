# Pulso · Evaluación de residentes de Anestesiología

Prototipo *mobile-first* (React + Vite + TypeScript, sin backend) de la herramienta de evaluación.
Versión **v0.2**: incorpora las notas de la junta con el equipo de enseñanza.

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

El usuario **es el código de empleado** (adscritos) o la **matrícula** (residentes).
La contraseña genérica inicial es `Anes.<código>`; la app pide cambiarla.

| Código | Quién | Rol |
|---|---|---|
| 10482 | Dr. Felipe González | Adscrito · **Profesor** |
| 10517 | Dra. Ana Sofía Treviño | Adscrito · Profesor |
| 10603 | Dra. Mariana Ortiz | Adscrito · Profesor |
| 10744 | Dr. Luis Herrera | Adscrito · Profesor |
| 10896 | Dr. Raúl Vega | Adscrito |
| 10921 | Dra. Paula Ibarra | Adscrito |
| 26104 | Pablo Rodríguez | Residente R1 |
| 26118 | Daniela Cruz | Residente R1 |
| 25073 / 25089 | Jorge Salinas / Valeria Mendoza | Residentes R2 |
| 24035 / 24042 | Andrés Fuentes / Regina Lara | Residentes R3 |

**Links directos:** `https://TU-SITIO/?as=10482` (Felipe) · `https://TU-SITIO/?as=26104` (Pablo).

---

## Guion del demo (~6 minutos)

1. Entra como **Pablo Rodríguez (26104)** y toca **"Regístralo en 1 minuto"**.
2. Identificación: área **Quirófano**, jornada **Ordinaria**, supervisó **Dr. Felipe González**.
   - Enséñale también la opción **"Sin adscrito"**: pregunta si estuvo solo o con un residente mayor, y avisa que se notifica a todos los profesores.
3. El caso: Electivo · ASA 2 · General · Obesidad. (Si marcas evento crítico, exige explicación.)
4. Procedimiento: **Laringoscopia directa** → primer operador Sí → ¿lo lograste? Sí → ¿al primer intento? **No** → **2º** → 5–10 min → solo verbal → sin incidentes.
   - La app dice sola si cuenta como **éxito o falla** para la CUSUM.
5. Autoevaluación obligatoria: "¿Identificaste alguna fortaleza, dificultad u oportunidad de mejora?" → **Enviar**.
6. Toca **"Entrar como Dr. Felipe González"**: se abre la evaluación.
   - O-SCORE **de ese procedimiento** → entrustment **del caso** → ANTS → Mini-CEX → retroalimentación → cierre.
7. Toca **"Entrar como Pablo Rodríguez"**: ahí se ve **separada** su autoevaluación de la evaluación del adscrito.
   - En **Progreso**: O-SCORE contra lo esperado para R1, ANTS, y CUSUM por procedimiento (laringoscopia: competencia en el intento #40).
8. **Vista de profesor** (Felipe): pestaña **Alertas** → casos sin adscrito, riesgos, casos que ameritan revisión y caídas de CUSUM.
   - Dentro, **Equipo de adscritos**: quién tiene pendientes, qué O-SCORE promedio pone cada quien y quién no ha cambiado su contraseña (con botón para restablecerla).
   - **Reportes**: consolidado mensual y trimestral por grado.
9. **Contraste de roles:** entra como **Dr. Raúl Vega (10896)**, que es adscrito sin ser profesor: solo ve sus pendientes y lo que ha evaluado. Sin alertas, sin reportes.

> Sin backend: lo que captures se guarda **en ese navegador**. Para el demo, hagan todo en un mismo
> teléfono con los botones "Entrar como…". **Perfil → Reiniciar datos del demo** lo deja limpio.

---

## Reglas de negocio ya implementadas

- Un procedimiento **no se puede repetir** dentro del mismo caso.
- **Nada se puede editar** después de enviarse (ni el residente ni el adscrito). Correcciones: por el administrador.
- Jornada: solo **Ordinaria** (matutino) o **Guardia** (complementaria/vespertino).
- Área: **Quirófano / Tococirugía / Fuera de quirófano**. No se pregunta el número de quirófano ni la cirugía.
- **ASA 1 a 6.**
- Comorbilidades: vía aérea difícil, obesidad, embarazo y **paciente pediátrico** (sustituye a la edad).
- Evento crítico: Sí/No; si es Sí, explicación **obligatoria**.
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

## Pendientes de definición (ver reporte de la junta)

- Lista **ampliada de ANTS** que dará enseñanza.
- **p0, p1 y definición de falla** por procedimiento (hoy son valores provisionales de literatura).
- **Umbrales esperados por grado** (hoy la banda verde es provisional).
- Si un caso "amerita revisión" debe **excluirse de las gráficas** hasta que el profesor lo valide:
  se cambia con la constante `EXCLUDE_UNDER_REVIEW` en `src/data/catalog.ts`.
