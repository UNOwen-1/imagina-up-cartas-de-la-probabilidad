// Motor local de Despega: simula a los 4 agentes sin internet ni API key.
// Devuelve exactamente el mismo formato JSON que los agentes con IA real (servidor.py),
// así la interfaz funciona igual en los dos modos.
(function () {
  "use strict";

  // Catálogo de habilidades: nombre, tipo, patrones (sin acentos, en minúsculas) y una sugerencia para aprenderla.
  const CATALOGO = [
    { nombre: "Atención al cliente", categoria: "blanda", patrones: ["client", "atiend", "atender", "atencion", "mostrador"], curso: "Curso gratuito en línea de servicio al cliente (3–4 horas) y practica con un familiar el saludo y la despedida." },
    { nombre: "Ventas", categoria: "blanda", patrones: ["vend", "ventas", " venta", "comision"], curso: "Video-curso gratuito de técnicas de venta básicas; practica cómo presentar un producto en 30 segundos." },
    { nombre: "Marketing digital", categoria: "técnica", patrones: ["redes", "instagram", "tiktok", "facebook", "marketing", "publicidad", "anuncio", "seguidores"], curso: "Certificado gratuito de fundamentos de marketing digital (hay varios en plataformas abiertas)." },
    { nombre: "Creación de contenido", categoria: "técnica", patrones: ["video", "reels", "contenido", "youtube", "publicaciones", "publico", "stream"], curso: "Crea 3 publicaciones de ejemplo para un negocio real y guárdalas como portafolio." },
    { nombre: "Fotografía y video", categoria: "técnica", patrones: ["foto", "camara", "edito", "editar", "capcut", "grabo", "grabar"], curso: "Tutorial gratuito de edición de video en celular; arma un mini portafolio de 3 videos." },
    { nombre: "Excel", categoria: "técnica", patrones: ["excel", "hoja de calculo", "hojas de calculo", "sheets"], curso: "Curso gratuito de Excel básico: fórmulas SUMA, PROMEDIO, filtros y tablas (4–6 horas)." },
    { nombre: "Control de inventario", categoria: "técnica", patrones: ["inventario", "almacen", "stock", "mercancia", "surtir", "surto"], curso: "Aprende conceptos básicos de inventario: entradas, salidas y conteo físico." },
    { nombre: "Manejo de efectivo", categoria: "técnica", patrones: ["caja", "cobr", "efectivo", "dar cambio", "corte de"], curso: "Practica cortes de caja y cuadre de efectivo con un ejercicio en Excel." },
    { nombre: "Organización de eventos", categoria: "blanda", patrones: ["evento", "fiesta", "kermes", "torneo", "boda", "xv "], curso: "Planea un evento pequeño (cumpleaños, torneo) con presupuesto y lista de tareas." },
    { nombre: "Organización", categoria: "blanda", patrones: ["organiz", "agenda", "planeo", "planear", "ordeno", "acomodo"], curso: "Usa una herramienta gratuita de tareas (tablero Kanban) para organizar tu semana." },
    { nombre: "Trabajo en equipo", categoria: "blanda", patrones: ["equipo", "en grupo", "mi grupo", "junto con", "companer", "entre todos"], curso: "Participa en un proyecto grupal o voluntariado y anota tu rol y resultados." },
    { nombre: "Liderazgo", categoria: "blanda", patrones: ["capitan", "lider", "coordin", "encargad", "jefe de grupo", "represent", "dirig"], curso: "Toma un rol de coordinación en un proyecto escolar o comunitario." },
    { nombre: "Comunicación", categoria: "blanda", patrones: ["explic", "convenc", "platic", "hablar con", "hablo con", "negocie", "negociar"], curso: "Practica explicar algo complejo en 1 minuto y grábate para mejorar." },
    { nombre: "Enseñanza", categoria: "blanda", patrones: ["ensen", "clases", "tutor", "asesor", "regulariz", "tareas", "tarea a"], curso: "Ofrece una asesoría gratuita a un compañero y pide retroalimentación." },
    { nombre: "Programación", categoria: "técnica", patrones: ["program", "codigo", "python", "javascript", "html", "pagina web", "paginas web", "app "], curso: "Curso gratuito de HTML, CSS y JavaScript; publica una página sencilla como portafolio." },
    { nombre: "Diseño gráfico", categoria: "técnica", patrones: ["disen", "canva", "photoshop", "logo", "ilustr", "flyer", "cartel"], curso: "Rediseña 3 carteles de negocios locales con una herramienta gratuita de diseño." },
    { nombre: "Inglés", categoria: "técnica", patrones: ["ingles", "english"], curso: "Practica 15 minutos diarios con una app gratuita de idiomas y busca un club de conversación." },
    { nombre: "Logística y reparto", categoria: "técnica", patrones: ["repart", "entreg", "mandado", "envio", "paquete", "moto", "bici"], curso: "Aprende a planear rutas con mapas en línea y a registrar entregas." },
    { nombre: "Puntualidad", categoria: "blanda", patrones: ["temprano", "puntual", "todos los dias", "diario", "cada manana"], curso: "Menciona en tu entrevista un compromiso que has cumplido de forma constante." },
    { nombre: "Preparación de alimentos", categoria: "técnica", patrones: ["cocin", "comida", "tacos", "postre", "panader", "reposter", "restaurante", "mesero", "pasteles"], curso: "Tramita un curso gratuito de manejo higiénico de alimentos." },
    { nombre: "Soporte técnico", categoria: "técnica", patrones: ["arregl", "reparar", "reparo", "compu", "celular", "instal", "formate", "tecnico"], curso: "Curso gratuito de fundamentos de soporte de TI (hardware, redes y sistemas)." },
    { nombre: "Redacción", categoria: "técnica", patrones: ["escrib", "redact", "blog", "articulo", "ensayo", "correos"], curso: "Escribe 3 textos cortos (correo formal, descripción de producto, post) como portafolio." },
    { nombre: "Presentaciones", categoria: "blanda", patrones: ["presentacion", "exposicion", "expuse", "expongo", "diapositiva"], curso: "Prepara una presentación de 5 diapositivas sobre un tema que domines." },
    { nombre: "Gestión de pedidos", categoria: "técnica", patrones: ["pedido", "whatsapp", "encargo", "ordenes"], curso: "Organiza pedidos en una hoja de cálculo con estado: pendiente, enviado, entregado." },
    { nombre: "Responsabilidad", categoria: "blanda", patrones: ["cuido", "cuidar", "responsab", "me encargo", "estoy a cargo", "me hago cargo"], curso: "Menciona en tu CV una responsabilidad que tengas de forma continua y su resultado." },
    { nombre: "Cuidado de personas", categoria: "blanda", patrones: ["cuido a", "cuidar a", "abuel", "bebe", "adulto mayor", "adultos mayores"], curso: "Curso gratuito de primeros auxilios básicos." },
    { nombre: "Compromiso social", categoria: "blanda", patrones: ["voluntari", "iglesia", "comunidad", "ong", "donacion", "colecta", "brigada"], curso: "Registra tus horas de voluntariado y pide una constancia." },
    { nombre: "Análisis de datos", categoria: "técnica", patrones: ["datos", "estadistic", "grafica", "encuesta", "reporte", "metricas"], curso: "Curso gratuito de introducción al análisis de datos con hojas de cálculo." },
    { nombre: "Resolución de problemas", categoria: "blanda", patrones: ["resolv", "solucion", "problema", "queja"], curso: "Prepara 2 ejemplos de problemas que resolviste usando el método: situación, acción, resultado." },
    { nombre: "Aprendizaje rápido", categoria: "blanda", patrones: ["aprend", "autodidact", "tutorial", "por mi cuenta", "curso"], curso: "Toma un curso corto gratuito y termina con un certificado o proyecto." },
    { nombre: "Creatividad", categoria: "blanda", patrones: ["creativ", "manualidad", "dibuj", "pint", "musica", "invent"], curso: "Arma un portafolio con 3 trabajos creativos que hayas hecho." }
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
    return /^(Excel|Inglés)$/.test(nombre) ? nombre : nombre.toLowerCase();
  }

  // Elige la habilidad del perfil más relevante para la vacante (o la primera).
  function habilidadClave(perfil, vacante) {
    const requeridas = vacante.habilidades.map(normalizar);
    return perfil.habilidades.find(function (h) { return requeridas.indexOf(normalizar(h.nombre)) !== -1; }) ||
      perfil.habilidades[0] || { nombre: "Responsabilidad", evidencia: "Busco mi primer empleo con muchas ganas de aprender" };
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

    // Prioriza habilidades técnicas y limita a 8 para que el CV sea claro.
    const orden = { "técnica": 0, "blanda": 1 };
    encontradas.sort(function (a, b) { return orden[a.categoria] - orden[b.categoria]; });
    let habilidades = encontradas.slice(0, 10);

    if (habilidades.length < 2) {
      const primera = partes[0] ? recortar(partes[0], 110) : "Lo contaste en tu historia";
      habilidades.push({ nombre: "Responsabilidad", categoria: "blanda", evidencia: primera });
      habilidades.push({ nombre: "Aprendizaje rápido", categoria: "blanda", evidencia: "Estás buscando activamente tu primer empleo y preparándote" });
      habilidades = habilidades.filter(function (h, i, arr) {
        return arr.findIndex(function (x) { return x.nombre === h.nombre; }) === i;
      });
    }

    const top = habilidades.slice(0, 3).map(function (h) { return enFrase(h.nombre); });
    const edad = datos.edad ? datos.edad + " años, " : "";
    const resumen =
      "Persona joven (" + edad + "sin experiencia formal) con experiencia práctica en " + lista(top) +
      ". Aprende rápido, es constante y busca su primer empleo formal para aportar lo que ya sabe hacer y seguir creciendo.";

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
          consejo: info ? info.curso : "Prepara un ejemplo concreto de cada habilidad para la entrevista."
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
      ", que he desarrollado en situaciones reales. Me interesa aportar en un equipo como el suyo, aprender rápido y crecer con la empresa.";

    const logros = ordenadas.slice(0, 4).map(function (h) {
      return h.nombre + ": " + h.evidencia.charAt(0).toUpperCase() + h.evidencia.slice(1);
    });

    const cambios = [
      "Puse primero las habilidades que pide la vacante (" + (relevantes.map(function (h) { return h.nombre; }).join(", ") || "las más cercanas al puesto") + ").",
      "Reescribí tu resumen mencionando el puesto y la empresa.",
      "Convertí tus experiencias informales en logros concretos con evidencia."
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
      { pregunta: "Para empezar, háblame de ti: ¿quién eres y por qué te postulas como {puesto}?", que_busca: "Que te presentes con seguridad en 1 minuto y conectes tu historia con el puesto." },
      { pregunta: "¿Qué sabes de {empresa} y por qué te gustaría trabajar con nosotros?", que_busca: "Que hayas investigado la empresa y tengas un motivo real para elegirla." },
      { pregunta: "Si tuvieras que describirte en tres palabras, ¿cuáles serían y por qué?", que_busca: "Autoconocimiento y que respaldes cada palabra con un ejemplo." }
    ],
    experiencia: [
      { pregunta: "¿Cuál dirías que es tu mayor fortaleza para este puesto? Dame un ejemplo de cuándo la usaste.", que_busca: "Una fortaleza relevante demostrada con una situación real y su resultado." },
      { pregunta: "Cuéntame de una vez que trabajaste en equipo para lograr algo. ¿Cuál fue tu papel?", que_busca: "Colaboración: qué aportaste tú, cómo te coordinaste y qué lograron." },
      { pregunta: "Háblame de un reto o problema que hayas resuelto, en la escuela, tu casa o un negocio. ¿Qué hiciste?", que_busca: "Iniciativa y forma de resolver problemas, con un resultado concreto." },
      { pregunta: "¿Qué es algo que estés mejorando de ti y qué estás haciendo para lograrlo?", que_busca: "Honestidad y madurez: reconocer un área de mejora y un plan para trabajarla." }
    ],
    situacional: [
      { pregunta: "Imagina que en tu primera semana en {empresa} tienes varias tareas urgentes al mismo tiempo. ¿Cómo decides qué hacer primero?", que_busca: "Organización, criterio para priorizar y saber pedir apoyo." },
      { pregunta: "Un cliente o compañero se molesta contigo por un error que no fue tuyo. ¿Qué haces?", que_busca: "Manejo de emociones, empatía y enfoque en la solución." },
      { pregunta: "Te piden algo que nunca has hecho y tu jefe no está disponible. ¿Cómo lo resuelves?", que_busca: "Iniciativa, aprendizaje rápido y responsabilidad para avisar y preguntar." }
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
        { pregunta: "Cuéntame de una situación real en la que usaste tu habilidad de " + h + ". ¿Qué hiciste y qué resultado tuviste?", que_busca: "Un ejemplo concreto: situación, lo que hiciste y el resultado." },
        { pregunta: "Este es tu primer empleo formal. Si te piden algo que no sabes hacer, ¿cómo lo resuelves?", que_busca: "Actitud de aprendizaje, iniciativa y que sepas pedir ayuda." }
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
      tieneEjemplo: /(una vez|por ejemplo|cuando |el ano pasado|en mi |me toco|tuve que)/.test(n),
      tieneResultado: /(logr|result|aument|mejor|consegu|gracias a|termin|\d)/.test(n),
      mencionaPuesto: n.indexOf(normalizar(vacante.empresa).split(" ")[0]) !== -1 ||
        n.indexOf(normalizar(vacante.puesto).split(" ")[0]) !== -1,
      actitud: /(aprend|pregunt|investig|practic|me esfuerz|ganas)/.test(n)
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

  // ---------- Agente 4: Entrenador (simulación completa) ----------
  // Evalúa las 3 respuestas juntas: calificación de 1 a 10, fortalezas, mejoras y comentario por pregunta.
  function entrenador_simulacion(datos) {
    const v = datos.vacante;
    const respuestas = datos.respuestas || [];
    const evaluaciones = respuestas.map(function (r) {
      return entrenador_evaluar({ pregunta: r.pregunta, respuesta: r.respuesta, vacante: v, perfil: datos.perfil });
    });
    const analisis = respuestas.map(function (r) { return analizarRespuesta(r.respuesta, v); });
    const total = analisis.length || 1;
    const cuenta = function (k) { return analisis.filter(function (a) { return a[k]; }).length; };
    const promPalabras = Math.round(analisis.reduce(function (s, a) { return s + a.palabras; }, 0) / total);
    const promPuntaje = evaluaciones.reduce(function (s, e) { return s + e.puntaje; }, 0) / total;
    const calificacion = Math.max(1, Math.min(10, Math.round(promPuntaje * 2)));

    const fortalezas = [];
    if (cuenta("tieneEjemplo") >= 2) fortalezas.push("Respaldaste tus respuestas con ejemplos reales en " + cuenta("tieneEjemplo") + " de " + total + " preguntas.");
    if (cuenta("tieneResultado") >= 2) fortalezas.push("Cerraste con resultados concretos: eso hace creíble lo que dices.");
    if (cuenta("mencionaPuesto") >= 1) fortalezas.push("Conectaste tus respuestas con " + v.empresa + " y el puesto.");
    if (cuenta("actitud") >= 1) fortalezas.push("Mostraste ganas de aprender, algo que las empresas valoran mucho en un primer empleo.");
    if (promPalabras >= 35 && promPalabras <= 160) fortalezas.push("Tus respuestas tuvieron una buena extensión (unas " + promPalabras + " palabras en promedio).");
    if (!fortalezas.length) fortalezas.push("Completaste la simulación de principio a fin: practicar así ya te da ventaja sobre quien llega sin prepararse.");

    const mejoras = [];
    if (promPalabras < 30) mejoras.push("Desarrolla más tus respuestas: promediaste " + promPalabras + " palabras. Apunta a 40–100 (entre 30 segundos y 1 minuto hablando).");
    if (promPalabras > 160) mejoras.push("Sé más concreto: tus respuestas fueron largas. Ve directo a la situación, lo que hiciste y el resultado.");
    if (cuenta("tieneEjemplo") < 2) mejoras.push("Usa el método SAR: cuenta una Situación real, la Acción que tomaste tú y el Resultado. Empieza con «Una vez, en…».");
    if (cuenta("tieneResultado") < 2) mejoras.push("Termina cada historia con un resultado o aprendizaje, de preferencia con un número («atendí a más de 30 clientes al día»).");
    if (!cuenta("mencionaPuesto")) mejoras.push("Investiga " + v.empresa + " antes de la entrevista y menciona por qué te interesa ese lugar y el puesto de " + v.puesto + ".");
    if (!cuenta("actitud")) mejoras.push("Muestra tu disposición a aprender: di cómo te preparas o qué harías para aprender lo que aún no sabes.");
    mejoras.push("Ensaya en voz alta y cuida tu lenguaje corporal: contacto visual, postura derecha y una sonrisa al saludar.");

    const veredicto = calificacion >= 9 ? "¡Excelente! Llegarías a la entrevista con mucha seguridad."
      : calificacion >= 7 ? "¡Muy bien! Con un par de ajustes tus respuestas van a destacar."
      : calificacion >= 5 ? "Vas por buen camino. Practica las mejoras y repite la simulación."
      : "Es un buen inicio. Lee la sección de aprendizaje, usa el método SAR y vuelve a intentarlo.";

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
    entrenador_simulacion: entrenador_simulacion
  };
})();
