# 🚀 Despega: tu equipo de IA para conseguir tu primer empleo

> **Despega ayuda a jóvenes de 18 a 25 años sin experiencia formal a conseguir su primer empleo**, con un equipo de 4 agentes de IA que convierte lo que ya saben hacer en un CV, encuentra vacantes compatibles y los entrena para la entrevista.

Proyecto de hackatón · MVP funcional en una página web local.

---

## El problema

- Casi **1 de cada 5 jóvenes** en América Latina **ni estudia ni trabaja** (OIT, 19,3 %).
- El desempleo juvenil en la región es de **11,9 %**, y **51,2 %** de los jóvenes que trabajan lo hacen en la informalidad (OIT, *Tendencias mundiales del empleo juvenil 2026*).
- Muchos jóvenes **sí tienen habilidades** (ayudan en el negocio familiar, manejan redes sociales, organizan eventos), pero **no saben traducirlas** a lo que piden las empresas.

> Nota: la OIT mide a los jóvenes de 15 a 24 años.

## La solución: 4 agentes, tú decides

| # | Agente | Qué hace | Momento "wow" |
|---|---|---|---|
| 1 | 🧭 **Perfilador** | Lee tu historia (texto o voz) y la convierte en habilidades profesionales | Cada habilidad muestra **la frase de tu historia de donde salió** |
| 2 | 🔎 **Buscador** | Compara tu perfil con 30 vacantes y elige las 3 mejores | **% de compatibilidad**, por qué encajas y qué te falta |
| 3 | ✍️ **Adaptador** | Reescribe tu CV para la vacante elegida | Comparación **antes / después** y CV en PDF |
| 4 | 🎤 **Entrenador** | Te hace 3 preguntas de entrevista y evalúa tus respuestas | Entrevista **por voz** con calificación y respuesta de ejemplo |

**Dos flujos** (pestañas arriba de la barra de pasos):
- **📄 Crear mi CV** (agentes 1–3): Tu historia → Tus habilidades → Proyectos y logros → Vacantes → **Tu CV**. Termina con el CV listo.
- **🎤 Entrenar entrevista** (agente 4): Elige la vacante → Aprendizaje y práctica → Simulación. Se puede practicar para la vacante del CV actual, para un CV guardado en tu cuenta o para cualquier vacante del catálogo (contando brevemente tu historia), **sin necesidad de hacer el CV**.
  - **Aprendizaje y práctica:** en qué se fijan las empresas (puntualidad, presentación, lenguaje corporal, comunicación, actitud, ejemplos concretos, conocer la empresa, honestidad…), consejos para antes/durante/después, el método SAR con un ejemplo de tu historia, las habilidades que pide la vacante, errores comunes y preguntas para hacer al final. Después, **práctica guiada** de 3 preguntas con retroalimentación en cada respuesta.
  - **Simulación:** una entrevista de 3 preguntas distintas (presentación, experiencia y situacional), seguidas y sin pistas. Al final: **calificación de 1 a 10**, lo que hiciste bien, **observaciones de mejora** y el detalle de cada respuesta. Cada nueva simulación usa otras preguntas.

👤 **Humano en el circuito:** la IA propone y explica; la persona **aprueba, quita o agrega** en cada paso. La IA no inventa habilidades.

---

## Cómo ejecutarlo

### Opción A · Lo más rápido (modo demo, sin instalar nada)
Doble clic en **`index.html`**. Se abre en el navegador y funciona sin internet: los agentes se simulan con un motor local.

### Opción B · Con servidor local (recomendado para la presentación)
Doble clic en **`iniciar.bat`**, o en una terminal:

```powershell
python servidor.py
```

Se abre `http://localhost:8000`. La voz funciona mejor así que abriendo el archivo directamente.

### Opción C · Con IA real (Claude)
```powershell
pip install -r requirements.txt
$env:ANTHROPIC_API_KEY = "tu-api-key"
python servidor.py
```

La insignia de arriba a la derecha muestra **🤖 IA real** o **⚡ Modo demo**.

| Variable | Para qué sirve |
|---|---|
| `ANTHROPIC_API_KEY` | Activa la IA real |
| `DESPEGA_MODELO` | Cambia el modelo (por defecto `claude-opus-5-5`) |
| `DESPEGA_MODO=demo` | Fuerza el modo demo aunque haya API key |
| `PORT` | Cambia el puerto (por defecto 8000) |

