# Pulso · Evaluación de residentes de Anestesiología

Prototipo *mobile-first* (React + Vite + TypeScript, sin backend) de la herramienta de evaluación.
Versión **v0.5**: ajustes de la verificación interna (junta 4): éxito por criterios validados por el adscrito, CUSUM con parámetros publicados,
tasa de éxito con intervalo de confianza, uso formativo de ANTS y alertas. Configuración en `src/config/` (sin tocar el código).

- **El residente registra el caso** en ~1 minuto. Ese registro **es su autoevaluación**.
  Flujo conversacional: "¿Lo lograste? → ¿Al primer intento? → ¿En cuál?".
- **El adscrito solo evalúa registros ya hechos** (no captura casos):
  - **O-SCORE por procedimiento** (juicio retrospectivo; si hubo 3 procedimientos, son 3 calificaciones).
    Puede marcar "no presencié", corregir el éxito/fallo (con motivo, queda trazado) o rechazar el registro.
  - **Confiabilidad (entrustment) por caso** (juicio prospectivo), **ANTS** (formativo) y **Mini-CEX** por caso.
  - Retroalimentación obligatoria y cierre.
- **El profesor** (siempre es adscrito) además **modera el programa**: ve todas las alertas,
  el estado del equipo de adscritos, los reportes y valida los casos marcados.
- **Éxito por criterios** de cada procedimiento, igual para todos los grados; provisional hasta que valida el adscrito.
- **CUSUM** (método estándar, Aguirre Ospina 2014) en 5 procedimientos con parámetros publicados; los otros 5 "en calibración" (solo tasa de éxito).
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
4. Procedimiento: **Laringoscopia directa** → primer operador Sí → ¿lo lograste? Sí → ¿al primer intento? **No** → **2º** → 5–10 min → solo verbal → ¿desaturación? No → sin incidentes.
   - La app dice si, **según los criterios**, sería éxito o fallo, y aclara que es **provisional** hasta que valide el adscrito. Muestra los criterios del procedimiento.
5. Autoevaluación obligatoria: "¿Identificaste alguna fortaleza, dificultad u oportunidad de mejora?" → **Enviar**.
6. Toca **"Entrar como Dr. Carlos Felipe González"**: se abre la evaluación.
   - O-SCORE **de ese procedimiento** (ahí mismo ve el resultado según criterios y puede **corregirlo** con motivo, o marcar **"no presencié"**)
     → confiabilidad **del caso** → ANTS → Mini-CEX → retroalimentación → cierre → **revisa antes de enviar**.
   - En la primera pantalla puede **rechazar el registro** si no corresponde.
7. Toca **"Entrar como Pablo Rodríguez"**: ahí se ve **separada** su autoevaluación de la evaluación del adscrito.
   - En **Progreso**: O-SCORE contra la referencia provisional del grado, ANTS (formativo, sin umbral) y procedimientos.
     Dentro de cada uno: criterios de éxito, tasa de éxito con IC95%, curva CUSUM (o "en calibración") y desglose por grado.
8. **Vista de profesor** (Carlos Felipe): pestaña **Alertas** → casos sin adscrito, eventos críticos, riesgos, revisiones, registros rechazados,
   **alertas formativas de curva** (en R1 salen como aviso) y registros sin validar.
   - Dentro, **Equipo de adscritos**: quién tiene pendientes y qué O-SCORE promedio pone cada quien.
   - **Reportes**: consolidado por grado, **tasa de éxito con IC95%**, comparación por jornada, **curva de aprendizaje por bloques de intentos** de toda la sede
     y **exportación** de la base de investigación (CSV seudonimizado y agregado).
   - **Perfil → Verificación de la curva CUSUM**: corre la secuencia de prueba de la lista de cotejo y compara contra los valores esperados.
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
- **Éxito por criterios** (`src/config/procedimientos.json`), **mismo estándar para todos los grados**; el grado solo cambia cómo se leen las alertas.
  El autorreporte es provisional; cuenta cuando el adscrito valida. **O-SCORE 1 o relevo = fallo siempre.** Solo cuentan intentos como primer operador,
  con adscrito, presenciados y no excluidos.
- **CUSUM:** P, Q, s, H0, H1 con α = β = 0.10; casos mínimos = |H0/(s − p0)|. Estados: insuficiente para concluir → alcanzó el estándar (cruza H0) →
  alerta formativa (arriba de H1 pasado el periodo de gracia). Verificada contra la hoja "Prueba CUSUM" (coinciden los 20 valores).
- **Tasa de éxito** = éxitos / intentos validados, con IC95% de Wilson y aviso si n < 30. No se llama "CUSUM".
- **Referencias por grado provisionales** (`src/config/umbrales.json`): O-SCORE R1 ≥ 3, R2/R3 ≥ 4 · mayor riesgo R1 2–3 · confiabilidad R1 ≥ 3, R2/R3 ≥ 4.
  **ANTS solo formativo** (sin umbral, fuera del estado y de las alertas). El "Estado" usa solo el O-SCORE.
- Alertas con **lenguaje formativo** ("revisar en la sesión trimestral", "acompañamiento sugerido"); no hay calificación final ni dictámenes.
- Recordatorio de **registros sin validar** después de 3 días (configurable).
- Si se pierde la conexión, avisa y **guarda el borrador** del registro en el teléfono.
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
  config/               Tabla de procedimientos (p0, p1, α, β, criterios, gracia) y umbrales por grado (JSON editable)
  data/catalog.ts       Escalas y anclas; lee la configuración
  data/users.ts         Usuarios demo, códigos y contraseña genérica
  data/seed.ts          Generador determinista del historial simulado (~1,200 casos)
  lib/success.ts        Éxito por criterios, resultado provisional/definitivo, IC95% de Wilson
  lib/cusum.ts          CUSUM estándar (Aguirre Ospina 2014): s, H0, H1, casos mínimos, estados
  lib/stats.ts          Intentos validados, resúmenes por procedimiento, alertas
  lib/export.ts         Exportación CSV seudonimizada y agregada
  store.tsx             Estado, sesión, contraseñas y persistencia en localStorage
  components/           UI, gráficas SVG, flujo conversacional de procedimiento
  screens/              Residente · Adscrito · Profesor
```

## Pendientes de definición

- Lista **ampliada de ANTS** que dará enseñanza.
- **Leyenda completa del aviso** para adscritos (`src/data/legal.ts`). El consentimiento informado entra en la 1.0.
- **Cortes propios de la CUSUM (p0, p1)**: hoy son de literatura; se definirán con la curva de la sede.
- **Criterios de éxito** de mascarilla (llegó cortado), videolaringoscopia, fibroscopia, periférico y mixto: hoy provisionales.
- **Periodo de gracia** por procedimiento (hoy 15 intentos, provisional) y niveles de la escala de confiabilidad (hoy propuesta según ten Cate/Dubois).
- Traducción de las anclas del O-SCORE contra el Anexo 10 del Programa.
- Decisiones abiertas de la lista de cotejo: tipo de cirugía/complejidad (C01), login con contraseña y rol administrador (F02),
  vínculo con competencias de egreso (A01), catálogo de actividades confiables (A04).
- Vista de **super admin** (contraseñas, correcciones).
- **Backend en .NET** (ASP.NET Core + SQLite local).
