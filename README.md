# 🚀 Despega: tu equipo de IA para tu primer empleo en tecnología

> **Despega ayuda a estudiantes y recién egresados de ciencias computacionales (sistemas, software, informática, IA, datos) a conseguir sus prácticas o su primer empleo en tecnología**, con un equipo de 4 agentes de IA que convierte sus proyectos, prácticas y hackatones en un CV técnico, encuentra vacantes compatibles con su stack y los entrena para la entrevista técnica.

Proyecto de hackatón · MVP funcional en una página web local.

---

## El problema

- Muchas personas que estudian o acaban de egresar de computación **sí tienen experiencia**: proyectos escolares, prácticas, servicio social, hackatones, programación competitiva, código abierto o su tesis. Pero **no saben presentarla** como lo piden las vacantes ni qué puestos junior encajan con su stack.
- Las vacantes de entrada (prácticas, becario, trainee, junior) piden cosas distintas según el sector y la empresa, y es difícil saber qué falta aprender y cómo demostrarlo.
- Las entrevistas técnicas combinan preguntas de proyectos, de resolución de problemas y de trabajo en equipo; sin práctica, es fácil quedarse en blanco o programar en silencio.

## La solución: 4 agentes, tú decides

| # | Agente | Qué hace | Momento "wow" |
|---|---|---|---|
| 1 | 🧭 **Perfilador** | Lee tu historia y la convierte en habilidades técnicas y blandas | Cada habilidad muestra **la frase de tu historia de donde salió** |
| 2 | 🔎 **Buscador** | Compara tu perfil con 30 vacantes de tecnología y elige las 3 mejores | **% de compatibilidad**, por qué encajas y qué te falta |
| 3 | ✍️ **Adaptador** | Reescribe tu CV para la vacante elegida | Comparación **antes / después** y CV en PDF |
| 4 | 🎤 **Entrenador** | Te prepara para la entrevista técnica y evalúa tus respuestas | Práctica y simulación escritas, con calificación y respuesta de ejemplo |

**Dos flujos** (pestañas arriba de la barra de pasos):
- **📄 Crear mi CV** (agentes 1–3): Tu historia → Tus habilidades → Proyectos y logros → Vacantes → **Tu CV**. Termina con el CV listo.
- **🎤 Entrenar entrevista** (agente 4): una sola pantalla. Se elige la vacante y hay dos pestañas: **📚 Aprendizaje y práctica**, de consulta libre, y **🎯 Simulación**, la única parte secuencial. Se puede practicar para la vacante del CV actual, para un CV guardado en tu cuenta o para cualquier vacante del catálogo (contando brevemente tu historia), **sin necesidad de hacer el CV**.
  - **Aprendizaje y práctica (consulta libre):** basta con elegir la vacante; los apartados se abren en el orden que quieras. Incluye en qué se fijan las empresas de tecnología (fundamentos, pensar en voz alta, resolución de problemas, código limpio, GitHub, proyectos explicados a fondo, trabajo en equipo, inglés técnico, honestidad…), consejos para antes/durante/después, el método SAR con un ejemplo de tu historia, las habilidades que pide la vacante, errores comunes y preguntas para hacer al final. Además, una **práctica guiada** opcional de 3 preguntas con retroalimentación en cada respuesta, que se puede repetir cuando quieras.
  - **🧮 Problemas tipo LeetCode (nivel junior):** 10 problemas fáciles (Suma de dos, Paréntesis válidos, Palíndromo, Anagrama, Comprar y vender, Duplicados, Búsqueda binaria, Invertir lista enlazada, Fusionar arreglos ordenados, Primer carácter único). Cada uno trae enunciado, ejemplos, pistas, un espacio para escribir tu explicación y recibir retroalimentación, y la solución: la lógica paso a paso, la complejidad y código de referencia en Python y JavaScript.
  - **Simulación (secuencial: inicio → 3 preguntas → problema técnico → resultado):** una entrevista de 3 preguntas distintas (presentación o proyecto, experiencia técnica y situacional técnica, por ejemplo un fallo en producción) y, al final, **un problema tipo LeetCode** elegido al azar (sin repetir el de la simulación anterior), seguidos y sin pistas. El resultado incluye la solución de referencia del problema. Al final: **calificación de 1 a 10**, lo que hiciste bien, **observaciones de mejora** y el detalle de cada respuesta. Cada nueva simulación usa otras preguntas.
  - Con una vacante del catálogo, la historia («Cuéntanos de ti») solo se pide al empezar la práctica o la simulación; la información no la necesita.