> 💡 **Plan B para la presentación:** si el internet falla, abran `http://localhost:8000/?modo=demo` y todo sigue funcionando. Si un agente de IA falla a mitad de la demo, la app usa automáticamente el motor local para ese paso.

---

## Guion de la demo (90 segundos)

1. **Paso 1:** clic en **"✨ Usar ejemplo (Mariana)"** → **"Analizar mi historia"**. Señalar el panel de agentes trabajando.
2. **Paso 2:** mostrar que cada habilidad tiene **evidencia**. Quitar una para demostrar que *tú decides*. → **"Aprobar y continuar"**.
3. **Paso 3 (opcional):** **Proyectos y logros**, con una guía de qué escribir y cómo. Agregar uno o dar clic en **"Omitir, no agregar nada"** (el CV queda sin esas secciones).
4. **Paso 4:** mostrar el **% de compatibilidad**, "por qué encajas" y "para crecer". Elegir la primera vacante.
5. **Paso 5:** comparación **antes / después** del CV y "¿Qué cambió y por qué?". Opcional: **Descargar CV (PDF)**. Aquí termina el flujo del CV.
6. **Entrenar entrevista:** clic en **"🎤 Entrenar la entrevista para esta vacante"** (o en la pestaña **🎤 Entrenar entrevista**) → **Empezar a entrenar**. Mostrar **En qué se fijan las empresas**, responder una pregunta de la práctica (**🎤 Responder con mi voz** → **Evaluar**) y luego **Ir a la simulación** → contestar las 3 preguntas → mostrar la **calificación /10** y las **observaciones de mejora**.

> Cierre: *"En menos de 2 minutos, Mariana pasó de 'no tengo experiencia' a tener un CV, 3 vacantes y una entrevista practicada."*

---

## Estructura del proyecto

```
Hackaton/
├── index.html          # La página (flujo de CV en 5 pasos + flujo de entrevista + panel de agentes)
├── css/estilos.css     # Estilos: paleta y tipografías para aprendizaje
├── js/
│   ├── app.js          # Lógica de la interfaz, voz, cuentas y conexión con los agentes
│   ├── cuentas.js      # Cuentas: en el navegador (localStorage) o en el servidor si está corriendo
│   ├── cv-latex.js     # CV con la plantilla LaTeX (.tex, Overleaf y versión imprimible)
│   ├── motor-local.js  # Los 4 agentes simulados (modo demo, sin internet)
│   └── vacantes.js     # 30 vacantes de ejemplo (empresas ficticias)
├── servidor.py         # Servidor local + agentes con Claude (opcional) + API de cuentas
├── cuentas.py          # Cuentas: usuarios, contraseñas (hash), sesiones y CV guardados (SQLite)
├── datos/              # Se crea al usar cuentas: despega.db (NO se sube a git)
├── requirements.txt    # Dependencia para la IA real (anthropic)
├── iniciar.bat         # Doble clic para iniciar el servidor en Windows
└── README.md
```

**Arquitectura:** cada agente es una llamada a la IA con sus propias instrucciones y un **esquema JSON** de salida. Los agentes se pasan el resultado en cadena: Perfil → Vacantes → CV → Entrevista. El motor local devuelve **exactamente el mismo JSON**, así la interfaz no distingue entre modos.

**Datos:** las vacantes viven en `js/vacantes.js`. Sin cuenta (modo invitado), el perfil solo vive en la memoria del navegador y no se guarda nada.

**Cuentas:** al abrir Despega aparece la pantalla de acceso para **iniciar sesión** o **crear cuenta** con nombre completo y contraseña (también se puede **continuar sin cuenta**). Funciona **con solo abrir la página**: no hace falta el servidor.
- Con sesión iniciada se guardan automáticamente los datos del paso 1 (edad, historia, contacto, estudios), los proyectos y logros del paso 3, y **cada CV adaptado**.
- Al volver a entrar, Despega se llena solo con esos datos. La sesión se recuerda 30 días.
- En **Mi cuenta** (botón 👤 del encabezado) se ven e imprimen como PDF, se descargan en `.tex` o se abren en Overleaf los CV guardados; se editan los datos, el nombre y la contraseña; y se puede cerrar sesión o eliminar la cuenta con todos sus CV.
- El nombre para iniciar sesión no distingue mayúsculas ni acentos («José Pérez» = «jose perez»), así que dos cuentas no pueden tener el mismo nombre.
- Las contraseñas se guardan como hash PBKDF2-SHA256 con sal, nunca en texto plano.

