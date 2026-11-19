// Motor local de Despega: simula a los 4 agentes sin internet ni API key.
// Devuelve exactamente el mismo formato JSON que los agentes con IA real (servidor.py),
// así la interfaz funciona igual en los dos modos.
(function () {
  "use strict";

  // Catálogo de habilidades para ciencias computacionales: nombre, tipo, patrones (sin acentos, en minúsculas)
  // que el Perfilador busca en la historia, y una sugerencia gratuita para aprenderla.
  const CATALOGO = [
    // --- Técnicas ---
    { nombre: "Python", categoria: "técnica", patrones: ["python", "django", "flask", "fastapi", "pandas", "numpy", "jupyter"], curso: "Resuelve ejercicios de Python en Exercism y publica en GitHub un proyecto pequeño con README y pruebas." },
    { nombre: "Java", categoria: "técnica", patrones: ["java ", "java,", "java.", "java)", "en java", "spring", "kotlin", "jvm"], curso: "Repasa POO y colecciones con la documentación oficial de Java y arma una API sencilla con Spring Boot." },
    { nombre: "JavaScript", categoria: "técnica", patrones: ["javascript", "node", "express", " js ", "js,", "ecmascript"], curso: "Completa la ruta de JavaScript de freeCodeCamp o The Odin Project y publica un proyecto en GitHub Pages." },
    { nombre: "TypeScript", categoria: "técnica", patrones: ["typescript"], curso: "Lee el handbook oficial de TypeScript y migra a TypeScript un proyecto tuyo de JavaScript." },
    { nombre: "C/C++", categoria: "técnica", patrones: ["c++", "cpp", "lenguaje c ", "lenguaje c,", " en c ", "c/c++", "unreal", "arduino", "embebid"], curso: "Practica punteros, memoria y STL resolviendo problemas en Codeforces o Exercism en C++." },
    { nombre: "C# y .NET", categoria: "técnica", patrones: ["c#", ".net", "csharp", "unity"], curso: "Sigue los tutoriales gratuitos de Microsoft Learn de C# y crea una API mínima con ASP.NET Core." },
    { nombre: "SQL", categoria: "técnica", patrones: ["sql", "mysql", "postgres", "base de datos", "bases de datos", "consulta", "sqlite", "oracle"], curso: "Practica consultas con JOIN, GROUP BY y subconsultas en SQLBolt o con un dataset público en PostgreSQL." },
    { nombre: "Git y GitHub", categoria: "técnica", patrones: ["git ", "git,", "git.", "github", "gitlab", "pull request", "control de versiones", "repositorio", "commit"], curso: "Haz el curso interactivo Learn Git Branching y contribuye con un pull request a un proyecto de código abierto." },
    { nombre: "Estructuras de datos y algoritmos", categoria: "técnica", patrones: ["algoritm", "estructuras de datos", "estructura de datos", "leetcode", "icpc", "programacion competitiva", "codeforces", "omegaup", "olimpiada de informatica", "hackerrank", "complejidad"], curso: "Resuelve 2 problemas al día en LeetCode o Codeforces y repasa complejidad (Big O) con CS50." },
    { nombre: "Desarrollo web frontend", categoria: "técnica", patrones: ["react", "angular", "vue.js", "vuejs", " vue ", "frontend", "front-end", "html", "css", "pagina web", "paginas web", "sitio web", "tailwind", "interfaz web"], curso: "Construye un proyecto en React con buenas prácticas de accesibilidad y despliégalo gratis (Netlify o GitHub Pages)." },
    { nombre: "Desarrollo backend y APIs", categoria: "técnica", patrones: ["backend", "back-end", " api", "apis", "api rest", "restful", "endpoint", "microservicio", "graphql", "servidor web"], curso: "Diseña una API REST con autenticación, validaciones y documentación OpenAPI, y publícala en GitHub." },
    { nombre: "Desarrollo móvil", categoria: "técnica", patrones: ["android", " ios", "ios ", "swift", "flutter", "react native", "app movil", "aplicacion movil", "apps moviles"], curso: "Sigue el curso gratuito de Android (Kotlin) de Google o el codelab de Flutter y publica una app sencilla." },
    { nombre: "Docker y contenedores", categoria: "técnica", patrones: ["docker", "contenedor", "kubernetes", "k8s", "compose"], curso: "Conteneriza uno de tus proyectos con Docker y docker-compose siguiendo la guía oficial «Get started»." },
    { nombre: "Nube (AWS/Azure/GCP)", categoria: "técnica", patrones: ["aws", "azure", "gcp", "google cloud", "nube", "cloud", "lambda", "firebase", "ec2", "s3"], curso: "Toma los cursos gratuitos de fundamentos en AWS Skill Builder o Microsoft Learn y despliega un proyecto en la capa gratuita." },
    { nombre: "Linux y terminal", categoria: "técnica", patrones: ["linux", "bash", "terminal", "ubuntu", "shell", "consola", "ssh"], curso: "Practica comandos y permisos con los juegos de OverTheWire (Bandit) y automatiza una tarea con un script de Bash." },
    { nombre: "Pruebas de software", categoria: "técnica", patrones: ["prueba", "testing", "pytest", "junit", "jest", "selenium", "cypress", "unitari", " qa", "tdd", "cobertura"], curso: "Agrega pruebas unitarias (pytest o Jest) a un proyecto tuyo y mide la cobertura." },
    { nombre: "Machine Learning", categoria: "técnica", patrones: ["machine learning", "aprendizaje automatico", "red neuronal", "redes neuronales", "scikit", "tensorflow", "pytorch", "clasific", "regresion", "deep learning", "nlp", "vision por computadora", "modelo de ia", "inteligencia artificial", "random forest"], curso: "Haz los cursos gratuitos de Kaggle Learn y publica un notebook con un modelo y su evaluación." },
    { nombre: "Análisis de datos", categoria: "técnica", patrones: ["analisis de datos", "ciencia de datos", "dataset", "dashboard", "tablero", "power bi", "tableau", "estadistic", "visualiz", "metricas", "excel"], curso: "Analiza un dataset público (datos.gob.mx o Kaggle) y publica un tablero en Power BI o Looker Studio con tus conclusiones." },
    { nombre: "Ciberseguridad", categoria: "técnica", patrones: ["segurid", "ciberseg", "pentest", "vulnerab", "ctf", "owasp", "cifrado", "criptograf", "hacking etico"], curso: "Practica en TryHackMe (rutas gratuitas) o en CTF para principiantes y estudia el OWASP Top 10." },
    { nombre: "Redes y soporte técnico", categoria: "técnica", patrones: ["redes de computadoras", "tcp", "cisco", "ccna", "soporte tecnico", "mesa de ayuda", "help desk", "infraestructura", "router", "configure equipos"], curso: "Toma un curso introductorio gratuito de Cisco Networking Academy y practica con Packet Tracer." },
    { nombre: "CI/CD y DevOps", categoria: "técnica", patrones: ["ci/cd", "github actions", "jenkins", "pipeline", "devops", "despliegue", "deploy", "desplegu", "terraform", "integracion continua"], curso: "Configura GitHub Actions en un proyecto tuyo para correr pruebas y desplegar automáticamente." },
    { nombre: "Inglés técnico", categoria: "técnica", patrones: ["ingles", "english", "toefl", "documentacion en ingles"], curso: "Lee documentación oficial en inglés a diario y practica explicar tus proyectos en inglés en voz alta (5 minutos)." },
    { nombre: "Metodologías ágiles (Scrum)", categoria: "técnica", patrones: ["scrum", "agil", "sprint", "kanban", "jira", "trello", "daily"], curso: "Lee la Guía Scrum oficial (gratuita) y organiza tu próximo proyecto en sprints con un tablero Kanban." },
    // --- Blandas ---
    { nombre: "Trabajo en equipo", categoria: "blanda", patrones: ["equipo", "en grupo", "colabor", "companer", "junto con", "entre todos"], curso: "Participa en un hackatón o en un proyecto de código abierto y anota tu rol y lo que aportaste." },
    { nombre: "Comunicación", categoria: "blanda", patrones: ["expuse", "exposicion", "presente", "presentacion", "explic", "document", "conferencia", "platica", "redacte"], curso: "Escribe un post técnico sobre un proyecto tuyo y practica explicarlo en 2 minutos a alguien no técnico." },
    { nombre: "Resolución de problemas", categoria: "blanda", patrones: ["resolv", "solucion", "bug", "depur", "debug", "problema", "optimic", "corregi"], curso: "Prepara 2 ejemplos de bugs o problemas que resolviste con el método situación–acción–resultado." },
    { nombre: "Aprendizaje rápido", categoria: "blanda", patrones: ["aprend", "autodidact", "curso", "por mi cuenta", "certific", "tutorial", "coursera", "edx", "platzi"], curso: "Termina un curso corto gratuito con proyecto final y agrégalo a tu portafolio." },
    { nombre: "Liderazgo", categoria: "blanda", patrones: ["lider", "coordin", "capitan", "jefe de", "dirig", "presidente", "encargad"], curso: "Toma el rol de líder técnico en un proyecto escolar o hackatón y documenta cómo repartiste el trabajo." },
    { nombre: "Enseñanza y mentoría", categoria: "blanda", patrones: ["ensen", "tutorias", "soy tutor", "tutor de", "tutora de", "asesor", "mentor", "coach", "doy clases", "di clases", "ayudante de profesor"], curso: "Da una asesoría o taller a compañeros de semestres anteriores y pide retroalimentación." },
    { nombre: "Gestión del tiempo", categoria: "blanda", patrones: ["fecha limite", "deadline", "al mismo tiempo", "mientras estudio", "medio tiempo", "entregas", "a la par"], curso: "Planea tu semana con bloques de tiempo y un tablero de tareas; mide cuánto te tomó cada entrega." },
    { nombre: "Pensamiento analítico", categoria: "blanda", patrones: ["analic", "matemat", "logica", "razonamiento", "investigacion", "tesis"], curso: "Resuelve acertijos lógicos y problemas de matemáticas discretas; explica por escrito tu razonamiento." },
    { nombre: "Creatividad", categoria: "blanda", patrones: ["creativ", "innov", "hackat", "disen"], curso: "Propón y prototipa en un fin de semana una solución tecnológica a un problema de tu comunidad." },
    { nombre: "Compromiso social", categoria: "blanda", patrones: ["voluntari", "servicio social", "comunidad", "ong", "sin fines de lucro"], curso: "Ofrece tus habilidades a una organización sin fines de lucro (por ejemplo, un sitio web o una base de datos)." }
  ];

  const porNombre = {};
  CATALOGO.forEach(function (h) { porNombre[normalizar(h.nombre)] = h; });

  function normalizar(texto) {
    return String(texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function fragmentos(historia) {
    return String(historia || "")
      .split(/[.;!?\n]+|,\s+(?:y\s+)?(?=[a-záéíóúñ])/i)
      .map(function (f) { return f.trim(); })
      .filter(function (f) { return f.length > 3; });
  }

  function recortar(texto, max) {
    texto = texto.trim();
    return texto.length > max ? texto.slice(0, max - 1).trim() + "…" : texto;
  }

  // Minúsculas para usar un nombre de habilidad dentro de una frase (respeta nombres propios).
  function enFrase(nombre) {
    // Lenguajes y tecnologías conservan su escritura (Python, SQL, Git…); en lo demás solo la primera letra
    // pasa a minúscula, para respetar siglas como APIs o AWS ("desarrollo backend y APIs").
    if (/^(Python|Java|JavaScript|TypeScript|C\/C\+\+|C# y \.NET|SQL|Git|Docker|Linux|Machine|Inglés|CI\/CD)/.test(nombre)) return nombre;
    return nombre.charAt(0).toLowerCase() + nombre.slice(1);
  }

  // Elige la habilidad del perfil más relevante para la vacante (o la primera).
  function habilidadClave(perfil, vacante) {
    const requeridas = vacante.habilidades.map(normalizar);
    return perfil.habilidades.find(function (h) { return requeridas.indexOf(normalizar(h.nombre)) !== -1; }) ||
      perfil.habilidades[0] || { nombre: "Aprendizaje rápido", evidencia: "Busco mi primera oportunidad en tecnología con muchas ganas de aprender" };
  }

  function lista(items) {
    if (items.length <= 1) return items.join("");
    return items.slice(0, -1).join(", ") + " y " + items[items.length - 1];
  }

  // ---------- Agente 1: Perfilador ----------
  function perfilador(datos) {
    const partes = fragmentos(datos.historia);
    const encontradas = [];
    CATALOGO.forEach(function (h) {
      const frag = partes.find(function (p) {
        const n = normalizar(p);
        return h.patrones.some(function (pat) { return n.indexOf(pat) !== -1; });
      });
      if (frag) encontradas.push({ nombre: h.nombre, categoria: h.categoria, evidencia: recortar(frag, 110) });
    });

    // Hasta 7 técnicas y 3 blandas (las técnicas primero) para que el CV sea claro y equilibrado.
    const tecnicas = encontradas.filter(function (h) { return h.categoria === "técnica"; });
    const blandas = encontradas.filter(function (h) { return h.categoria === "blanda"; });
    const nBlandas = Math.min(blandas.length, 3, Math.max(10 - tecnicas.length, 3));
    let habilidades = tecnicas.slice(0, 10 - nBlandas).concat(blandas.slice(0, nBlandas));

    if (habilidades.length < 2) {
      const primera = partes[0] ? recortar(partes[0], 110) : "Lo contaste en tu historia";
      habilidades.push({ nombre: "Resolución de problemas", categoria: "blanda", evidencia: primera });
      habilidades.push({ nombre: "Aprendizaje rápido", categoria: "blanda", evidencia: "Estás buscando activamente tu primera oportunidad en tecnología y preparándote" });
      habilidades = habilidades.filter(function (h, i, arr) {
        return arr.findIndex(function (x) { return x.nombre === h.nombre; }) === i;
      });
    }

    const top = habilidades.slice(0, 3).map(function (h) { return enFrase(h.nombre); });
    const resumen =
      "Perfil en ciencias computacionales" + (datos.edad ? " (" + datos.edad + " años)" : "") + " con experiencia práctica en " + lista(top) +
      ", desarrollada en proyectos académicos, prácticas y proyectos personales. Busca su primera oportunidad profesional en tecnología para aportar y seguir creciendo.";

    return {
      nombre: datos.nombre || "Tu nombre",
      resumen_profesional: resumen,
      habilidades: habilidades
    };
  }

  // ---------- Agente 2: Buscador ----------
  function buscador(datos) {
    const habilidadesPerfil = datos.perfil.habilidades;
    const nombresPerfil = habilidadesPerfil.map(function (h) { return normalizar(h.nombre); });

    const evaluadas = datos.vacantes.map(function (v) {
      const coinciden = v.habilidades.filter(function (h) { return nombresPerfil.indexOf(normalizar(h)) !== -1; });
      const faltan = v.habilidades.filter(function (h) { return nombresPerfil.indexOf(normalizar(h)) === -1; });
      const pct = coinciden.length === 0 ? 0 : Math.min(96, Math.round(45 + 55 * (coinciden.length / v.habilidades.length)));
      return { vacante: v, coinciden: coinciden, faltan: faltan, compatibilidad: pct };
    });

    const mejores = evaluadas
      .filter(function (e) { return e.compatibilidad > 0; })
      .sort(function (a, b) { return b.compatibilidad - a.compatibilidad || a.faltan.length - b.faltan.length; })
      .slice(0, 3);

    return {
      recomendaciones: mejores.map(function (e) {
        const evid = habilidadesPerfil.find(function (h) { return normalizar(h.nombre) === normalizar(e.coinciden[0]); });
        const porQue =
          "Ya demostraste " + lista(e.coinciden.map(enFrase)) +
          ", justo lo que pide este puesto." + (evid ? " Por ejemplo: «" + evid.evidencia + "»." : "");
        const falta = e.faltan[0] || "";
        const info = falta ? porNombre[normalizar(falta)] : null;
        return {
          id: e.vacante.id,
          compatibilidad: e.compatibilidad,
          por_que: porQue,
          te_falta: falta ? falta : "¡Nada! Cumples con todo lo que piden.",
          consejo: info ? info.curso : "Prepara un proyecto o ejemplo concreto de cada habilidad para la entrevista técnica."
        };
      })
    };
  }

  // ---------- Agente 3: Adaptador de CV ----------
  function adaptador(datos) {
    const perfil = datos.perfil;
    const v = datos.vacante;
    const requeridas = v.habilidades.map(normalizar);

    const relevantes = perfil.habilidades.filter(function (h) { return requeridas.indexOf(normalizar(h.nombre)) !== -1; });
    const otras = perfil.habilidades.filter(function (h) { return requeridas.indexOf(normalizar(h.nombre)) === -1; });
    const ordenadas = relevantes.concat(otras).slice(0, 6);

    const claves = relevantes.length ? relevantes : perfil.habilidades.slice(0, 2);
    const resumen =
      "Perfil para el puesto de " + v.puesto + " en " + v.empresa + ". Cuento con experiencia práctica en " +
      lista(claves.map(function (h) { return enFrase(h.nombre); })) +
      ", que he aplicado en proyectos académicos, prácticas y proyectos personales. Me interesa sumarme a su equipo, aprender de código en producción y crecer como ingeniero(a) de software.";

    // Una viñeta por evidencia: si varias habilidades salen de la misma frase, se nombran juntas.
    const grupos = [];
    ordenadas.forEach(function (h) {
      const g = grupos.find(function (x) { return x.evidencia === h.evidencia; });
      if (g) g.nombres.push(h.nombre); else grupos.push({ evidencia: h.evidencia, nombres: [h.nombre] });
    });
    const logros = grupos.slice(0, 4).map(function (g) {
      return lista(g.nombres) + ": " + g.evidencia.charAt(0).toUpperCase() + g.evidencia.slice(1);
    });

    const cambios = [
      "Puse primero las habilidades que pide la vacante (" + (relevantes.map(function (h) { return h.nombre; }).join(", ") || "las más cercanas al puesto") + ").",
      "Reescribí tu resumen mencionando el puesto y la empresa.",
      "Convertí tus proyectos y experiencias en logros concretos con evidencia."
    ];
    const faltan = v.habilidades.filter(function (h) {
      return !perfil.habilidades.some(function (p) { return normalizar(p.nombre) === normalizar(h); });
    });
    if (faltan.length) cambios.push("No inventé nada: «" + faltan.join(", ") + "» no aparece en tu historia, así que no lo agregué.");

    return {
      resumen_adaptado: resumen,
      habilidades_destacadas: ordenadas.map(function (h) { return h.nombre; }),
      logros: logros,
      cambios: cambios
    };
  }

  // ---------- Agente 4: Entrenador (preguntas) ----------
  // Banco de preguntas para la simulación: una de cada tipo, elegidas al azar para que cada intento sea distinto.
  const BANCO_SIMULACION = {
    presentacion: [
      { pregunta: "Para empezar, háblame de ti: ¿qué estudias o estudiaste y por qué te postulas como {puesto}?", que_busca: "Que te presentes con seguridad en 1 minuto y conectes tu formación y tus proyectos con el puesto." },
      { pregunta: "¿Qué sabes de {empresa} y por qué te gustaría trabajar con nosotros?", que_busca: "Que hayas investigado la empresa, su producto y su tecnología, y tengas un motivo real." },
      { pregunta: "Cuéntame del proyecto que más te enorgullece: ¿qué construiste y qué decisiones técnicas tomaste?", que_busca: "Profundidad técnica: qué hiciste tú, por qué elegiste esa tecnología y qué aprendiste." }
    ],
    experiencia: [
      { pregunta: "Cuéntame de un bug difícil que hayas resuelto. ¿Cómo encontraste la causa?", que_busca: "Método de depuración: reproducir, aislar, probar hipótesis y verificar la solución." },
      { pregunta: "Háblame de un proyecto en equipo: ¿cómo se organizaron con Git y qué parte hiciste tú?", que_busca: "Colaboración técnica: ramas, pull requests, code review y tu aporte concreto." },
      { pregunta: "¿Cómo aprendiste la última tecnología que usaste en un proyecto?", que_busca: "Aprendizaje autodidacta: fuentes, práctica y cómo lo aplicaste." },
      { pregunta: "¿Cuál es tu mayor fortaleza técnica y qué estás mejorando ahora mismo?", que_busca: "Autoconocimiento con ejemplos y un plan concreto para tu área de mejora." }
    ],
    situacional: [
      { pregunta: "Imagina que tu código funciona en tu computadora pero falla en producción en {empresa}. ¿Qué pasos sigues?", que_busca: "Razonamiento ordenado: revisar logs, diferencias de entorno, reproducir y comunicar al equipo." },
      { pregunta: "¿Cómo le explicarías qué es una API a alguien del área de negocio que no es técnico?", que_busca: "Comunicación técnica clara, con analogías y sin jerga innecesaria." },
      { pregunta: "Te asignan una tarea con requisitos poco claros y una fecha de entrega cercana. ¿Qué haces?", que_busca: "Que aclares requisitos, propongas un alcance mínimo y avises riesgos a tiempo." },
      { pregunta: "Un compañero revisa tu pull request y te pide muchos cambios. ¿Cómo lo manejas?", que_busca: "Apertura a la retroalimentación, profesionalismo y aprendizaje en el code review." }
    ]
  };

  function alAzar(lista) { return lista[Math.floor(Math.random() * lista.length)]; }

  function rellenar(p, v) {
    return {
      pregunta: p.pregunta.replace("{puesto}", v.puesto).replace("{empresa}", v.empresa),
      que_busca: p.que_busca
    };
  }

  function entrenador_preguntas(datos) {
    const v = datos.vacante;
    if (datos.modo === "simulacion") {
      return { preguntas: ["presentacion", "experiencia", "situacional"].map(function (t) { return rellenar(alAzar(BANCO_SIMULACION[t]), v); }) };
    }
    const h = enFrase(habilidadClave(datos.perfil, v).nombre);
    return {
      preguntas: [
        { pregunta: "¿Por qué te interesa el puesto de " + v.puesto + " en " + v.empresa + "?", que_busca: "Que conozcas el puesto y tengas motivación real, no solo necesidad." },
        { pregunta: "Cuéntame de un proyecto en el que usaste " + h + ". ¿Qué hiciste tú y cuál fue el resultado?", que_busca: "Un ejemplo técnico concreto: la situación, tus decisiones y el resultado (de preferencia medible)." },
        { pregunta: "Es tu primer trabajo en tecnología y te asignan una tarea con una herramienta que nunca has usado. ¿Cómo la resuelves?", que_busca: "Aprendizaje autónomo: documentación, pruebas pequeñas y saber cuándo pedir ayuda al equipo." }
      ]
    };
  }

  // ---------- Agente 4: Entrenador (evaluación) ----------
  // Rasgos de una respuesta que se fijan los reclutadores (heurística del modo demo).
  function analizarRespuesta(respuesta, vacante) {
    const r = String(respuesta || "").trim();
    const n = normalizar(r);
    return {
      palabras: r ? r.split(/\s+/).length : 0,
      tieneEjemplo: /(una vez|por ejemplo|cuando |el ano pasado|en mi |me toco|tuve que|en el hackat|en mis practicas|durante )/.test(n),
      tieneResultado: /(logr|result|aument|mejor|consegu|gracias a|termin|redu|optimi|desplegu|public|\d)/.test(n),
      mencionaPuesto: n.indexOf(normalizar(vacante.empresa).split(" ")[0]) !== -1 ||
        n.indexOf(normalizar(vacante.puesto).split(" ")[0]) !== -1,
      actitud: /(aprend|pregunt|investig|practic|me esfuerz|ganas|document|retroaliment)/.test(n)
    };
  }

  function entrenador_evaluar(datos) {
    const a = analizarRespuesta(datos.respuesta, datos.vacante);
    const palabras = a.palabras, tieneEjemplo = a.tieneEjemplo, tieneResultado = a.tieneResultado;
    const mencionaPuesto = a.mencionaPuesto, actitud = a.actitud;

    let puntaje = 1;
    if (palabras >= 15) puntaje++;
    if (palabras >= 35) puntaje++;
    if (tieneEjemplo) puntaje++;
    if (tieneResultado || mencionaPuesto || actitud) puntaje++;
    puntaje = Math.max(1, Math.min(5, puntaje));

    const bueno = [];
    if (tieneEjemplo) bueno.push("diste un ejemplo concreto");
    if (tieneResultado) bueno.push("mencionaste un resultado");
    if (mencionaPuesto) bueno.push("conectaste tu respuesta con el puesto");
    if (actitud) bueno.push("mostraste actitud de aprendizaje");
    if (palabras >= 15 && !bueno.length) bueno.push("respondiste con seguridad y suficiente detalle");

    const mejorar = [];
    if (palabras < 15) mejorar.push("desarrolla más tu respuesta (apunta a 30–60 segundos)");
    if (!tieneEjemplo) mejorar.push("agrega un ejemplo real: «Una vez, en…»");
    if (!tieneResultado) mejorar.push("cierra con el resultado: qué lograste o qué aprendiste");
    if (!mencionaPuesto) mejorar.push("menciona por qué eso te sirve en " + datos.vacante.empresa);

    const h = habilidadClave(datos.perfil, datos.vacante);
    return {
      puntaje: puntaje,
      lo_bueno: bueno.length ? "Bien: " + lista(bueno) + "." : "Te animaste a responder, ¡eso ya es el primer paso!",
      mejorar: mejorar.length ? "Para mejorar: " + lista(mejorar) + "." : "¡Respuesta muy completa! Solo cuida no extenderte más de un minuto.",
      respuesta_ejemplo:
        "Te comparto un ejemplo real: «" + h.evidencia + "». Ahí puse en práctica mi habilidad de " + enFrase(h.nombre) +
        ": me organicé, pregunté lo que no sabía y logré sacarlo adelante de forma constante. " +
        "Eso es justo lo que quiero aportar como " + datos.vacante.puesto + " en " + datos.vacante.empresa +
        ", y además tengo muchas ganas de seguir aprendiendo."
    };
  }

  // ---------- Agente 4: Entrenador (problema técnico) ----------
  // Evalúa la EXPLICACIÓN de la lógica de una solución (no ejecuta código): idea clave, pasos,
  // casos borde y complejidad, como lo haría quien entrevista en una prueba técnica.
  function buscarProblema(datos) {
    return (window.PROBLEMAS || []).find(function (p) { return p.id === datos.problema_id; }) || null;
  }

  function entrenador_problema(datos) {
    const p = buscarProblema(datos);
    const texto = String(datos.respuesta || "").trim();
    const n = normalizar(texto);
    const palabras = texto ? texto.split(/\s+/).length : 0;
    const contiene = function (grupo) { return grupo.some(function (w) { return n.indexOf(w) !== -1; }); };
    const grupos = p ? p.conceptos : [];
    const ideaClave = grupos.length ? contiene(grupos[0]) : false;
    const pasosClave = grupos.slice(1).filter(contiene).length;
    const complejidad = /(o\(n|o\(1|o\(log|o \(n|lineal|logaritm|constante|cuadratic|complejidad)/.test(n);
    const casosBorde = /(vaci|caso borde|casos borde|casos limite|un solo|nulo|null|none|negativ|repetid|si no existe|no hay)/.test(n);
    const pasos = /(primero|luego|despues|recorr|por cada|mientras|itero|ciclo|si es|si no|al final)/.test(n);

    // 1 punto base + extensión + idea clave + un paso específico de ESTE problema + complejidad.
    // Así una explicación genérica (solo palabras clave) no llega a 5.
    let puntaje = 1;
    if (palabras >= 15) puntaje++;
    if (ideaClave) puntaje++;
    if (pasosClave >= 1) puntaje++;
    if (complejidad) puntaje++;
    puntaje = Math.max(1, Math.min(5, puntaje));

    const bueno = [];
    if (ideaClave) bueno.push("identificaste la idea clave de la solución");
    if (pasos) bueno.push("explicaste los pasos en orden");
    if (complejidad) bueno.push("mencionaste la complejidad");
    if (casosBorde) bueno.push("consideraste casos borde");

    const mejorar = [];
    if (palabras < 15) mejorar.push("explica con más detalle: qué estructura usas, cómo recorres los datos y qué devuelves");
    if (!ideaClave && p) mejorar.push("piensa en esta pista: «" + p.pistas[p.pistas.length - 1] + "»");
    if (!complejidad) mejorar.push("di la complejidad en tiempo y espacio (por ejemplo, O(n) y O(1))");
    if (!casosBorde) mejorar.push("menciona casos borde (entrada vacía, un solo elemento, repetidos)");

    return {
      puntaje: puntaje,
      lo_bueno: bueno.length ? "Bien: " + lista(bueno) + "." : "Te animaste a resolverlo: en la entrevista, explicar tu idea aunque tengas dudas vale mucho.",
      mejorar: mejorar.length ? "Para mejorar: " + lista(mejorar) + "." : "¡Explicación muy completa! En la entrevista, acompáñala probando tu idea con un ejemplo a mano."
    };
  }

  // ---------- Agente 4: Entrenador (simulación completa) ----------
  // Evalúa toda la entrevista (3 preguntas + 1 problema técnico): calificación de 1 a 10,
  // fortalezas, mejoras y comentario por pregunta.
  function entrenador_simulacion(datos) {
    const v = datos.vacante;
    const respuestas = datos.respuestas || [];
    const evaluaciones = respuestas.map(function (r) {
      if (r.tipo === "problema") {
        const e = entrenador_problema({ problema_id: r.problema_id, respuesta: r.respuesta });
        return { puntaje: e.puntaje, lo_bueno: e.lo_bueno, mejorar: e.mejorar };
      }
      return entrenador_evaluar({ pregunta: r.pregunta, respuesta: r.respuesta, vacante: v, perfil: datos.perfil });
    });
    const conductuales = respuestas.filter(function (r) { return r.tipo !== "problema"; });
    const analisis = conductuales.map(function (r) { return analizarRespuesta(r.respuesta, v); });
    const total = analisis.length || 1;
    const cuenta = function (k) { return analisis.filter(function (a) { return a[k]; }).length; };
    const promPalabras = Math.round(analisis.reduce(function (s, a) { return s + a.palabras; }, 0) / total);
    const promPuntaje = evaluaciones.reduce(function (s, e) { return s + e.puntaje; }, 0) / (evaluaciones.length || 1);
    const calificacion = Math.max(1, Math.min(10, Math.round(promPuntaje * 2)));

    const iProblema = respuestas.findIndex(function (r) { return r.tipo === "problema"; });
    const problema = iProblema !== -1 ? buscarProblema(respuestas[iProblema]) : null;
    const notaProblema = iProblema !== -1 ? evaluaciones[iProblema].puntaje : null;

    const fortalezas = [];
    if (problema && notaProblema >= 4) fortalezas.push("En el problema «" + problema.titulo + "» explicaste una solución clara y eficiente.");
    if (cuenta("tieneEjemplo") >= 2) fortalezas.push("Respaldaste tus respuestas con ejemplos reales en " + cuenta("tieneEjemplo") + " de " + total + " preguntas.");
    if (cuenta("tieneResultado") >= 2) fortalezas.push("Cerraste con resultados concretos: eso hace creíble lo que dices.");
    if (cuenta("mencionaPuesto") >= 1) fortalezas.push("Conectaste tus respuestas con " + v.empresa + " y el puesto.");
    if (cuenta("actitud") >= 1) fortalezas.push("Mostraste ganas de aprender, algo que los equipos de tecnología valoran mucho en perfiles junior.");
    if (promPalabras >= 35 && promPalabras <= 160) fortalezas.push("Tus respuestas tuvieron una buena extensión (unas " + promPalabras + " palabras en promedio).");
    if (!fortalezas.length) fortalezas.push("Completaste la simulación de principio a fin: practicar así ya te da ventaja sobre quien llega sin prepararse.");

    const mejoras = [];
    if (problema && notaProblema < 4) mejoras.push("Repasa el problema «" + problema.titulo + "» en Aprendizaje y práctica. La idea clave: «" + problema.idea[0] + "»");
    if (promPalabras < 30) mejoras.push("Desarrolla más tus respuestas: promediaste " + promPalabras + " palabras. Apunta a 40–100 (entre 30 segundos y 1 minuto hablando).");
    if (promPalabras > 160) mejoras.push("Sé más concreto: tus respuestas fueron largas. Ve directo a la situación, lo que hiciste y el resultado.");
    if (cuenta("tieneEjemplo") < 2) mejoras.push("Usa el método SAR con tus proyectos: la Situación (qué había que resolver), la Acción técnica que tomaste tú y el Resultado. Empieza con «En mi proyecto de…».");
    if (cuenta("tieneResultado") < 2) mejoras.push("Termina cada historia con un resultado medible o un aprendizaje («reduje el tiempo de respuesta de la API a la mitad»).");
    if (!cuenta("mencionaPuesto")) mejoras.push("Investiga " + v.empresa + " antes de la entrevista y menciona por qué te interesa ese lugar y el puesto de " + v.puesto.replace(/\.$/, "") + ".");
    if (!cuenta("actitud")) mejoras.push("Muestra tu disposición a aprender: di cómo te preparas o qué harías para aprender lo que aún no sabes.");
    mejoras.push("Ensaya en voz alta: explica tus proyectos como si los presentaras en una revisión técnica, y practica pensar en voz alta al resolver un problema.");

    const veredicto = calificacion >= 9 ? "¡Excelente! Llegarías a la entrevista con mucha seguridad."
      : calificacion >= 7 ? "¡Muy bien! Con un par de ajustes tus respuestas van a destacar."
      : calificacion >= 5 ? "Vas por buen camino. Practica las mejoras y repite la simulación."
      : "Es un buen inicio. Repasa la sección de aprendizaje y los problemas de práctica, y vuelve a intentarlo.";

    return {
      calificacion: calificacion,
      veredicto: veredicto,
      fortalezas: fortalezas.slice(0, 4),
      mejoras: mejoras.slice(0, 4),
      por_pregunta: evaluaciones.map(function (e) { return { puntaje: e.puntaje, comentario: e.lo_bueno + " " + e.mejorar }; })
    };
  }

  window.MotorLocal = {
    CATALOGO: CATALOGO,
    perfilador: perfilador,
    buscador: buscador,
    adaptador: adaptador,
    entrenador_preguntas: entrenador_preguntas,
    entrenador_evaluar: entrenador_evaluar,
    entrenador_simulacion: entrenador_simulacion,
    entrenador_problema: entrenador_problema
  };
})();