👤 **Humano en el circuito:** la IA propone y explica; la persona **aprueba, quita o agrega** en cada paso. La IA no inventa habilidades.

---

### ¿Por qué los problemas se responden explicando la lógica y no con un compilador?

Despega evalúa **la explicación de la solución** (estructura de datos, pasos, casos borde y complejidad), no código ejecutado:
- Es lo que se califica en las entrevistas técnicas para puestos junior: **pensar en voz alta** y justificar decisiones.
- Las vacantes piden lenguajes distintos (Python, Java, C++, C#, JavaScript…); explicar la lógica sirve para todos.
- La página sigue funcionando sin servidor ni internet: un juez necesitaría descargar intérpretes pesados (por ejemplo Pyodide para Python) y ejecutar código de forma aislada.

Con IA real, el Entrenador evalúa la explicación contra la solución de referencia y acepta otros enfoques correctos. En modo demo se usa una heurística (idea clave del problema, pasos específicos, complejidad y casos borde). Todas las soluciones de referencia se verificaron con casos de prueba.

---

## Cómo ejecutarlo

### Opción A · Lo más rápido (modo demo, sin instalar nada)
Doble clic en **`index.html`**. Se abre en el navegador y funciona sin internet: los agentes se simulan con un motor local.

### Opción B · Con servidor local (recomendado para la presentación)
Doble clic en **`iniciar.bat`**, o en una terminal:

```powershell
python servidor.py
```

Se abre `http://localhost:8000`.

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

1. **Paso 1:** clic en **"✨ Usar ejemplo (Diego)"** (estudiante de último año de Ingeniería en Sistemas) → **"Analizar mi historia"**. Señalar el panel de agentes trabajando.
2. **Paso 2:** mostrar que cada habilidad tiene **evidencia**. Quitar una para demostrar que *tú decides*. → **"Aprobar y continuar"**.
3. **Paso 3 (opcional):** **Proyectos y logros**, con una guía de qué escribir y cómo. Agregar uno o dar clic en **"Omitir, no agregar nada"** (el CV queda sin esas secciones).
4. **Paso 4:** mostrar el **% de compatibilidad**, "por qué encajas" y "para crecer". Elegir la primera vacante.
5. **Paso 5:** comparación **antes / después** del CV y "¿Qué cambió y por qué?". Opcional: **Descargar CV (PDF)**. Aquí termina el flujo del CV.
6. **Entrenar entrevista:** clic en **"🎤 Entrenar la entrevista para esta vacante"** (o en la pestaña **🎤 Entrenar entrevista**) → mostrar **En qué se fijan las empresas** (aparece al instante), responder por escrito una pregunta de la práctica guiada (**Evaluar mi respuesta**) y luego la pestaña **🎯 Simulación** → **Comenzar simulación** → contestar las 3 preguntas → mostrar la **calificación /10** y las **observaciones de mejora**.

> Cierre: *"En menos de 2 minutos, Diego pasó de 'tengo proyectos pero no sé cómo venderlos' a tener un CV técnico, 3 vacantes compatibles con su stack y una entrevista practicada."*

---

## Estructura del proyecto

```
Hackaton/
├── index.html          # La página (flujo de CV en 5 pasos + flujo de entrevista + panel de agentes)
├── css/estilos.css     # Estilos: paleta y tipografías para aprendizaje
├── js/
│   ├── app.js          # Lógica de la interfaz, cuentas y conexión con los agentes
│   ├── cuentas.js      # Cuentas: en el navegador (localStorage) o en el servidor si está corriendo
│   ├── cv-latex.js     # CV con la plantilla LaTeX (.tex, Overleaf y versión imprimible)
│   ├── problemas.js    # 10 problemas tipo LeetCode con pistas, solución explicada y código
│   ├── motor-local.js  # Los 4 agentes simulados (modo demo, sin internet)
│   └── vacantes.js     # 30 vacantes de tecnología (empresas ficticias inspiradas en tipos de empresas reales)
├── servidor.py         # Servidor local + agentes con Claude (opcional) + API de cuentas
├── cuentas.py          # Cuentas: usuarios, contraseñas (hash), sesiones y CV guardados (SQLite)
├── datos/              # Se crea al usar cuentas: despega.db (NO se sube a git)
├── requirements.txt    # Dependencia para la IA real (anthropic)
├── iniciar.bat         # Doble clic para iniciar el servidor en Windows
└── README.md
```

**Arquitectura:** cada agente es una llamada a la IA con sus propias instrucciones y un **esquema JSON** de salida. Los agentes se pasan el resultado en cadena: Perfil → Vacantes → CV → Entrevista. El motor local devuelve **exactamente el mismo JSON**, así la interfaz no distingue entre modos.

**Vacantes:** 30 vacantes en `js/vacantes.js` para prácticas profesionales, becario, trainee y junior: backend, frontend, full stack, móvil, datos, machine learning, QA, DevOps/SRE, ciberseguridad, soporte, videojuegos y sistemas embebidos, en CDMX, Guadalajara, Monterrey, Querétaro, Aguascalientes, León, Mérida y remoto. Las **empresas son ficticias**, cada una inspirada en un tipo de empresa real del sector (fintech, e-commerce, consultora nearshore, banca en transformación digital, SaaS, startups de IA, manufactura automotriz, govtech…), indicado en el campo `sector`. Los **sueldos son rangos aproximados** (brutos mensuales) para la demo. No se usan nombres de empresas reales para no atribuirles vacantes ni sueldos inventados.

**Datos:** las vacantes viven en `js/vacantes.js`. Sin cuenta (modo invitado), el perfil solo vive en la memoria del navegador y no se guarda nada.

**Cuentas:** al abrir Despega aparece la pantalla de acceso para **iniciar sesión** o **crear cuenta** con nombre completo y contraseña (también se puede **continuar sin cuenta**). Funciona **con solo abrir la página**: no hace falta el servidor.
- Con sesión iniciada se guardan automáticamente los datos del paso 1 (edad, historia, contacto, estudios), los proyectos y logros del paso 3, y **cada CV adaptado**.
- Al volver a entrar, Despega se llena solo con esos datos. **Autoguardado:** todo tu avance (campos, pasos, vacantes, CV, práctica y simulación) se guarda solo mientras usas Despega, así que al **recargar la página** o cambiar de pestaña sigues donde ibas. Con sesión iniciada, los datos del paso 1 y tus proyectos y logros también se guardan en tu cuenta. La sesión **solo se cierra al cerrar la pestaña o el navegador** (o con «Cerrar sesión»); al volver a abrir Despega hay que iniciar sesión de nuevo.
- Cada **simulación de entrevista** terminada se guarda en el **historial de calificaciones**: calificación, veredicto, fortalezas, observaciones de mejora y cada respuesta.
- En **Mi cuenta** está el historial (simulaciones, promedio, mejor y última calificación con su cambio, una gráfica de las últimas 12 y el detalle de cada una, que se puede eliminar).
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

- **Navegador:** cualquier navegador moderno (Chrome, Edge, Firefox o Safari).
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