**¿Dónde se guardan las cuentas?** `js/cuentas.js` elige solo:

| Cómo se abre Despega | Dónde se guardan | Notas |
|---|---|---|
| `index.html` con doble clic, o publicado como sitio estático (p. ej. GitHub Pages) | En **este navegador** (`localStorage`) | Cada navegador/equipo tiene sus propias cuentas. Borrar los datos del sitio en el navegador borra las cuentas. El hash se calcula con Web Crypto, que requiere `https://` o archivo local. |
| Con el servidor (`iniciar.bat` / `python servidor.py`) | En **`datos/despega.db`** (SQLite) en el equipo del servidor | Sesión con cookie `HttpOnly`. Si hay `pdflatex`, cada CV se guarda también como PDF compilado. Otra ubicación: variable `DESPEGA_BD`. La carpeta `datos/` no se sube a git. |

> Las cuentas en el navegador sirven para que cada persona retome su avance en su propio equipo; no sincronizan entre dispositivos. Quien tenga acceso al navegador y a sus herramientas de desarrollo puede leer los datos guardados (no las contraseñas).

**Habilidades personalizadas:** al agregar una habilidad, la persona elige si es **🛠️ Técnica** o **💬 Blanda**. Las que no estaban en el catálogo se guardan en el navegador (`localStorage`, clave `despega.habilidadesPersonalizadas`) y aparecen en las sugerencias la próxima vez, con su tipo. Para borrarlas, limpien los datos del sitio en el navegador.

---

## Diseño: colores y tipografías para el aprendizaje

| Elemento | Elección | Por qué |
|---|---|---|
| Tipografía de títulos | **Lexend** | Diseñada para mejorar la fluidez de lectura |
| Tipografía de texto | **Atkinson Hyperlegible** | Creada por el Braille Institute para máxima legibilidad, distingue letras parecidas (I/l/1, O/0) |
| Fondo | Crema `#FBF9F4` | Menos brillo que el blanco puro; más cómodo para leer |
| Texto | Gris pizarra `#1E293B` | Alto contraste sin la dureza del negro puro |
| Primario | Azul `#2563EB` | Asociado a confianza y concentración |
| Progreso / logro | Verde `#15803D` | Refuerza el avance y los aciertos |
| Acento | Ámbar `#F59E0B` | Motivación y llamadas de atención amables |

También incluye: **contraste WCAG AA**, tamaño base de 17 px, interlineado 1.6, botones de al menos 44 px, **modo oscuro** automático, foco visible para teclado y respeto a "reducir movimiento".

> Las fuentes se cargan de Google Fonts. Sin internet, se usan las fuentes del sistema y todo sigue funcionando.

---

## Requisitos y notas

- **Navegador:** Chrome o Edge (recomendado para voz). Firefox funciona, pero sin dictado por voz.
- **Voz:** el dictado usa la Web Speech API del navegador. En Chrome necesita internet y permiso de micrófono.
- **CV en LaTeX:** el CV adaptado usa una plantilla LaTeX de una página (secciones Perfil, Educación, Experiencia, Proyectos, Logros y Habilidades técnicas/blandas; Proyectos y Logros solo aparecen si se llenaron en el paso 3). En el paso 5 hay tres opciones:
  - **Descargar CV (PDF):** abre la ventana de impresión con el mismo diseño de la plantilla; elijan **Guardar como PDF**.
  - **Descargar LaTeX (.tex):** el archivo fuente para editarlo y compilarlo con `pdflatex`.
  - **Abrir en Overleaf:** envía el `.tex` a overleaf.com, que genera el PDF (servicio externo).
- **Datos del CV:** teléfono, correo, ciudad, enlace y estudios son opcionales (paso 1, «Datos para tu CV»). El contacto no se envía a la IA.
- **Python 3.10+** solo para el servidor (opciones B y C).

## Roadmap (lo que va en "siguientes pasos" del pitch)

- Vacantes reales vía bolsas de trabajo y programas de gobierno de primer empleo
- Mentores humanos que validan perfiles
- Cuentas de usuario y seguimiento de postulaciones
- Panel para empresas que buscan talento joven
- App móvil y versión por WhatsApp

## Modelo de negocio

Gratis para jóvenes. Ingresos por **empresas** (acceso a candidatos jóvenes ya preparados) y **alianzas** con gobiernos y universidades con programas de primer empleo.

---

*Demo de hackatón. Las vacantes y empresas son ficticias.*
