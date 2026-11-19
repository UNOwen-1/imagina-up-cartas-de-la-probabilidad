// Despega · lógica de la interfaz
// Flujo: Historia → Perfilador → Buscador → Adaptador → Entrenador.
// Si servidor.py está corriendo con una API key, los agentes usan Claude; si no, usan el motor local.
(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const EJEMPLO = {
    nombre: "Diego Hernández",
    edad: 22,
    historia:
      "Estudio el último año de Ingeniería en Sistemas Computacionales. " +
      "En mis prácticas profesionales en una startup desarrollé una API REST en Python con FastAPI y PostgreSQL, y la desplegamos con Docker en AWS. " +
      "Mi proyecto final de bases de datos fue una aplicación web en React para administrar la biblioteca de la facultad; trabajamos en equipo con Git y GitHub usando pull requests. " +
      "En un hackatón de gobierno abierto mi equipo entrenó un modelo de machine learning para clasificar reportes ciudadanos y quedamos en segundo lugar. " +
      "Practico programación competitiva en Codeforces y doy asesorías de estructuras de datos a compañeros de semestres anteriores. " +
      "Leo documentación en inglés todos los días.",
    ciudad: "Guadalajara, MX",
    escuela: "Universidad Tecnológica Aurora",
    nivel: "Ingeniería en Sistemas Computacionales",
    periodo: "2022 – 2026"
  };

  // Campos opcionales del paso 1 que solo se usan para el CV.
  const CAMPOS_CV = ["#in-telefono", "#in-correo", "#in-ciudad", "#in-enlace", "#in-escuela", "#in-nivel", "#in-periodo"];

  const AGENTES = {
    perfilador: { emoji: "🧭", nombre: "Perfilador" },
    buscador: { emoji: "🔎", nombre: "Buscador" },
    adaptador: { emoji: "✍️", nombre: "Adaptador" },
    entrenador: { emoji: "🎤", nombre: "Entrenador" }
  };

  const estado = {
    modo: "local",
    paso: 1,
    perfil: null,          // { nombre, edad, historia, resumen_profesional, habilidades: [{nombre, categoria, evidencia}] }
    recomendaciones: [],   // [{ vacante, compatibilidad, por_que, te_falta, consejo }]
    vacante: null,
    cv: null,              // { resumen_adaptado, habilidades_destacadas, logros, cambios }
    contacto: {},          // { telefono, correo, ciudad, enlace } — solo para el CV, no se envía a la IA
    cuenta: null,          // { nombre, datos } si hay sesión iniciada
    cuentasDisponibles: false,
    invitado: false,       // true si la persona eligió "continuar sin cuenta"
    flujo: "cv",           // "cv" (pasos 1–5) o "entrevista" (entrenamiento aparte)
    entrevista: { vacante: null, perfil: null },  // vacante y perfil con los que se practica
    simulacion: { preguntas: [], i: 0, respuestas: [], resultado: null },
    preguntas: [],
    iPregunta: 0,
    puntajes: []
  };

  // ---------- Utilidades de DOM ----------
  function el(tag, props) {
    const nodo = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        const v = props[k];
        if (v == null || v === false) return;
        if (k === "class") nodo.className = v;
        else if (k === "text") nodo.textContent = v;
        else if (k === "style") nodo.style.cssText = v;
        else if (k.indexOf("on") === 0) nodo.addEventListener(k.slice(2), v);
        else nodo.setAttribute(k, v);
      });
    }
    for (let i = 2; i < arguments.length; i++) {
      [].concat(arguments[i]).forEach(function (h) {
        if (h == null || h === false) return;
        nodo.append(h instanceof Node ? h : document.createTextNode(String(h)));
      });
    }
    return nodo;
  }

  let temporizadorAviso = null;
  function avisar(texto) {
    const a = $("#aviso");
    a.textContent = texto;
    a.hidden = false;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(function () { a.hidden = true; }, 4500);
  }

  function registrar(agente, texto) {
    const info = AGENTES[agente];
    const li = el("li", null, info.emoji + " " + info.nombre + ": " + texto);
    const lista = $("#bitacora");
    lista.prepend(li);
  }

  function marcarAgente(agente, situacion) {
    const nodo = document.querySelector('.agente[data-agente="' + agente + '"]');
    if (!nodo) return;
    nodo.classList.remove("trabajando", "listo");
    const etiqueta = nodo.querySelector(".agente-estado");
    if (situacion === "trabajando") { nodo.classList.add("trabajando"); etiqueta.textContent = "Trabajando…"; }
    else if (situacion === "listo") { nodo.classList.add("listo"); etiqueta.textContent = "Listo ✓"; }
    else etiqueta.textContent = "En espera";
  }

  // ---------- Modo: IA real o demo ----------
  function ponerInsignia(clase, texto, titulo) {
    const ins = $("#insignia-modo");
    ins.className = "insignia " + clase;
    ins.textContent = texto;
    ins.title = titulo || "";
  }

  async function detectarModo() {
    const forzarDemo = new URLSearchParams(location.search).get("modo") === "demo";
    if (location.protocol === "file:" || forzarDemo) {
      ponerInsignia("demo", "⚡ Modo demo", forzarDemo ? "Forzado con ?modo=demo" : "Abierto sin servidor: los agentes se simulan en el navegador.");
      return;
    }
    try {
      const r = await fetch("/api/estado", { cache: "no-store" });
      const j = await r.json();
      if (j.ia) {
        estado.modo = "ia";
        ponerInsignia("ia", "🤖 IA real", "Modelo: " + j.modelo);
      } else {
        ponerInsignia("demo", "⚡ Modo demo", j.motivo || "");
      }
    } catch (e) {
      ponerInsignia("demo", "⚡ Modo demo", "No se encontró el servidor de IA.");
    }
  }

  async function llamarServidor(agente, datos) {
    const control = new AbortController();
    const limite = setTimeout(function () { control.abort(); }, 90000);
    try {
      const r = await fetch("/api/agente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agente: agente, datos: datos }),
        signal: control.signal
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || ("Error " + r.status));
      return j;
    } finally {
      clearTimeout(limite);
    }
  }

  // Llama a un agente (IA real si está disponible, si no el motor local) y anima el panel.
  async function llamarAgente(funcion, panel, datos, validar) {
    marcarAgente(panel, "trabajando");
    const inicio = Date.now();
    let resultado = null;
    if (estado.modo === "ia") {
      try {
        resultado = await llamarServidor(funcion, datos);
        if (validar && !validar(resultado)) throw new Error("respuesta incompleta");
      } catch (e) {
        console.warn("Agente con IA falló:", e);
        resultado = null;
        avisar("La IA no respondió (" + e.message + "). Usé el modo demo para este paso.");
      }
    }
    if (!resultado) resultado = window.MotorLocal[funcion](datos);
    // Pausa mínima para que se vea al agente trabajando en la demo.
    const espera = 1000 - (Date.now() - inicio);
    if (espera > 0) await dormir(espera);
    marcarAgente(panel, "listo");
    return resultado;
  }

  function conCarga(boton, textoCarga, tarea) {
    return async function () {
      if (boton.disabled) return;
      const original = boton.textContent;
      boton.disabled = true;
      boton.textContent = textoCarga;
      try { await tarea(); }
      catch (e) { console.error(e); avisar("Algo salió mal: " + e.message); }
      finally { boton.disabled = false; boton.textContent = original; }
    };
  }

  // ---------- Navegación ----------
  function puedeIrA(n) {
    if (n <= 1) return true;
    if (n === 2) return !!estado.perfil;
    if (n === 3) return !!estado.perfil;
    if (n === 4) return estado.recomendaciones.length > 0;
    if (n === 5) return !!estado.cv;
    return false;
  }

  // Muestra la sección "prefijo-n" (paso-N del CV o ent-N del entrenamiento) y marca su barra de pasos.
  function mostrarSeccion(prefijo, lista, n) {
    $$(".paso").forEach(function (s) { s.classList.toggle("activo", s.id === prefijo + "-" + n); });
    $$(lista + " li").forEach(function (li) {
      const p = Number(li.dataset.paso);
      li.classList.toggle("activo", p === n);
      li.classList.toggle("hecho", p < n);
      if (p === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    const titulo = $("#t-" + prefijo + "-" + n);
    if (titulo) { titulo.setAttribute("tabindex", "-1"); titulo.focus({ preventScroll: true }); }
  }

  function marcarFlujo(flujo) {
    estado.flujo = flujo;
    const cv = flujo === "cv";
    $("#flujo-cv").classList.toggle("activo", cv);
    $("#flujo-entrevista").classList.toggle("activo", !cv);
    $("#flujo-cv").setAttribute("aria-selected", String(cv));
    $("#flujo-entrevista").setAttribute("aria-selected", String(!cv));
    $("#lista-pasos").hidden = !cv;
  }

  // Flujo del CV (pasos 1–5).
  function irA(n) {
    if (!puedeIrA(n)) return;
    estado.paso = n;
    marcarFlujo("cv");
    mostrarSeccion("paso", "#lista-pasos", n);
    programarBorrador();
  }

  // Flujo de entrenamiento: una sola pantalla. Se elige la vacante y hay dos pestañas:
  // "aprendizaje" (consulta libre + práctica opcional) y "simulacion" (la única parte secuencial).
  function irEnt(tab) {
    marcarFlujo("entrevista");
    mostrarSeccion("ent", "#lista-pasos-ent", 1);
    mostrarTabEnt(tab || estado.tabEnt || "aprendizaje");
  }

  function mostrarTabEnt(tab) {
    estado.tabEnt = tab;
    const apr = tab === "aprendizaje";
    $("#tab-aprendizaje").classList.toggle("activa", apr);
    $("#tab-simulacion").classList.toggle("activa", !apr);
    $("#tab-aprendizaje").setAttribute("aria-selected", String(apr));
    $("#tab-simulacion").setAttribute("aria-selected", String(!apr));
    $("#panel-aprendizaje").hidden = !apr;
    $("#panel-simulacion").hidden = apr;
    if (!apr) mostrarEstadoSimulacion();
    ubicarSobreTi();
    programarBorrador();
  }

  // ---------- Paso 1 → Perfilador ----------
  async function analizarHistoria() {
    const historia = $("#in-historia").value.trim();
    if (historia.split(/\s+/).length < 8) {
      avisar("Cuéntanos un poco más (al menos un par de frases) para encontrar tus habilidades.");
      $("#in-historia").focus();
      return;
    }
    const nombre = $("#in-nombre").value.trim();
    const edad = $("#in-edad").value.trim();

    registrar("perfilador", "leyendo tu historia…");
    const r = await llamarAgente("perfilador", "perfilador", { nombre: nombre, edad: edad, historia: historia }, function (x) {
      return x && Array.isArray(x.habilidades) && x.habilidades.length > 0;
    });

    const valor = function (sel) { return $(sel).value.trim(); };
    estado.contacto = { telefono: valor("#in-telefono"), correo: valor("#in-correo"), ciudad: valor("#in-ciudad"), enlace: valor("#in-enlace") };
    estado.perfil = {
      nombre: nombre || r.nombre || "Tu nombre",
      edad: edad,
      historia: historia,
      estudios: { escuela: valor("#in-escuela"), nivel: valor("#in-nivel"), periodo: valor("#in-periodo") },
      resumen_profesional: r.resumen_profesional,
      habilidades: r.habilidades
    };
    estado.recomendaciones = []; estado.vacante = null; estado.cv = null;
    ["buscador", "adaptador"].forEach(function (a) { marcarAgente(a, "espera"); });

    guardarEnCuenta({ edad: edad, historia: historia, contacto: estado.contacto, estudios: estado.perfil.estudios });
    registrar("perfilador", "encontré " + r.habilidades.length + " habilidades con evidencia.");
    renderHabilidades();
    $("#in-resumen").value = estado.perfil.resumen_profesional;
    irA(2);
  }

  // ---------- Paso 2: habilidades (humano en el circuito) ----------
  function renderHabilidades() {
    const cont = $("#lista-habilidades");
    cont.replaceChildren();
    estado.perfil.habilidades.forEach(function (h, i) {
      // Solo hay dos categorías: cualquier valor distinto de "blanda" se muestra como técnica.
      if (h.categoria !== "blanda") h.categoria = "técnica";
      const cat = normalizar(h.categoria);
      cont.append(
        el("div", { class: "habilidad", style: "animation-delay:" + (i * 60) + "ms" },
          el("div", { class: "habilidad-cabeza" },
            el("span", { class: "habilidad-nombre", text: h.nombre }),
            el("span", { class: "etiqueta etiqueta-" + cat, text: h.categoria }),
            h.evidencia === "Agregada por ti" ? el("span", { class: "etiqueta etiqueta-personal", text: "✋ tuya" }) : null
          ),
          el("p", { class: "habilidad-evidencia", text: h.evidencia }),
          el("button", {
            class: "habilidad-quitar", type: "button", "aria-label": "Quitar " + h.nombre, title: "Quitar",
            onclick: function () {
              estado.perfil.habilidades.splice(i, 1);
              registrar("perfilador", "quitaste «" + h.nombre + "».");
              renderHabilidades();
            }
          }, "✕")
        )
      );
    });
    if (!estado.perfil.habilidades.length) {
      cont.append(el("p", { class: "vacio", text: "No hay habilidades. Agrega al menos una para continuar." }));
    }
  }

  // ---------- Habilidades personalizadas (se guardan en este navegador) ----------
  const CLAVE_PERSONALIZADAS = "despega.habilidadesPersonalizadas";

  function cargarPersonalizadas() {
    try {
      const datos = JSON.parse(localStorage.getItem(CLAVE_PERSONALIZADAS) || "[]");
      return Array.isArray(datos)
        ? datos.filter(function (h) { return h && typeof h.nombre === "string" && /^(técnica|blanda)$/.test(h.categoria); })
        : [];
    } catch (e) {
      return [];
    }
  }

  function guardarPersonalizadas(lista) {
    try { localStorage.setItem(CLAVE_PERSONALIZADAS, JSON.stringify(lista)); }
    catch (e) { /* modo privado o almacenamiento bloqueado: solo dura esta sesión */ }
  }

  let personalizadas = cargarPersonalizadas();

  function tipoVisible(categoria) {
    return categoria === "blanda" ? "Blanda" : "Técnica";
  }

  // Busca una habilidad conocida: primero en el catálogo, luego en las del usuario.
  function buscarConocida(nombre) {
    const n = normalizar(nombre);
    const delCatalogo = window.MotorLocal.CATALOGO.find(function (c) { return normalizar(c.nombre) === n; });
    if (delCatalogo) return { nombre: delCatalogo.nombre, categoria: delCatalogo.categoria, origen: "catalogo" };
    const propia = personalizadas.find(function (c) { return normalizar(c.nombre) === n; });
    if (propia) return { nombre: propia.nombre, categoria: propia.categoria, origen: "usuario" };
    return null;
  }

  function renderOpciones() {
    const lista = $("#catalogo-habilidades");
    const opciones = window.MotorLocal.CATALOGO.map(function (c) {
      return el("option", { value: c.nombre, label: tipoVisible(c.categoria) });
    }).concat(personalizadas.map(function (c) {
      return el("option", { value: c.nombre, label: tipoVisible(c.categoria) + " · agregada por ti" });
    }));
    lista.replaceChildren.apply(lista, opciones);
  }

  function tipoElegido() {
    const marcado = document.querySelector('input[name="tipo-habilidad"]:checked');
    return marcado ? marcado.value : "técnica";
  }

  function elegirTipo(categoria) {
    const id = categoria === "blanda" ? "#tipo-blanda" : "#tipo-tecnica";
    $(id).checked = true;
  }

  function agregarHabilidad(ev) {
    ev.preventDefault();
    const input = $("#in-nueva-habilidad");
    const nombre = input.value.trim().replace(/\s+/g, " ");
    if (!nombre) { input.focus(); return; }
    if (nombre.length > 40) { avisar("Usa un nombre corto (máximo 40 caracteres)."); return; }

    const existe = estado.perfil.habilidades.some(function (h) { return normalizar(h.nombre) === normalizar(nombre); });
    if (existe) { avisar("Esa habilidad ya está en tu lista."); return; }

    const tipo = tipoElegido();
    const conocida = buscarConocida(nombre);
    const categoria = tipo;
    const nombreFinal = conocida ? conocida.nombre : nombre.charAt(0).toUpperCase() + nombre.slice(1);

    estado.perfil.habilidades.push({ nombre: nombreFinal, categoria: categoria, evidencia: "Agregada por ti" });

    if (!conocida) {
      personalizadas.push({ nombre: nombreFinal, categoria: tipo });
      guardarPersonalizadas(personalizadas);
      renderOpciones();
      avisar("«" + nombreFinal + "» se agregó y quedó guardada en tus opciones.");
    } else if (conocida.origen === "usuario" && conocida.categoria !== tipo) {
      // Si cambió el tipo de una habilidad propia, se actualiza en sus opciones.
      personalizadas = personalizadas.map(function (c) {
        return normalizar(c.nombre) === normalizar(nombreFinal) ? { nombre: c.nombre, categoria: tipo } : c;
      });
      guardarPersonalizadas(personalizadas);
      renderOpciones();
    }

    registrar("perfilador", "agregaste «" + nombreFinal + "» (" + tipoVisible(categoria).toLowerCase() + ").");
    input.value = "";
    renderHabilidades();
    input.focus();
  }

  // ---------- Paso 2 → Paso 3 ----------
  function aprobarPerfil() {
    if (!estado.perfil.habilidades.length) { avisar("Agrega al menos una habilidad."); return; }
    estado.perfil.resumen_profesional = $("#in-resumen").value.trim() || estado.perfil.resumen_profesional;
    irA(3);
  }

  // ---------- Paso 3: proyectos y logros (opcional) ----------
  function campoExtra(etiqueta, clase, valor, opciones) {
    opciones = opciones || {};
    const control = opciones.multilinea
      ? el("textarea", { class: clase, rows: 3, maxlength: 400, placeholder: opciones.placeholder || "" })
      : el("input", { class: clase, type: "text", maxlength: opciones.max || 80, placeholder: opciones.placeholder || "" });
    control.value = valor || "";
    return el("label", { class: "campo" + (opciones.chico ? " campo-chico" : "") }, el("span", { text: etiqueta }), control);
  }

  function botonQuitar(texto) {
    return el("button", {
      class: "btn btn-fantasma btn-chico quitar-extra", type: "button", "aria-label": texto,
      onclick: function (e) { e.currentTarget.closest(".extra").remove(); }
    }, "✕ Quitar");
  }

  // contenedor: "#lista-proyectos" (paso 3) o "#mc-proyectos" (Mi cuenta).
  function agregarProyecto(datos, contenedor, enfocar) {
    datos = datos || {};
    const fila = el("div", { class: "extra extra-proyecto" },
      el("div", { class: "fila-extra" },
        campoExtra("Nombre del proyecto", "p-nombre", datos.nombre, { placeholder: "Ej. API de reservaciones para la biblioteca" }),
        campoExtra("Tecnologías", "p-herramientas", datos.herramientas, { placeholder: "Ej. Python, FastAPI, PostgreSQL" }),
        campoExtra("Fecha", "p-fecha", datos.fecha, { placeholder: "Ej. 2024", chico: true, max: 30 })),
      campoExtra("¿Qué hiciste y qué lograste? (una idea por renglón)", "p-descripcion",
        (datos.descripcion || []).join("\n"),
        { multilinea: true, placeholder: "Ej. Diseñé y desplegué una API REST con 12 endpoints y pruebas automatizadas (85 % de cobertura)." }),
      botonQuitar("Quitar proyecto"));
    $(contenedor || "#lista-proyectos").append(fila);
    if (enfocar) fila.querySelector("input").focus();
  }

  function agregarLogro(datos, contenedor, enfocar) {
    datos = datos || {};
    const fila = el("div", { class: "extra extra-logro" },
      el("div", { class: "fila-extra" },
        campoExtra("Logro", "l-titulo", datos.titulo, { placeholder: "Ej. Hackatón nacional de gobierno abierto" }),
        campoExtra("Resultado o detalle", "l-detalle", datos.detalle, { placeholder: "Ej. 2.º lugar" }),
        campoExtra("Año", "l-fecha", datos.fecha, { placeholder: "Ej. 2023", chico: true, max: 30 })),
      botonQuitar("Quitar logro"));
    $(contenedor || "#lista-logros").append(fila);
    if (enfocar) fila.querySelector("input").focus();
  }

  function llenarExtras(selProyectos, selLogros, datos) {
    $(selProyectos).replaceChildren();
    $(selLogros).replaceChildren();
    (datos.proyectos || []).forEach(function (p) { agregarProyecto(p, selProyectos, false); });
    (datos.logros || []).forEach(function (l) { agregarLogro(l, selLogros, false); });
  }

  // Devuelve { proyectos, logros, sinNombre } leyendo los editores de las listas indicadas.
  function leerExtras(selProyectos, selLogros) {
    selProyectos = selProyectos || "#lista-proyectos";
    selLogros = selLogros || "#lista-logros";
    const texto = function (fila, clase) { return fila.querySelector("." + clase).value.trim().replace(/[ \t]+/g, " "); };
    const filasP = $$(selProyectos + " .extra"), filasL = $$(selLogros + " .extra");
    const proyectos = filasP.map(function (f) {
      return {
        nombre: texto(f, "p-nombre"),
        herramientas: texto(f, "p-herramientas"),
        fecha: texto(f, "p-fecha"),
        descripcion: texto(f, "p-descripcion").split(/\n+/).map(function (l) { return l.replace(/^[-•*]\s*/, "").trim(); }).filter(Boolean).slice(0, 3)
      };
    }).filter(function (p) { return p.nombre; });
    const logros = filasL.map(function (f) {
      return { titulo: texto(f, "l-titulo"), detalle: texto(f, "l-detalle"), fecha: texto(f, "l-fecha") };
    }).filter(function (l) { return l.titulo; });
    return { proyectos: proyectos, logros: logros, sinNombre: filasP.length + filasL.length - proyectos.length - logros.length };
  }

  function guardarExtrasYBuscar() {
    const extras = leerExtras();
    if (extras.sinNombre > 0) {
      avisar("Hay " + extras.sinNombre + " registro(s) sin nombre: escríbelo o quítalo.");
      return;
    }
    guardarEnCuenta({ proyectos: extras.proyectos, logros: extras.logros });
    estado.perfil.proyectos = extras.proyectos;
    estado.perfil.reconocimientos = extras.logros;
    const total = extras.proyectos.length + extras.logros.length;
    if (total) registrar("perfilador", "agregaste " + extras.proyectos.length + " proyecto(s) y " + extras.logros.length + " logro(s) a tu CV.");
    return buscarVacantes();
  }

  function omitirExtras() {
    // Sin proyectos ni logros: el CV queda solo con perfil, educación, experiencia y habilidades.
    estado.perfil.proyectos = [];
    estado.perfil.reconocimientos = [];
    return buscarVacantes();
  }

  // ---------- Paso 3 → Buscador ----------
  async function buscarVacantes() {
    if (!estado.perfil.habilidades.length) { avisar("Agrega al menos una habilidad."); return; }

    registrar("buscador", "revisando " + window.VACANTES.length + " vacantes…");
    const porId = {};
    window.VACANTES.forEach(function (v) { porId[v.id] = v; });

    const r = await llamarAgente("buscador", "buscador", { perfil: estado.perfil, vacantes: window.VACANTES }, function (x) {
      return x && Array.isArray(x.recomendaciones) && x.recomendaciones.some(function (rec) { return porId[rec.id]; });
    });

    estado.recomendaciones = r.recomendaciones
      .filter(function (rec) { return porId[rec.id]; })
      .slice(0, 3)
      .map(function (rec) { return Object.assign({}, rec, { vacante: porId[rec.id] }); });

    if (!estado.recomendaciones.length) {
      avisar("No encontramos vacantes compatibles. Agrega más habilidades e intenta de nuevo.");
      return;
    }
    registrar("buscador", "las 3 mejores: " + estado.recomendaciones.map(function (x) { return x.compatibilidad + "%"; }).join(", ") + ".");
    renderVacantes();
    irA(4);
  }

  function renderVacantes() {
    $("#total-vacantes").textContent = window.VACANTES.length;
    const cont = $("#lista-vacantes");
    cont.replaceChildren();
    const mias = estado.perfil.habilidades.map(function (h) { return normalizar(h.nombre); });

    estado.recomendaciones.forEach(function (rec, i) {
      const v = rec.vacante;
      const pct = Math.max(0, Math.min(100, Number(rec.compatibilidad) || 0));
      const boton = el("button", { class: "btn btn-primario", type: "button" }, "Elegir esta vacante →");
      boton.addEventListener("click", conCarga(boton, "Adaptando tu CV…", function () { return elegirVacante(v); }));

      cont.append(
        el("article", { class: "vacante", style: "animation-delay:" + (i * 90) + "ms" },
          el("div", { class: "anillo", style: "--pct:" + pct, role: "img", "aria-label": pct + "% de compatibilidad" },
            el("div", { class: "anillo-interior" }, el("strong", { text: pct + "%" }), el("small", { text: "compatible" }))
          ),
          el("div", null,
            el("h3", { text: v.puesto }),
            el("p", { class: "vacante-empresa" }, v.empresa, v.sector ? el("span", { class: "vacante-sector", text: " · " + v.sector }) : null),
            el("div", { class: "vacante-datos" },
              [v.nivel ? "🎓 " + v.nivel : null, "📍 " + v.ciudad, "🏢 " + v.modalidad, "⏱ " + v.jornada, "💰 " + v.sueldo].filter(Boolean).map(function (d) {
                return el("span", { class: "vacante-dato", text: d });
              })
            ),
            el("p", { class: "bloque bloque-porque" }, el("strong", { text: "✓ Por qué encajas" }), rec.por_que),
            el("p", { class: "bloque bloque-falta" },
              el("strong", { text: "↗ Para crecer: " + rec.te_falta }),
              rec.consejo
            ),
            el("div", { class: "chips", style: "margin-bottom:.8rem" },
              v.habilidades.map(function (h) {
                const tengo = mias.indexOf(normalizar(h)) !== -1;
                return el("span", { class: "chip" + (tengo ? " chip-destacado" : ""), text: (tengo ? "✓ " : "") + h });
              })
            ),
            boton
          )
        )
      );
    });
  }

  // ---------- Paso 3 → Adaptador ----------
  async function elegirVacante(v) {
    estado.vacante = v;
    registrar("adaptador", "ajustando tu CV para " + v.puesto + "…");

    const r = await llamarAgente("adaptador", "adaptador", { perfil: estado.perfil, vacante: v }, function (x) {
      return x && x.resumen_adaptado && Array.isArray(x.habilidades_destacadas) && Array.isArray(x.logros);
    });
    estado.cv = r;
    registrar("adaptador", "CV listo con " + r.cambios.length + " mejoras.");
    renderCV();
    guardarCvEnCuenta();
    irA(5);
  }

  function renderCV() {
    const p = estado.perfil, v = estado.vacante, cv = estado.cv;
    const requeridas = v.habilidades.map(normalizar);
    $("#cv-vacante-nombre").textContent = v.puesto + " en " + v.empresa;

    const subtitulo = (p.edad ? p.edad + " años · " : "") + "Busco mi primera oportunidad en tecnología";
    const historiaCorta = p.historia.length > 280 ? p.historia.slice(0, 279) + "…" : p.historia;

    $("#cv-antes").replaceChildren(
      el("p", { class: "cv-nombre", text: p.nombre }),
      el("p", { class: "cv-objetivo", text: subtitulo }),
      el("h4", { text: "Perfil" }),
      el("p", { text: p.resumen_profesional }),
      el("h4", { text: "Habilidades" }),
      el("div", { class: "chips" }, p.habilidades.map(function (h) { return el("span", { class: "chip", text: h.nombre }); })),
      el("h4", { text: "Experiencia" }),
      el("p", { text: historiaCorta }),
      el("div", null, seccionesExtra(p))
    );

    $("#cv-despues").replaceChildren(
      el("p", { class: "cv-nombre", text: p.nombre }),
      el("p", { class: "cv-objetivo" }, "Postulación: ", el("span", { class: "resaltado", text: v.puesto + " · " + v.empresa })),
      el("h4", { text: "Perfil" }),
      el("p", { text: cv.resumen_adaptado }),
      el("h4", { text: "Habilidades clave para el puesto" }),
      el("div", { class: "chips" }, cv.habilidades_destacadas.map(function (h) {
        const clave = requeridas.indexOf(normalizar(h)) !== -1;
        return el("span", { class: "chip" + (clave ? " chip-destacado" : ""), text: (clave ? "★ " : "") + h });
      })),
      el("h4", { text: "Experiencia" }),
      el("ul", null, cv.logros.map(function (l) { return el("li", { text: l }); })),
      el("div", null, seccionesExtra({ proyectos: datosDelCV().proyectos, reconocimientos: datosDelCV().logros }))
    );

    $("#lista-cambios").replaceChildren.apply($("#lista-cambios"), (cv.cambios || []).map(function (c) { return el("li", { text: c }); }));

    // Versión para imprimir / guardar como PDF, con el mismo diseño que la plantilla LaTeX.
    const imprimible = $("#cv-imprimir");
    imprimible.replaceChildren.apply(imprimible, window.CvLatex.generarHtml(datosDelCV(), el));
  }

  // Proyectos y logros del paso 3 (vacío si se omitió).
  function seccionesExtra(p) {
    const nodos = [];
    const unir = function (partes) { return partes.filter(Boolean).join(" · "); };
    if (p.proyectos && p.proyectos.length) {
      nodos.push(el("h4", { text: "Proyectos" }), el("ul", null, p.proyectos.map(function (pr) {
        return el("li", null, el("strong", { text: pr.nombre }),
          unir([pr.herramientas, pr.fecha]) ? " · " + unir([pr.herramientas, pr.fecha]) : "",
          pr.descripcion.length ? el("br") : null, pr.descripcion.join(" "));
      })));
    }
    if (p.reconocimientos && p.reconocimientos.length) {
      nodos.push(el("h4", { text: "Logros" }), el("ul", null, p.reconocimientos.map(function (l) {
        return el("li", null, el("strong", { text: l.titulo }), unir([l.detalle, l.fecha]) ? " · " + unir([l.detalle, l.fecha]) : "");
      })));
    }
    return nodos;
  }

  // ---------- CV en LaTeX ----------
  function datosDelCV() {
    return window.CvLatex.datosCV(estado.perfil, estado.vacante, estado.cv, estado.contacto);
  }

  function nombreArchivoCV() {
    const base = normalizar(estado.perfil.nombre).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "cv";
    return "CV_" + base + ".tex";
  }

  function descargarTexto(texto, nombre) {
    const blob = new Blob([texto], { type: "application/x-tex;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: nombre });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function descargarLatex() {
    descargarTexto(window.CvLatex.generarLatex(datosDelCV()), nombreArchivoCV());
    avisar("Listo: compílalo con pdflatex o súbelo a Overleaf.");
  }

  // Imprime (o guarda como PDF) un CV guardado a partir de sus datos, con el diseño de la plantilla.
  function imprimirCvGuardado(datos) {
    const imprimible = $("#cv-imprimir");
    imprimible.replaceChildren.apply(imprimible, window.CvLatex.generarHtml(datos, el));
    avisar("Elige «Guardar como PDF» en la ventana de impresión.");
    setTimeout(function () {
      window.print();
      // Devuelve la vista imprimible al CV en curso, si lo hay.
      if (estado.cv && estado.vacante) renderCV(); else imprimible.replaceChildren();
    }, 300);
  }

  // Overleaf acepta un documento enviado por formulario (POST a /docs) y lo compila a PDF.
  function abrirEnOverleaf() {
    enviarAOverleaf(window.CvLatex.generarLatex(datosDelCV()), nombreArchivoCV());
  }

  function enviarAOverleaf(tex, nombre) {
    const form = el("form", { action: "https://www.overleaf.com/docs", method: "post", target: "_blank" },
      el("input", { type: "hidden", name: "snip", value: tex }),
      el("input", { type: "hidden", name: "snip_name", value: nombre }),
      el("input", { type: "hidden", name: "engine", value: "pdflatex" }));
    document.body.append(form);
    form.submit();
    form.remove();
  }

  // ---------- Entrenamiento de entrevista (flujo aparte) ----------
  // Fuentes de la vacante: el CV en curso, un CV guardado en la cuenta o cualquier vacante del catálogo.
  let cvsParaEntrevista = [];

  function opcionVacante(valor, titulo, detalle, marcada) {
    const id = "ent-op-" + valor;
    const input = el("input", { type: "radio", name: "ent-fuente", id: id, value: valor });
    input.checked = !!marcada;
    input.addEventListener("change", actualizarFuenteEntrevista);
    return el("label", { class: "opcion-vacante", for: id }, input,
      el("span", null, el("strong", { text: titulo }), detalle ? el("small", { text: detalle }) : null));
  }

  async function prepararOpcionesEntrevista(preferida) {
    const cont = $("#ent-opciones");
    const anterior = (document.querySelector('input[name="ent-fuente"]:checked') || {}).value;
    const elegida = preferida || anterior;
    const opciones = [];
    if (estado.cv && estado.vacante) {
      opciones.push({ valor: "actual", titulo: "📄 La vacante de tu CV actual", detalle: estado.vacante.puesto + " · " + estado.vacante.empresa });
    }
    cvsParaEntrevista.forEach(function (cv) {
      opciones.push({ valor: "guardado-" + cv.id, titulo: "💾 CV guardado: " + (cv.puesto || "CV"), detalle: (cv.empresa || "") + " · " + formatoFecha(cv.creado) });
    });
    opciones.push({ valor: "catalogo", titulo: "🔎 Otra vacante del catálogo", detalle: window.VACANTES.length + " vacantes de tecnología para estudiantes y recién egresados" });
    const valores = opciones.map(function (o) { return o.valor; });
    const marcada = valores.indexOf(elegida) !== -1 ? elegida : valores[0];
    cont.replaceChildren.apply(cont, opciones.map(function (o) { return opcionVacante(o.valor, o.titulo, o.detalle, o.valor === marcada); }));
    actualizarFuenteEntrevista();

    // Los CV guardados llegan después (pueden venir del servidor); se agregan sin perder la elección.
    if (estado.cuenta && !preferida && !prepararOpcionesEntrevista.cargando) {
      prepararOpcionesEntrevista.cargando = true;
      try {
        const lista = await window.Cuentas.listarCvs();
        const cambio = lista.length !== cvsParaEntrevista.length;
        cvsParaEntrevista = lista.slice(0, 5);
        if (cambio) prepararOpcionesEntrevista((document.querySelector('input[name="ent-fuente"]:checked') || {}).value);
      } catch (e) { /* sin CV guardados disponibles */ }
      prepararOpcionesEntrevista.cargando = false;
    }
  }

  function fuenteEntrevista() {
    return (document.querySelector('input[name="ent-fuente"]:checked') || {}).value || "catalogo";
  }

  function actualizarFuenteEntrevista() {
    const catalogo = fuenteEntrevista() === "catalogo";
    $("#campo-ent-catalogo").hidden = !catalogo;
    actualizarVacanteEntrevista();
    if (catalogo) {
      // Precarga lo que ya se sabe de la persona (CV en curso o cuenta).
      if (!$("#ent-nombre").value) $("#ent-nombre").value = (estado.perfil && estado.perfil.nombre !== "Tu nombre" && estado.perfil.nombre) || (estado.cuenta && estado.cuenta.nombre) || "";
      if (!$("#ent-historia").value) $("#ent-historia").value = (estado.perfil && estado.perfil.historia) || (estado.cuenta && estado.cuenta.datos.historia) || "";
    }
  }

  function llenarCatalogoEntrevista() {
    const sel = $("#ent-catalogo");
    sel.replaceChildren.apply(sel, window.VACANTES.map(function (v) {
      return el("option", { value: v.id, text: v.puesto + " · " + v.empresa + " (" + (v.nivel ? v.nivel + ", " : "") + v.ciudad + ")" });
    }));
  }

  // Reconstruye perfil y vacante a partir de los datos de un CV guardado.
  function perfilDesdeCvGuardado(d, puesto, empresa) {
    const logros = (d.experiencia && d.experiencia.logros) || [];
    const evidenciaDe = function (nombre) {
      const n = normalizar(nombre);
      return logros.find(function (l) { return normalizar(l).indexOf(n) !== -1; }) || logros[0] || d.perfil || "Lo aprendí en mi día a día";
    };
    const habilidades = (d.tecnicas || []).map(function (n) { return { nombre: n, categoria: "técnica", evidencia: evidenciaDe(n) }; })
      .concat((d.blandas || []).map(function (n) { return { nombre: n, categoria: "blanda", evidencia: evidenciaDe(n) }; }));
    const vacante = window.VACANTES.find(function (v) { return v.puesto === puesto && v.empresa === empresa; }) ||
      { id: "", puesto: puesto || "el puesto", empresa: empresa || "la empresa", ciudad: "", modalidad: "", jornada: "", sueldo: "", habilidades: [], descripcion: "" };
    return {
      vacante: vacante,
      perfil: {
        nombre: d.nombre || (estado.cuenta && estado.cuenta.nombre) || "Tu nombre",
        historia: logros.join(" "),
        resumen_profesional: d.perfil || "",
        habilidades: habilidades,
        proyectos: d.proyectos || [],
        reconocimientos: d.logros || []
      }
    };
  }

  // Clave de la vacante elegida: cambia cuando la persona elige otra vacante (o hay un CV nuevo).
  let claveVacanteEnt = null;
  function claveSeleccionEntrevista() {
    const fuente = fuenteEntrevista();
    if (fuente === "catalogo") return "catalogo-" + $("#ent-catalogo").value;
    if (fuente === "actual") return "actual-" + (estado.vacante ? estado.vacante.id : "") + "-" + (estado.perfil ? estado.perfil.historia.length : 0);
    return fuente;
  }

  async function actualizarVacanteEntrevista() {
    const clave = claveSeleccionEntrevista();
    if (clave === claveVacanteEnt) return;
    const fuente = fuenteEntrevista();
    let vacante = null, perfil = null;
    if (fuente === "actual") {
      vacante = estado.vacante; perfil = estado.perfil;
    } else if (fuente.indexOf("guardado-") === 0) {
      const cv = cvsParaEntrevista.find(function (c) { return "guardado-" + c.id === fuente; });
      try {
        const guardado = await window.Cuentas.obtenerCv(cv.id);
        if (guardado.datos) { const r = perfilDesdeCvGuardado(guardado.datos, cv.puesto, cv.empresa); vacante = r.vacante; perfil = r.perfil; }
      } catch (e) { /* se usa solo la vacante */ }
      if (!vacante) vacante = perfilDesdeCvGuardado({}, cv.puesto, cv.empresa).vacante;
      if (claveSeleccionEntrevista() !== clave) return;  // la persona cambió de opción mientras cargaba
    } else {
      vacante = window.VACANTES.find(function (v) { return v.id === $("#ent-catalogo").value; });
    }
    claveVacanteEnt = clave;
    estado.entrevista = { vacante: vacante, perfil: perfil };
    estado.simulacion = { preguntas: [], i: 0, respuestas: [], resultado: null };
    reiniciarPractica();
    mostrarEstadoSimulacion();
    const nombre = vacante.puesto + " en " + vacante.empresa;
    $("#ent-vacante-nombre").textContent = nombre;
    $("#sim-vacante-nombre").textContent = nombre;
    renderAprendizaje(vacante, perfil);
    ubicarSobreTi();
  }

  function reiniciarPractica() {
    estado.preguntas = []; estado.iPregunta = 0; estado.puntajes = [];
    $("#ent-practica-inicio").hidden = false;
    $("#entrevista").hidden = true;
    $("#ent-final").hidden = true;
  }

  // "Cuéntanos de ti" solo aparece si hace falta (vacante del catálogo sin perfil) y dentro del
  // inicio de la práctica o de la simulación, según la pestaña activa.
  function ubicarSobreTi() {
    const caja = $("#ent-sobre-ti");
    const enSim = estado.tabEnt === "simulacion";
    const inicio = enSim ? $("#sim-inicio") : $("#ent-practica-inicio");
    const destino = inicio.querySelector("[data-sobre-ti]");
    const necesita = fuenteEntrevista() === "catalogo" && !estado.entrevista.perfil && !inicio.hidden;
    $$("[data-sobre-ti]").forEach(function (c) { c.hidden = true; });
    if (necesita) {
      destino.append(caja);
      destino.hidden = false;
      caja.hidden = false;
    } else {
      caja.hidden = true;
    }
  }

  // Devuelve el perfil para practicar o simular; si falta, lo arma con la historia (Perfilador).
  async function asegurarPerfilEntrevista() {
    const e = estado.entrevista;
    if (e.perfil) return e.perfil;
    const historia = $("#ent-historia").value.trim();
    const nombre = $("#ent-nombre").value.trim();
    if (estado.perfil && historia === estado.perfil.historia) {
      e.perfil = estado.perfil;  // misma historia que el CV en curso: se reutilizan sus habilidades
    } else {
      if (historia.split(/\s+/).filter(Boolean).length < 8) {
        avisar("Para practicar o simular, cuéntanos un poco de ti (al menos un par de frases).");
        $("#ent-historia").focus();
        return null;
      }
      registrar("perfilador", "leyendo tu historia para la entrevista…");
      const r = await llamarAgente("perfilador", "perfilador", { nombre: nombre, edad: "", historia: historia }, function (x) {
        return x && Array.isArray(x.habilidades) && x.habilidades.length > 0;
      });
      e.perfil = { nombre: nombre || r.nombre || "Tu nombre", historia: historia, resumen_profesional: r.resumen_profesional, habilidades: r.habilidades };
      registrar("perfilador", "encontré " + r.habilidades.length + " habilidades para usar en tus respuestas.");
    }
    renderAprendizaje(e.vacante, e.perfil);  // ahora el aprendizaje marca lo que ya tienes
    return e.perfil;
  }

  async function comenzarPractica() {
    const perfil = await asegurarPerfilEntrevista();
    if (!perfil) return;
    const vacante = estado.entrevista.vacante;
    registrar("entrenador", "preparando preguntas de práctica para " + vacante.empresa + "…");
    const r = await llamarAgente("entrenador_preguntas", "entrenador", { perfil: perfil, vacante: vacante }, function (x) {
      return x && Array.isArray(x.preguntas) && x.preguntas.length > 0;
    });
    estado.preguntas = r.preguntas.slice(0, 3);
    estado.iPregunta = 0;
    estado.puntajes = [];
    registrar("entrenador", estado.preguntas.length + " preguntas de práctica listas. ¡Tú puedes!");
    $("#ent-practica-inicio").hidden = true;
    ubicarSobreTi();
    renderPregunta();
    $("#entrevista").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------- Aprendizaje: lo que evalúan las empresas y consejos ----------
  const EN_QUE_SE_FIJAN = [
    ["🧠", "Fundamentos sólidos", "Estructuras de datos, complejidad (Big O), programación orientada a objetos, bases de datos y redes básicas. En perfiles junior pesan más que conocer muchos frameworks."],
    ["🗣️", "Pensar en voz alta", "En la prueba técnica evalúan cómo razonas: explica qué entiendes, qué opciones ves y por qué eliges una."],
    ["🧩", "Resolución de problemas", "Aclara requisitos y casos borde, propone primero una solución simple, mejórala y pruébala con ejemplos."],
    ["💻", "Código limpio", "Nombres claros, funciones pequeñas, manejo de errores y pruebas. Se nota en la prueba técnica y en tu GitHub."],
    ["📂", "Portafolio y GitHub", "Repositorios con README, instrucciones para correrlos, commits ordenados y, si se puede, una demo desplegada."],
    ["📌", "Proyectos explicados a fondo", "Qué construiste, qué parte hiciste tú, qué decisiones técnicas tomaste, qué problemas tuviste y qué mejorarías."],
    ["👥", "Trabajo en equipo", "Uso de Git y pull requests, code review, metodologías ágiles y comunicación con personas no técnicas."],
    ["🌱", "Aprendizaje continuo", "Cómo aprendes una tecnología nueva: documentación, cursos, proyectos de práctica. Muestra curiosidad real."],
    ["🌎", "Inglés técnico", "Leer documentación es básico; en empresas nearshore o internacionales parte de la entrevista puede ser en inglés."],
    ["✅", "Honestidad", "Decir «no lo sé, pero lo investigaría así…» vale más que inventar. No pongas en tu CV tecnologías que no puedas defender."],
    ["⏰", "Puntualidad y preparación", "Conéctate 5–10 minutos antes y prueba cámara, micrófono, internet, tu editor y compartir pantalla."],
    ["❓", "Tus preguntas al final", "Preguntar por el stack, el onboarding o la mentoría muestra interés y te ayuda a decidir si el lugar es para ti."]
  ];

  const CONSEJOS = {
    "Antes": [
      "Investiga la empresa y su stack: la vacante, su blog técnico, su GitHub y perfiles de su equipo de ingeniería.",
      "Repasa fundamentos y resuelve 2–3 problemas diarios tipo entrevista (arreglos, cadenas, hash maps, árboles).",
      "Prepara 2 proyectos para explicarlos a fondo con el método SAR (abajo te explicamos cómo).",
      "Deja tu GitHub presentable: README claro, cómo correr el proyecto y capturas o demo.",
      "Ensaya en voz alta aquí mismo, con la práctica y la simulación."
    ],
    "Durante": [
      "Antes de programar, aclara entradas, salidas, restricciones y casos borde.",
      "Piensa en voz alta y empieza por una solución que funcione; luego optimiza y menciona la complejidad.",
      "Prueba tu código con un ejemplo a mano. Si te atoras, explica qué intentas y acepta las pistas.",
      "En preguntas de proyectos, habla de lo que hiciste tú («yo implementé…»), aunque haya sido en equipo.",
      "Si no sabes algo, dilo con honestidad y explica cómo lo averiguarías."
    ],
    "Después": [
      "Envía un mensaje o correo de agradecimiento en las siguientes 24 horas.",
      "Anota los problemas que te pusieron y resuélvelos después con calma.",
      "Si fue en inglés, practica las frases o explicaciones que te costaron.",
      "Cada proceso es práctica: aunque no quedes, llegas mejor al siguiente. Sigue postulándote."
    ]
  };

  const ERRORES_COMUNES = [
    "Programar en silencio o lanzarte a codificar sin entender bien el problema.",
    "Poner en el CV tecnologías que no puedes explicar.",
    "Tener repositorios vacíos, sin README o con todo en un solo commit.",
    "No saber explicar las decisiones técnicas de tu propio proyecto.",
    "Preguntar primero por sueldo o home office (espera a que lo mencionen o al final)."
  ];

  const PREGUNTAS_PARA_HACER = [
    "¿Qué stack usa el equipo y por qué lo eligieron?",
    "¿Cómo es el proceso de code review y de despliegue?",
    "¿Qué acompañamiento o mentoría reciben las personas junior al entrar?",
    "¿Qué esperan que logre en los primeros 3 meses?",
    "¿Cuáles son los siguientes pasos del proceso?"
  ];

  function renderAprendizaje(vacante, perfil) {
    const conPerfil = !!perfil;
    perfil = perfil || { habilidades: [] };
    const tiene = {};
    (perfil.habilidades || []).forEach(function (h) { tiene[normalizar(h.nombre)] = h; });
    const pedidas = vacante.habilidades || [];
    const requeridas = pedidas.map(normalizar);
    const clave = (perfil.habilidades || []).find(function (h) { return requeridas.indexOf(normalizar(h.nombre)) !== -1; }) ||
      (perfil.habilidades || [])[0];

    const bloque = function (titulo, abierto, contenido) {
      const d = el("details", { class: "tarjeta bloque-aprendizaje" }, el("summary", null, el("h3", { text: titulo })),
        el("div", { class: "bloque-cuerpo" }, contenido));
      d.open = !!abierto;
      return d;
    };

    const fijan = bloque("🏢 En qué se fijan las empresas en una entrevista", true,
      el("div", { class: "criterios" }, EN_QUE_SE_FIJAN.map(function (c) {
        return el("div", { class: "criterio" }, el("span", { class: "criterio-icono", "aria-hidden": "true", text: c[0] }),
          el("div", null, el("strong", { text: c[1] }), el("p", { text: c[2] })));
      })));

    const consejos = bloque("✅ Consejos: antes, durante y después", false,
      el("div", { class: "consejos" }, Object.keys(CONSEJOS).map(function (momento) {
        return el("div", { class: "consejo-columna" }, el("h4", { text: momento }),
          el("ul", { class: "lista-check" }, CONSEJOS[momento].map(function (t) { return el("li", { text: t }); })));
      })));

    const sar = bloque("🧩 Cómo responder: el método SAR", false, [
      el("p", { text: "Las preguntas sobre proyectos y experiencia («cuéntame de una vez que…») se responden mejor en tres partes:" }),
      el("ol", { class: "sar" },
        el("li", null, el("strong", { text: "Situación: " }), "el proyecto o problema y qué había que resolver."),
        el("li", null, el("strong", { text: "Acción: " }), "qué hiciste tú, qué tecnologías usaste y por qué."),
        el("li", null, el("strong", { text: "Resultado: " }), "qué lograste o aprendiste, de preferencia con un dato («bajé el tiempo de carga de 4 a 1 segundo»).")),
      clave ? el("p", { class: "ejemplo-guia" },
        el("strong", { text: "Empieza con algo tuyo: " }),
        "«" + clave.evidencia + "». Cuéntalo como Situación, di qué Acción técnica tomaste y cierra con el Resultado; así demuestras " +
        clave.nombre + ".") : null
    ]);

    const vacanteBloque = bloque("🎯 Para esta vacante: " + vacante.puesto + " en " + vacante.empresa, false, [
      vacante.descripcion ? el("p", { text: vacante.descripcion }) : null,
      vacante.sector || vacante.nivel ? el("p", { class: "pista-tipo", text: [vacante.nivel, vacante.sector].filter(Boolean).join(" · ") }) : null,
      pedidas.length ? el("p", { class: "pista-tipo", text: conPerfil
        ? "Habilidades que pide la vacante (✓ = ya la tienes en tu perfil; prepara un ejemplo de cada una):"
        : "Habilidades que pide la vacante (prepara un proyecto o ejemplo de cada una):" }) : null,
      pedidas.length ? el("div", { class: "chips" }, pedidas.map(function (h) {
        if (!conPerfil) return el("span", { class: "chip", text: h });
        const si = !!tiene[normalizar(h)];
        return el("span", { class: "chip" + (si ? " chip-destacado" : " chip-falta"), text: (si ? "✓ " : "○ ") + h });
      })) : null,
      el("h4", { text: "Errores comunes que debes evitar" }),
      el("ul", { class: "lista-mejoras" }, ERRORES_COMUNES.map(function (t) { return el("li", { text: t }); })),
      el("h4", { text: "Preguntas que puedes hacer al final" }),
      el("ul", { class: "lista-check" }, PREGUNTAS_PARA_HACER.map(function (t) { return el("li", { text: t }); }))
    ]);

    // Los problemas no dependen de la vacante: se crean una vez y se conservan (con lo que la persona escribió).
    nodoProblemas = nodoProblemas || bloqueProblemas(bloque);
    $("#ent-aprendizaje").replaceChildren(fijan, consejos, sar, vacanteBloque, nodoProblemas);
  }
  let nodoProblemas = null;

  // ---------- Problemas tipo LeetCode (js/problemas.js) ----------
  // Se practican explicando la lógica, como en una entrevista: no se ejecuta código.
  function renderEnunciado(prob) {
    return [
      el("p", { class: "problema-texto", text: prob.enunciado }),
      el("div", { class: "problema-ejemplos" }, prob.ejemplos.map(function (e, i) {
        return el("div", { class: "problema-ejemplo" },
          el("strong", { text: "Ejemplo " + (i + 1) }),
          el("code", { text: "Entrada: " + e.entrada }),
          el("code", { text: "Salida: " + e.salida + (e.nota ? "   (" + e.nota + ")" : "") }));
      }))
    ];
  }

  function renderSolucion(prob) {
    const pres = {};
    const tabs = el("div", { class: "codigo-tabs", role: "tablist", "aria-label": "Lenguaje" });
    const cuerpo = el("div", { class: "codigo-cuerpo" });
    [["python", "Python"], ["javascript", "JavaScript"]].forEach(function (l, i) {
      const boton = el("button", { class: "codigo-tab" + (i === 0 ? " activa" : ""), type: "button", role: "tab", "aria-selected": String(i === 0) }, l[1]);
      const pre = el("pre", { class: "codigo" }, el("code", { text: prob.codigo[l[0]] }));
      pre.hidden = i !== 0;
      pres[l[0]] = pre;
      boton.addEventListener("click", function () {
        Array.from(tabs.children).forEach(function (b) { b.classList.remove("activa"); b.setAttribute("aria-selected", "false"); });
        boton.classList.add("activa"); boton.setAttribute("aria-selected", "true");
        Object.keys(pres).forEach(function (k) { pres[k].hidden = k !== l[0]; });
      });
      tabs.append(boton);
      cuerpo.append(pre);
    });
    return [
      el("h5", { text: "La lógica, paso a paso" }),
      el("ol", { class: "problema-idea" }, prob.idea.map(function (t) { return el("li", { text: t }); })),
      el("p", { class: "problema-complejidad" }, el("strong", { text: "Complejidad: " }), prob.complejidad),
      el("h5", { text: "Código de referencia" }), tabs, cuerpo
    ];
  }

  function bloqueProblemas(bloque) {
    const problemas = window.PROBLEMAS || [];
    const items = problemas.map(function (prob, i) {
      const area = el("textarea", { rows: 4, placeholder: "Explica tu idea: qué estructura de datos usas, cómo recorres los datos, casos borde y complejidad. Puedes agregar pseudocódigo." });
      const retro = el("div", { class: "retro problema-retro" });
      retro.hidden = true;
      const revisar = el("button", { class: "btn btn-secundario btn-chico", type: "button" }, "Revisar mi explicación");
      revisar.addEventListener("click", conCarga(revisar, "Revisando…", async function () {
        const texto = area.value.trim();
        if (texto.split(/\s+/).filter(Boolean).length < 5) { avisar("Escribe tu idea con algunas frases antes de revisarla."); area.focus(); return; }
        const r = await llamarAgente("entrenador_problema", "entrenador", {
          problema_id: prob.id, problema: { titulo: prob.titulo, enunciado: prob.enunciado },
          solucion_referencia: prob.idea.join(" ") + " " + prob.complejidad, respuesta: texto
        }, function (x) { return x && typeof x.puntaje === "number" && x.lo_bueno; });
        const puntaje = Math.max(1, Math.min(5, Math.round(r.puntaje)));
        retro.replaceChildren(
          el("div", { class: "retro-puntaje" }, el("span", { "aria-hidden": "true", text: estrellas(puntaje) }), el("strong", { text: puntaje + " de 5" })),
          el("p", { class: "retro-bueno", text: r.lo_bueno }),
          el("p", { class: "retro-oportunidad", text: r.mejorar }));
        retro.hidden = false;
        registrar("entrenador", "problema «" + prob.titulo + "»: " + puntaje + "/5.");
      }));
      const pistas = el("details", { class: "problema-pistas" }, el("summary", { text: "💡 Ver pistas" }),
        el("ul", { class: "lista-mejoras" }, prob.pistas.map(function (t) { return el("li", { text: t }); })));
      const solucion = el("details", { class: "problema-solucion" }, el("summary", { text: "✅ Ver solución" }), renderSolucion(prob));
      return el("details", { class: "problema" },
        el("summary", null,
          el("span", { class: "problema-num", text: String(i + 1) }),
          el("span", { class: "problema-titulo" }, el("strong", { text: prob.titulo }), el("small", { text: prob.tema + " · Fácil" }))),
        renderEnunciado(prob), pistas,
        el("label", { class: "campo" }, el("span", { text: "Tu explicación" }), area),
        el("div", { class: "acciones" }, revisar), retro, solucion);
    });
    return bloque("🧮 Problemas tipo LeetCode (nivel junior)", false, [
      el("p", { text: "En la prueba técnica importa tanto la solución como explicar cómo llegaste a ella. Para cada problema: léelo, piensa una idea, escríbela con tus palabras y revísala; después compara con la solución." }),
      el("p", { class: "pista-tipo", text: "Practicas explicando la lógica (no se ejecuta código), así sirve para cualquier lenguaje. La solución incluye código de referencia en Python y JavaScript." }),
      el("div", { class: "problemas-lista" }, items)
    ]);
  }

  // Elige el problema de la simulación al azar, sin repetir el de la simulación anterior.
  let ultimoProblemaSim = null;
  function elegirProblemaSimulacion() {
    const lista = (window.PROBLEMAS || []).filter(function (p) { return p.id !== ultimoProblemaSim; });
    const prob = lista[Math.floor(Math.random() * lista.length)];
    ultimoProblemaSim = prob.id;
    return prob;
  }

  // ---------- Simulación: 3 preguntas seguidas, calificación al final ----------
  function mostrarEstadoSimulacion() {
    const sim = estado.simulacion;
    const enCurso = sim.preguntas.length && !sim.resultado;
    $("#sim-inicio").hidden = !!(enCurso || sim.resultado);
    $("#sim-pregunta-card").hidden = !enCurso;
    $("#sim-resultado").hidden = !sim.resultado;
  }

  async function comenzarSimulacion() {
    const perfil = await asegurarPerfilEntrevista();
    if (!perfil) return;
    const e = estado.entrevista;
    registrar("entrenador", "preparando tu simulación para " + e.vacante.empresa + "…");
    const r = await llamarAgente("entrenador_preguntas", "entrenador", { perfil: perfil, vacante: e.vacante, modo: "simulacion" }, function (x) {
      return x && Array.isArray(x.preguntas) && x.preguntas.length > 0;
    });
    const preguntas = r.preguntas.slice(0, 3);
    const prob = elegirProblemaSimulacion();
    if (prob) {
      preguntas.push({
        pregunta: "Problema técnico: " + prob.titulo,
        que_busca: "Una solución correcta y eficiente explicada con claridad: estructura de datos, pasos, casos borde y complejidad.",
        problema_id: prob.id
      });
    }
    estado.simulacion = { preguntas: preguntas, i: 0, respuestas: [], resultado: null };
    registrar("entrenador", "simulación lista: 3 preguntas y un problema técnico, sin pistas.");
    renderSimPregunta();
    mostrarEstadoSimulacion();
    ubicarSobreTi();
    $("#sim-pregunta").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderSimPregunta() {
    const sim = estado.simulacion;
    const q = sim.preguntas[sim.i];
    const prob = q.problema_id ? (window.PROBLEMAS || []).find(function (x) { return x.id === q.problema_id; }) : null;
    $("#sim-contador").textContent = "Pregunta " + (sim.i + 1) + " de " + sim.preguntas.length + (prob ? " · Problema técnico" : "");
    $("#sim-pregunta").textContent = prob
      ? "Para terminar, un problema técnico: «" + prob.titulo + "». Explícame cómo lo resolverías y por qué."
      : q.pregunta;
    const caja = $("#sim-problema");
    caja.hidden = !prob;
    if (prob) caja.replaceChildren.apply(caja, renderEnunciado(prob));
    $("#sim-respuesta").placeholder = prob
      ? "Explica tu idea: qué estructura de datos usas, los pasos, casos borde y complejidad. Puedes agregar pseudocódigo."
      : "Responde como en la entrevista real.";
    $("#sim-respuesta").value = "";
    $("#btn-sim-responder").textContent = textoBotonSimulacion();
    $("#sim-respuesta").focus({ preventScroll: true });
    programarBorrador();
  }

  function textoBotonSimulacion() {
    const sim = estado.simulacion;
    return sim.i < sim.preguntas.length - 1 ? "Responder y continuar →" : "Terminar y ver mi calificación →";
  }

  async function responderSimulacion() {
    const sim = estado.simulacion;
    const respuesta = $("#sim-respuesta").value.trim();
    if (respuesta.split(/\s+/).filter(Boolean).length < 3) {
      avisar("Escribe tu respuesta antes de continuar.");
      $("#sim-respuesta").focus();
      return;
    }
    const q = sim.preguntas[sim.i];
    const prob = q.problema_id ? (window.PROBLEMAS || []).find(function (x) { return x.id === q.problema_id; }) : null;
    sim.respuestas[sim.i] = prob
      ? { pregunta: q.pregunta, respuesta: respuesta, tipo: "problema", problema_id: prob.id, enunciado: prob.enunciado,
          solucion_referencia: prob.idea.join(" ") + " " + prob.complejidad }
      : { pregunta: q.pregunta, respuesta: respuesta };
    if (sim.i < sim.preguntas.length - 1) {
      sim.i++;
      renderSimPregunta();
      return;
    }
    // Última respuesta: el Entrenador evalúa la entrevista completa.
    $("#btn-sim-responder").textContent = "Evaluando tu entrevista…";
    registrar("entrenador", "evaluando tu entrevista completa…");
    const e = estado.entrevista;
    const r = await llamarAgente("entrenador_simulacion", "entrenador", { vacante: e.vacante, perfil: e.perfil, respuestas: sim.respuestas }, function (x) {
      return x && typeof x.calificacion === "number" && Array.isArray(x.fortalezas) && Array.isArray(x.mejoras) && Array.isArray(x.por_pregunta);
    });
    sim.resultado = r;
    programarBorrador();
    registrar("entrenador", "simulación calificada: " + Math.round(r.calificacion) + "/10.");
    renderResultadoSimulacion();
    guardarSimulacionEnCuenta();
    mostrarEstadoSimulacion();
    $("#sim-resultado").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function solucionDeReferencia(q) {
    const prob = q.problema_id ? (window.PROBLEMAS || []).find(function (x) { return x.id === q.problema_id; }) : null;
    if (!prob) return null;
    return el("div", { class: "problema-referencia" }, el("h4", { text: "Solución de referencia" }), renderEnunciado(prob), renderSolucion(prob));
  }

  function estrellas(puntaje) {
    const n = Math.max(0, Math.min(5, Math.round(puntaje)));
    return "★".repeat(n) + "☆".repeat(5 - n);
  }

  function renderResultadoSimulacion() {
    const sim = estado.simulacion, r = sim.resultado;
    const nota = Math.max(1, Math.min(10, Math.round(r.calificacion)));
    $("#sim-nota").textContent = nota;
    $("#sim-resultado").dataset.nivel = nota >= 8 ? "alto" : nota >= 5 ? "medio" : "bajo";
    $("#sim-estrellas").textContent = estrellas(nota / 2);
    $("#sim-veredicto").textContent = r.veredicto;
    $("#sim-fortalezas").replaceChildren.apply($("#sim-fortalezas"), r.fortalezas.map(function (t) { return el("li", { text: t }); }));
    $("#sim-mejoras").replaceChildren.apply($("#sim-mejoras"), r.mejoras.map(function (t) { return el("li", { text: t }); }));
    $("#sim-detalle").replaceChildren.apply($("#sim-detalle"), sim.preguntas.map(function (q, i) {
      const ev = r.por_pregunta[i] || { puntaje: 0, comentario: "" };
      return el("details", { class: "sim-item" },
        el("summary", null, el("span", { text: "Pregunta " + (i + 1) + ": " + q.pregunta }),
          el("span", { class: "sim-item-puntaje", text: estrellas(ev.puntaje) + " " + Math.round(ev.puntaje) + "/5" })),
        el("p", null, el("strong", { text: "Tu respuesta: " }), (sim.respuestas[i] || {}).respuesta || ""),
        el("p", null, el("strong", { text: "Observación: " }), ev.comentario),
        q.que_busca ? el("p", { class: "pista-tipo" }, el("strong", { text: "Qué buscaba quien entrevista: " }), q.que_busca) : null,
        solucionDeReferencia(q));
    }));
  }

  function abrirEntrenamiento(preferida) {
    irEnt(preferida ? "aprendizaje" : null);
    prepararOpcionesEntrevista(preferida);
  }

  function renderPregunta() {
    const q = estado.preguntas[estado.iPregunta];
    $("#entrevista").hidden = false;
    $("#ent-final").hidden = true;
    $("#ent-contador").textContent = "Pregunta " + (estado.iPregunta + 1) + " de " + estado.preguntas.length;
    $("#ent-pregunta").textContent = q.pregunta;
    $("#ent-busca").textContent = q.que_busca;
    $("#in-respuesta").value = "";
    $("#ent-retro").hidden = true;
    $("#btn-evaluar").hidden = false;
    $("#btn-siguiente").textContent = estado.iPregunta < estado.preguntas.length - 1 ? "Siguiente pregunta →" : "Ver mi resultado →";
    programarBorrador();
  }

  async function evaluarRespuesta() {
    const respuesta = $("#in-respuesta").value.trim();
    if (respuesta.split(/\s+/).filter(Boolean).length < 3) {
      avisar("Escribe tu respuesta antes de evaluarla.");
      $("#in-respuesta").focus();
      return;
    }
    const q = estado.preguntas[estado.iPregunta];
    const r = await llamarAgente("entrenador_evaluar", "entrenador", {
      pregunta: q.pregunta, respuesta: respuesta, vacante: estado.entrevista.vacante, perfil: estado.entrevista.perfil
    }, function (x) { return x && typeof x.puntaje === "number" && x.lo_bueno; });

    const puntaje = Math.max(1, Math.min(5, Math.round(r.puntaje)));
    estado.puntajes[estado.iPregunta] = puntaje;
    $("#ent-estrellas").textContent = "★".repeat(puntaje) + "☆".repeat(5 - puntaje);
    $("#ent-puntaje").textContent = puntaje + " de 5";
    $("#ent-bueno").textContent = r.lo_bueno;
    $("#ent-mejorar").textContent = r.mejorar;
    $("#ent-ejemplo").textContent = r.respuesta_ejemplo;
    $("#ent-retro").hidden = false;
    registrar("entrenador", "pregunta " + (estado.iPregunta + 1) + ": " + puntaje + "/5.");
    $("#btn-siguiente").focus();
  }

  function siguientePregunta() {
    if (estado.iPregunta < estado.preguntas.length - 1) {
      estado.iPregunta++;
      renderPregunta();
      $("#ent-pregunta").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const validos = estado.puntajes.filter(Boolean);
    const promedio = validos.reduce(function (a, b) { return a + b; }, 0) / (validos.length || 1);
    $("#entrevista").hidden = true;
    $("#ent-final").hidden = false;
    $("#ent-resumen-final").textContent =
      (estado.entrevista.perfil.nombre !== "Tu nombre" ? estado.entrevista.perfil.nombre.split(" ")[0] + ", tu" : "Tu") +
      " promedio en la entrevista fue de " + promedio.toFixed(1) + " de 5. " +
      (promedio >= 4 ? "¡Tienes todo listo para postularte!" : "Practica una vez más con los consejos y vas a llegar con mucha más seguridad.");
    registrar("entrenador", "entrevista terminada. Promedio " + promedio.toFixed(1) + "/5.");
  }

  // ---------- Historial de calificaciones ----------
  async function guardarSimulacionEnCuenta() {
    const nota = $("#sim-guardado");
    if (!estado.cuenta) {
      nota.textContent = estado.cuentasDisponibles
        ? "💡 Inicia sesión para guardar tus calificaciones y ver cómo mejoras con cada simulación."
        : "";
      return;
    }
    const sim = estado.simulacion, r = sim.resultado, v = estado.entrevista.vacante;
    nota.textContent = "Guardando en tu historial…";
    try {
      await window.Cuentas.guardarEntrevista({
        puesto: v.puesto,
        empresa: v.empresa,
        calificacion: Math.max(1, Math.min(10, Math.round(r.calificacion))),
        veredicto: r.veredicto,
        fortalezas: r.fortalezas,
        mejoras: r.mejoras,
        preguntas: sim.preguntas.map(function (q, i) {
          const ev = r.por_pregunta[i] || {};
          return { pregunta: q.pregunta, que_busca: q.que_busca || "", respuesta: (sim.respuestas[i] || {}).respuesta || "", puntaje: ev.puntaje || 0, comentario: ev.comentario || "" };
        })
      });
      nota.textContent = "✅ Se guardó en tu historial de calificaciones (👤 Mi cuenta).";
      registrar("entrenador", "guardé tu calificación en tu historial.");
    } catch (e) {
      nota.textContent = "No se pudo guardar en tu historial: " + e.message;
    }
  }

  function fechaCorta(segundos) {
    return new Date(segundos * 1000).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  }

  async function cargarHistorial() {
    const cont = $("#historial-entrevistas");
    cont.replaceChildren(el("p", { class: "vacio", text: "Cargando tu historial…" }));
    let lista;
    try { lista = await window.Cuentas.listarEntrevistas(); }
    catch (e) { cont.replaceChildren(el("p", { class: "vacio", text: "No se pudo cargar tu historial: " + e.message })); return; }

    if (!lista.length) {
      const ir = el("button", { class: "btn btn-secundario btn-chico", type: "button" }, "🎤 Ir a entrenar mi entrevista");
      ir.addEventListener("click", function () { mostrarVista("app"); abrirEntrenamiento(); });
      cont.replaceChildren(el("div", { class: "vacio" },
        el("p", { text: "Aún no tienes simulaciones. Termina una simulación de entrevista y tu calificación aparecerá aquí." }), ir));
      return;
    }

    const notas = lista.map(function (e) { return e.calificacion; });           // más reciente primero
    const promedio = notas.reduce(function (a, b) { return a + b; }, 0) / notas.length;
    const ultima = notas[0], anterior = notas[1];
    const cambio = anterior == null ? null : ultima - anterior;

    const indicador = function (etiqueta, valor, detalle) {
      return el("div", { class: "indicador" }, el("span", { class: "indicador-etiqueta", text: etiqueta }),
        el("strong", { class: "indicador-valor", text: valor }), detalle ? el("span", { class: "indicador-detalle", text: detalle }) : null);
    };
    const indicadores = el("div", { class: "indicadores" },
      indicador("Simulaciones", String(lista.length)),
      indicador("Promedio", promedio.toFixed(1) + "/10"),
      indicador("Mejor", Math.max.apply(null, notas) + "/10"),
      indicador("Última", ultima + "/10",
        cambio == null ? "Tu primera simulación" : cambio > 0 ? "▲ " + cambio + " vs. la anterior" : cambio < 0 ? "▼ " + Math.abs(cambio) + " vs. la anterior" : "= igual que la anterior"));

    cont.replaceChildren(indicadores, graficaHistorial(lista.slice(0, 12).reverse()),
      el("h4", { class: "historial-subtitulo", text: "Todas tus simulaciones" }),
      el("div", { class: "historial-lista" }, lista.map(itemHistorial)));
  }

  // Barras de una sola serie (calificación por simulación, de la más antigua a la más reciente).
  function graficaHistorial(entradas) {
    const barras = entradas.map(function (e, i) {
      const texto = fechaCorta(e.creado) + " · " + e.puesto + (e.empresa ? " en " + e.empresa : "") + ": " + e.calificacion + "/10";
      const ultima = i === entradas.length - 1;
      return el("div", { class: "barra-col" },
        el("div", { class: "barra-area" },
          el("div", { class: "barra", style: "height:" + (e.calificacion * 10) + "%", tabindex: "0", role: "img", "aria-label": texto, "data-tip": texto },
            ultima ? el("span", { class: "barra-valor", text: String(e.calificacion) }) : null)),
        el("span", { class: "barra-fecha", text: fechaCorta(e.creado) }));
    });
    return el("figure", { class: "grafica-historial" },
      el("figcaption", { text: "Calificación de tus últimas " + entradas.length + " simulaciones (de 1 a 10)" }),
      el("div", { class: "grafica-cuerpo" },
        el("div", { class: "grafica-eje", "aria-hidden": "true" }, el("span", { text: "10" }), el("span", { text: "5" }), el("span", { text: "0" })),
        el("div", { class: "grafica-barras" }, barras)));
  }

  function itemHistorial(e) {
    const eliminar = el("button", { class: "btn btn-fantasma btn-chico", type: "button" }, "🗑 Eliminar");
    eliminar.addEventListener("click", async function () {
      if (!eliminar.dataset.confirmar) {
        eliminar.dataset.confirmar = "1";
        eliminar.textContent = "¿Seguro? Clic para eliminar";
        eliminar.classList.add("btn-peligro");
        return;
      }
      eliminar.disabled = true;
      try { await window.Cuentas.eliminarEntrevista(e.id); avisar("Simulación eliminada del historial."); cargarHistorial(); }
      catch (err) { avisar("No se pudo eliminar: " + err.message); eliminar.disabled = false; }
    });
    const nivel = e.calificacion >= 8 ? "alto" : e.calificacion >= 5 ? "medio" : "bajo";
    return el("details", { class: "historial-item" },
      el("summary", null,
        el("span", { class: "historial-nota", "data-nivel": nivel, text: e.calificacion + "/10" }),
        el("span", { class: "historial-info" }, el("strong", { text: e.puesto || "Entrevista" }),
          el("span", { text: (e.empresa ? e.empresa + " · " : "") + formatoFecha(e.creado) }))),
      e.veredicto ? el("p", { class: "historial-veredicto", text: e.veredicto }) : null,
      el("div", { class: "sim-observaciones" },
        el("div", null, el("h4", { text: "💪 Lo que hiciste bien" }),
          el("ul", { class: "lista-check" }, (e.fortalezas || []).map(function (t) { return el("li", { text: t }); }))),
        el("div", null, el("h4", { text: "🛠️ Observaciones de mejora" }),
          el("ul", { class: "lista-mejoras" }, (e.mejoras || []).map(function (t) { return el("li", { text: t }); })))),
      (e.preguntas || []).length ? el("div", { class: "historial-preguntas" }, e.preguntas.map(function (q, i) {
        return el("div", { class: "historial-pregunta" },
          el("p", null, el("strong", { text: "Pregunta " + (i + 1) + ": " }), q.pregunta,
            el("span", { class: "sim-item-puntaje", text: " " + estrellas(q.puntaje) + " " + Math.round(q.puntaje) + "/5" })),
          el("p", null, el("strong", { text: "Tu respuesta: " }), q.respuesta),
          q.comentario ? el("p", null, el("strong", { text: "Observación: " }), q.comentario) : null);
      })) : null,
      el("div", { class: "acciones" }, eliminar));
  }

  // ---------- Lectura de preguntas en voz alta ----------
  function leerEnVoz(texto) {
    if (!("speechSynthesis" in window)) { avisar("Tu navegador no puede leer en voz alta."); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "es-MX";
    u.rate = 0.95;
    const voz = window.speechSynthesis.getVoices().find(function (v) { return /^es(-|_)/i.test(v.lang); });
    if (voz) u.voice = voz;
    window.speechSynthesis.speak(u);
  }

  // ---------- Cuentas ----------
  // datos de la cuenta: { edad, historia, contacto:{telefono,correo,ciudad,enlace}, estudios:{escuela,nivel,periodo}, proyectos, logros }

  function mostrarVista(vista) {
    $("#acceso").hidden = vista !== "acceso";
    $("#mi-cuenta").hidden = vista !== "cuenta";
    $(".pasos").hidden = vista !== "app";
    $(".distribucion").hidden = vista !== "app";
    $("#btn-reiniciar").hidden = vista === "acceso";
    estado.vista = vista;
    actualizarEncabezado(vista);
    window.scrollTo({ top: 0 });
    programarBorrador();
  }

  function actualizarEncabezado(vista) {
    $("#btn-cuenta").hidden = !estado.cuenta || vista === "cuenta";
    $("#nombre-cuenta").textContent = estado.cuenta ? estado.cuenta.nombre.split(" ")[0] : "";
    $("#btn-entrar").hidden = !!estado.cuenta || !estado.cuentasDisponibles || vista === "acceso";
  }

  function mostrarError(form, texto) {
    const p = form.querySelector(".error-form");
    p.textContent = texto || "";
    p.hidden = !texto;
  }

  // Llena el paso 1 y el paso 3 con los datos guardados de la cuenta.
  function llenarPasos(cuenta) {
    const d = cuenta.datos || {}, c = d.contacto || {}, e = d.estudios || {};
    const poner = function (sel, valor) { $(sel).value = valor == null ? "" : valor; };
    poner("#in-nombre", cuenta.nombre);
    poner("#in-edad", d.edad);
    poner("#in-historia", d.historia);
    poner("#in-telefono", c.telefono); poner("#in-correo", c.correo);
    poner("#in-ciudad", c.ciudad); poner("#in-enlace", c.enlace);
    poner("#in-escuela", e.escuela); poner("#in-nivel", e.nivel); poner("#in-periodo", e.periodo);
    if (CAMPOS_CV.some(function (s) { return $(s).value; })) $(".datos-cv").open = true;
    llenarExtras("#lista-proyectos", "#lista-logros", d);
  }

  // Combina los cambios con los datos guardados y los envía al servidor (sin bloquear el flujo).
  async function guardarEnCuenta(cambios) {
    if (!estado.cuenta) return;
    const datos = Object.assign({}, estado.cuenta.datos, cambios);
    try {
      await window.Cuentas.guardarDatos(datos);
      estado.cuenta.datos = datos;
    } catch (e) {
      avisar("No se pudieron guardar tus datos: " + e.message);
    }
  }

  async function guardarCvEnCuenta() {
    if (!estado.cuenta) return;
    try {
      const cv = await window.Cuentas.guardarCv({
        puesto: estado.vacante.puesto,
        empresa: estado.vacante.empresa,
        tex: window.CvLatex.generarLatex(datosDelCV()),
        datos: datosDelCV()
      });
      registrar("adaptador", "guardé este CV en tu cuenta" + (cv.tiene_pdf ? " (PDF y .tex)." : "."));
    } catch (e) {
      avisar("No se pudo guardar el CV en tu cuenta: " + e.message);
    }
  }

  async function iniciarConCuenta(usuario) {
    estado.cuenta = { nombre: usuario.nombre, datos: usuario.datos || {} };
    estado.invitado = false;
    marcarPestana(true);
    reiniciar();  // limpia el flujo y llena los pasos con los datos guardados
    mostrarVista("app");
  }

  async function cerrarSesionLocal() {
    estado.cuenta = null;
    estado.invitado = false;
    marcarPestana(false);
    borrarBorrador();
    reiniciar();
    $("#form-acceso").reset();
    cambiarModoAcceso("entrar");
    mostrarVista("acceso");
  }

  // --- Pantalla de acceso ---
  let modoAcceso = "entrar";
  function cambiarModoAcceso(modo) {
    modoAcceso = modo;
    const crear = modo === "crear";
    $("#tab-entrar").classList.toggle("activa", !crear);
    $("#tab-crear").classList.toggle("activa", crear);
    $("#tab-entrar").setAttribute("aria-selected", String(!crear));
    $("#tab-crear").setAttribute("aria-selected", String(crear));
    $("#campo-confirmar").hidden = !crear;
    $("#pista-contrasena").hidden = !crear;
    $("#acc-contrasena").setAttribute("autocomplete", crear ? "new-password" : "current-password");
    $("#btn-acceso").textContent = crear ? "Crear mi cuenta" : "Iniciar sesión";
    mostrarError($("#form-acceso"), "");
  }

  async function enviarAcceso(ev) {
    ev.preventDefault();
    const form = $("#form-acceso");
    const nombre = $("#acc-nombre").value.trim();
    const contrasena = $("#acc-contrasena").value;
    if (!nombre || !contrasena) { mostrarError(form, "Escribe tu nombre completo y tu contraseña."); return; }
    if (modoAcceso === "crear" && contrasena !== $("#acc-confirmar").value) {
      mostrarError(form, "Las contraseñas no coinciden.");
      return;
    }
    const boton = $("#btn-acceso");
    boton.disabled = true;
    try {
      const usuario = modoAcceso === "crear"
        ? await window.Cuentas.registrar(nombre, contrasena)
        : await window.Cuentas.entrar(nombre, contrasena);
      mostrarError(form, "");
      form.reset();
      await iniciarConCuenta(usuario);
      avisar(modoAcceso === "crear" ? "¡Listo! Tu cuenta se creó." : "Hola de nuevo, " + usuario.nombre.split(" ")[0] + ".");
    } catch (e) {
      mostrarError(form, e.message);
    } finally {
      boton.disabled = false;
    }
  }

  // --- Mi cuenta ---
  function formatoFecha(segundos) {
    return new Date(segundos * 1000).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
  }

  async function cargarCvs() {
    const lista = $("#lista-cvs");
    lista.replaceChildren(el("p", { class: "vacio", text: "Cargando tus CV…" }));
    let cvs;
    try { cvs = await window.Cuentas.listarCvs(); }
    catch (e) { lista.replaceChildren(el("p", { class: "vacio", text: "No se pudieron cargar tus CV: " + e.message })); return; }
    if (!cvs.length) {
      lista.replaceChildren(el("p", { class: "vacio", text: "Aún no tienes CV guardados. Elige una vacante en Despega y tu CV adaptado se guardará aquí." }));
      return;
    }
    lista.replaceChildren.apply(lista, cvs.map(function (cv) {
      const nombreTex = "CV_" + (cv.puesto || "despega").replace(/[^\wÀ-ÿ]+/g, "_") + ".tex";
      const eliminar = el("button", { class: "btn btn-fantasma btn-chico", type: "button" }, "🗑 Eliminar");
      eliminar.addEventListener("click", async function () {
        // Confirmación en dos clics, sin ventanas emergentes.
        if (!eliminar.dataset.confirmar) {
          eliminar.dataset.confirmar = "1";
          eliminar.textContent = "¿Seguro? Clic para eliminar";
          eliminar.classList.add("btn-peligro");
          return;
        }
        eliminar.disabled = true;
        try { await window.Cuentas.eliminarCv(cv.id); avisar("CV eliminado."); cargarCvs(); }
        catch (e) { avisar("No se pudo eliminar: " + e.message); eliminar.disabled = false; }
      });
      // Con servidor y pdflatex hay un PDF compilado; en el navegador se imprime desde los datos guardados.
      let verPdf = null;
      if (cv.tiene_pdf) {
        verPdf = el("a", { class: "btn btn-secundario btn-chico", href: window.Cuentas.urlPdf(cv.id), target: "_blank", rel: "noopener" }, "👁 Ver PDF");
      } else if (window.Cuentas.modo === "navegador") {
        verPdf = el("button", { class: "btn btn-secundario btn-chico", type: "button" }, "👁 Ver / PDF");
        verPdf.addEventListener("click", async function () {
          try { imprimirCvGuardado((await window.Cuentas.obtenerCv(cv.id)).datos); }
          catch (e) { avisar(e.message); }
        });
      }
      const tex = el("button", { class: "btn btn-fantasma btn-chico", type: "button" }, "⬇ .tex");
      tex.addEventListener("click", async function () {
        try { descargarTexto(await window.Cuentas.leerTex(cv.id), nombreTex); }
        catch (e) { avisar(e.message); }
      });
      const overleaf = el("button", { class: "btn btn-fantasma btn-chico", type: "button" }, "↗ Overleaf");
      overleaf.addEventListener("click", async function () {
        try { enviarAOverleaf(await window.Cuentas.leerTex(cv.id), nombreTex); }
        catch (e) { avisar(e.message); }
      });
      return el("div", { class: "cv-guardado" },
        el("div", { class: "cv-guardado-info" },
          el("strong", { text: cv.puesto || "CV" }),
          el("span", { text: (cv.empresa ? cv.empresa + " · " : "") + formatoFecha(cv.creado) })),
        el("div", { class: "acciones" },
          verPdf, tex, overleaf, eliminar));
    }));
  }

  function abrirMiCuenta() {
    const c = estado.cuenta, d = c.datos || {}, ct = d.contacto || {}, e = d.estudios || {};
    const poner = function (sel, valor) { $(sel).value = valor == null ? "" : valor; };
    poner("#mc-nombre", c.nombre); poner("#mc-usuario-oculto", c.nombre);
    poner("#mc-edad", d.edad); poner("#mc-historia", d.historia);
    poner("#mc-telefono", ct.telefono); poner("#mc-correo", ct.correo);
    poner("#mc-ciudad", ct.ciudad); poner("#mc-enlace", ct.enlace);
    poner("#mc-escuela", e.escuela); poner("#mc-nivel", e.nivel); poner("#mc-periodo", e.periodo);
    llenarExtras("#mc-proyectos", "#mc-logros", d);
    ["#form-mis-datos", "#form-nombre", "#form-contrasena", "#form-eliminar"].forEach(function (f) { mostrarError($(f), ""); });
    $("#form-contrasena").reset();
    $("#form-eliminar").reset();
    $(".zona-peligro").open = false;
    mostrarVista("cuenta");
    $("#t-mi-cuenta").focus({ preventScroll: true });
    cargarCvs();
    cargarHistorial();
  }

  async function guardarMisDatos(ev) {
    ev.preventDefault();
    const form = $("#form-mis-datos");
    const v = function (sel) { return $(sel).value.trim(); };
    const extras = leerExtras("#mc-proyectos", "#mc-logros");
    if (extras.sinNombre > 0) { mostrarError(form, "Hay " + extras.sinNombre + " proyecto(s) o logro(s) sin nombre: escríbelo o quítalo."); return; }
    const datos = Object.assign({}, estado.cuenta.datos, {
      edad: v("#mc-edad"),
      historia: v("#mc-historia"),
      contacto: { telefono: v("#mc-telefono"), correo: v("#mc-correo"), ciudad: v("#mc-ciudad"), enlace: v("#mc-enlace") },
      estudios: { escuela: v("#mc-escuela"), nivel: v("#mc-nivel"), periodo: v("#mc-periodo") },
      proyectos: extras.proyectos,
      logros: extras.logros
    });
    try {
      await window.Cuentas.guardarDatos(datos);
      estado.cuenta.datos = datos;
      llenarPasos(estado.cuenta);  // Despega usa los datos nuevos desde ya
      mostrarError(form, "");
      avisar("Tus datos se guardaron.");
    } catch (e) {
      mostrarError(form, e.message);
    }
  }

  async function guardarNombre(ev) {
    ev.preventDefault();
    const form = $("#form-nombre");
    try {
      const anterior = estado.cuenta.nombre;
      const r = await window.Cuentas.cambiarNombre($("#mc-nombre").value);
      estado.cuenta.nombre = r.nombre;
      $("#mc-nombre").value = r.nombre;
      if ($("#in-nombre").value.trim() === anterior) $("#in-nombre").value = r.nombre;
      actualizarEncabezado("cuenta");
      mostrarError(form, "");
      avisar("Tu nombre se actualizó.");
    } catch (e) {
      mostrarError(form, e.message);
    }
  }

  async function guardarContrasena(ev) {
    ev.preventDefault();
    const form = $("#form-contrasena");
    if ($("#mc-nueva").value !== $("#mc-confirmar").value) { mostrarError(form, "Las contraseñas nuevas no coinciden."); return; }
    try {
      await window.Cuentas.cambiarContrasena($("#mc-actual").value, $("#mc-nueva").value);
      form.reset();
      mostrarError(form, "");
      avisar("Tu contraseña se cambió." + (window.Cuentas.modo === "servidor" ? " Se cerraron tus otras sesiones." : ""));
    } catch (e) {
      mostrarError(form, e.message);
    }
  }

  async function eliminarCuenta(ev) {
    ev.preventDefault();
    const form = $("#form-eliminar");
    try {
      await window.Cuentas.eliminar($("#mc-eliminar-contrasena").value);
      await cerrarSesionLocal();
      avisar("Tu cuenta y tus CV se eliminaron.");
    } catch (e) {
      mostrarError(form, e.message);
    }
  }

  async function configurarCuentas() {
    $("#tab-entrar").addEventListener("click", function () { cambiarModoAcceso("entrar"); });
    $("#tab-crear").addEventListener("click", function () { cambiarModoAcceso("crear"); });
    $("#form-acceso").addEventListener("submit", enviarAcceso);
    $("#btn-invitado").addEventListener("click", function () { estado.invitado = true; mostrarVista("app"); });
    $("#btn-entrar").addEventListener("click", function () { cambiarModoAcceso("entrar"); mostrarVista("acceso"); $("#acc-nombre").focus(); });
    $("#btn-cuenta").addEventListener("click", abrirMiCuenta);
    $("#btn-volver-app").addEventListener("click", function () { mostrarVista("app"); });
    $("#mc-agregar-proyecto").addEventListener("click", function () { agregarProyecto(null, "#mc-proyectos", true); });
    $("#mc-agregar-logro").addEventListener("click", function () { agregarLogro(null, "#mc-logros", true); });
    $("#form-mis-datos").addEventListener("submit", guardarMisDatos);
    $("#form-nombre").addEventListener("submit", guardarNombre);
    $("#form-contrasena").addEventListener("submit", guardarContrasena);
    $("#form-eliminar").addEventListener("submit", eliminarCuenta);
    $("#btn-salir").addEventListener("click", async function () {
      try { await window.Cuentas.salir(); } catch (e) { /* la sesión local se cierra igual */ }
      await cerrarSesionLocal();
    });

    const s = await window.Cuentas.sesion();
    estado.cuentasDisponibles = s.disponible;
    // La sesión dura lo que dura la pestaña: con el servidor la cookie se comparte entre
    // pestañas, así que una pestaña nueva (sin la marca de esta pestaña) pide iniciar sesión.
    if (s.usuario && s.modo === "servidor" && !pestanaConSesion()) s.usuario = null;
    $("#nota-cuentas").textContent = s.modo === "navegador"
      ? "🔒 Tu cuenta se guarda en este navegador y en este equipo. Para ver tus datos, entra siempre desde aquí."
      : "🔒 Tu cuenta se guarda en el servidor de Despega de este equipo.";
    if (!s.disponible && s.motivo) console.info("Cuentas no disponibles:", s.motivo);
    const borrador = leerBorrador();
    if (s.usuario) {
      await iniciarConCuenta(s.usuario);
      if (borrador && borrador.dueno === s.usuario.nombre) await restaurarBorrador(borrador);
    } else if (!s.disponible || (borrador && borrador.invitado)) {
      estado.invitado = true;  // sin cuentas, o invitado que recargó la página
      mostrarVista("app");
      if (borrador && borrador.invitado) await restaurarBorrador(borrador);
    } else {
      mostrarVista("acceso");
    }
    restaurando = false;

    // Autoguardado: al escribir, al cambiar de pestaña del navegador y al recargar o cerrar.
    document.addEventListener("input", programarBorrador);
    document.addEventListener("change", programarBorrador);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") { guardarBorrador(); guardarCambiosEnCuenta(); }
    });
    window.addEventListener("pagehide", function () { guardarBorrador(); guardarCambiosEnCuenta(); });
  }

  // ---------- Autoguardado (borrador de esta pestaña) ----------
  // Todo el avance (pasos, campos, vacantes, CV, práctica y simulación) se guarda en
  // sessionStorage: sobrevive a recargar la página y se borra al cerrar la pestaña.
  const CLAVE_BORRADOR = "despega.borrador.v1";
  const CLAVE_PESTANA = "despega.pestana.v1";
  const CAMPOS_BORRADOR = ["#in-nombre", "#in-edad", "#in-historia", "#in-resumen", "#ent-nombre", "#ent-historia",
    "#in-respuesta", "#sim-respuesta"].concat(CAMPOS_CV);
  let restaurando = true;   // no se guarda mientras se carga la página
  let temporizadorBorrador = null;

  function marcarPestana(activa) {
    try { if (activa) sessionStorage.setItem(CLAVE_PESTANA, "1"); else sessionStorage.removeItem(CLAVE_PESTANA); }
    catch (e) { /* sin sessionStorage */ }
  }
  function pestanaConSesion() {
    try { return sessionStorage.getItem(CLAVE_PESTANA) === "1"; } catch (e) { return false; }
  }

  function leerBorrador() {
    try { return JSON.parse(sessionStorage.getItem(CLAVE_BORRADOR) || "null"); } catch (e) { return null; }
  }
  function borrarBorrador() {
    clearTimeout(temporizadorBorrador);
    try { sessionStorage.removeItem(CLAVE_BORRADOR); } catch (e) { /* nada que borrar */ }
  }
  function programarBorrador() {
    if (restaurando) return;
    clearTimeout(temporizadorBorrador);
    temporizadorBorrador = setTimeout(guardarBorrador, 400);
  }

  // Proyectos y logros tal como están escritos (también los que aún no tienen nombre).
  function filasExtras(selProyectos, selLogros) {
    const valor = function (f, clase) { return f.querySelector("." + clase).value; };
    return {
      proyectos: $$(selProyectos + " .extra").map(function (f) {
        return { nombre: valor(f, "p-nombre"), herramientas: valor(f, "p-herramientas"), fecha: valor(f, "p-fecha"), descripcion: valor(f, "p-descripcion").split("\n") };
      }),
      logros: $$(selLogros + " .extra").map(function (f) {
        return { titulo: valor(f, "l-titulo"), detalle: valor(f, "l-detalle"), fecha: valor(f, "l-fecha") };
      })
    };
  }

  function guardarBorrador() {
    clearTimeout(temporizadorBorrador);
    if (restaurando || (!estado.cuenta && !estado.invitado)) return;
    const campos = {};
    CAMPOS_BORRADOR.forEach(function (s) { campos[s] = $(s).value; });
    const b = {
      version: 1,
      dueno: estado.cuenta ? estado.cuenta.nombre : null,
      invitado: !estado.cuenta,
      vista: estado.vista === "cuenta" ? "cuenta" : "app",
      flujo: estado.flujo, paso: estado.paso, tabEnt: estado.tabEnt,
      campos: campos,
      datosCvAbierto: $(".datos-cv").open,
      extras: filasExtras("#lista-proyectos", "#lista-logros"),
      perfil: estado.perfil, recomendaciones: estado.recomendaciones, vacante: estado.vacante, cv: estado.cv, contacto: estado.contacto,
      entrenamiento: claveVacanteEnt === null ? null : {
        clave: claveVacanteEnt,
        fuente: fuenteEntrevista(),
        catalogo: $("#ent-catalogo").value,
        entrevista: estado.entrevista,
        simulacion: estado.simulacion,
        ultimoProblema: ultimoProblemaSim,
        practica: { preguntas: estado.preguntas, i: estado.iPregunta, puntajes: estado.puntajes, final: !$("#ent-final").hidden },
        problemas: nodoProblemas ? $$("#ent-aprendizaje .problema textarea").map(function (t) { return t.value; }) : null
      }
    };
    try { sessionStorage.setItem(CLAVE_BORRADOR, JSON.stringify(b)); } catch (e) { /* sin espacio: no se guarda el borrador */ }
  }

  async function restaurarBorrador(b) {
    if (!b || b.version !== 1) return;
    try {
      // Paso 1 y paso 3
      Object.keys(b.campos || {}).forEach(function (s) { const c = $(s); if (c) c.value = b.campos[s]; });
      if (b.datosCvAbierto) $(".datos-cv").open = true;
      if (b.extras) llenarExtras("#lista-proyectos", "#lista-logros", b.extras);

      // Perfil, vacantes y CV
      estado.perfil = b.perfil; estado.recomendaciones = b.recomendaciones || []; estado.vacante = b.vacante;
      estado.cv = b.cv; estado.contacto = b.contacto || {};
      if (estado.perfil) {
        const resumen = $("#in-resumen").value;
        renderHabilidades();
        $("#in-resumen").value = resumen;
      }
      if (estado.perfil && estado.recomendaciones.length) renderVacantes();
      if (estado.perfil && estado.vacante && estado.cv) renderCV();
      irA(b.paso || 1);

      // Entrenamiento
      const ent = b.entrenamiento;
      if (ent && ent.entrevista && ent.entrevista.vacante) {
        if (ent.fuente.indexOf("guardado-") === 0 && estado.cuenta) {
          try { cvsParaEntrevista = (await window.Cuentas.listarCvs()).slice(0, 5); } catch (e) { /* sin CV guardados */ }
        }
        $("#ent-catalogo").value = ent.catalogo;
        claveVacanteEnt = ent.clave;          // evita que se recargue la vacante y se pierda el avance
        prepararOpcionesEntrevista(ent.fuente);
        $("#ent-nombre").value = b.campos["#ent-nombre"] || "";
        $("#ent-historia").value = b.campos["#ent-historia"] || "";
        claveVacanteEnt = ent.clave;
        estado.entrevista = ent.entrevista;
        ultimoProblemaSim = ent.ultimoProblema || null;
        const v = ent.entrevista.vacante;
        $("#ent-vacante-nombre").textContent = v.puesto + " en " + v.empresa;
        $("#sim-vacante-nombre").textContent = v.puesto + " en " + v.empresa;
        renderAprendizaje(v, ent.entrevista.perfil);
        if (ent.problemas) {
          $$("#ent-aprendizaje .problema textarea").forEach(function (t, i) { t.value = ent.problemas[i] || ""; });
        }

        // Práctica de aprendizaje
        reiniciarPractica();
        const pr = ent.practica || {};
        if (pr.preguntas && pr.preguntas.length) {
          estado.preguntas = pr.preguntas; estado.iPregunta = pr.i || 0; estado.puntajes = pr.puntajes || [];
          $("#ent-practica-inicio").hidden = true;
          if (pr.final) { estado.iPregunta = estado.preguntas.length - 1; siguientePregunta(); }
          else { renderPregunta(); $("#in-respuesta").value = b.campos["#in-respuesta"] || ""; }
        }

        // Simulación
        estado.simulacion = ent.simulacion || { preguntas: [], i: 0, respuestas: [], resultado: null };
        const sim = estado.simulacion;
        if (sim.resultado) renderResultadoSimulacion();
        else if (sim.preguntas.length) { renderSimPregunta(); $("#sim-respuesta").value = b.campos["#sim-respuesta"] || ""; }
        mostrarEstadoSimulacion();
        if (b.flujo === "entrevista") irEnt(b.tabEnt || "aprendizaje");
        else ubicarSobreTi();
      } else if (b.flujo === "entrevista") {
        abrirEntrenamiento();
      }

      if (b.vista === "cuenta" && estado.cuenta) abrirMiCuenta();
      window.scrollTo({ top: 0 });
    } catch (e) {
      console.error("No se pudo restaurar el avance guardado:", e);
    }
  }

  // Con sesión iniciada, los datos del paso 1 y los proyectos y logros también se guardan en la cuenta.
  function guardarCambiosEnCuenta() {
    if (!estado.cuenta || restaurando) return;
    const v = function (sel) { return $(sel).value.trim(); };
    const extras = leerExtras();
    const cambios = {
      edad: v("#in-edad"),
      historia: v("#in-historia"),
      contacto: { telefono: v("#in-telefono"), correo: v("#in-correo"), ciudad: v("#in-ciudad"), enlace: v("#in-enlace") },
      estudios: { escuela: v("#in-escuela"), nivel: v("#in-nivel"), periodo: v("#in-periodo") },
      proyectos: extras.proyectos,
      logros: extras.logros
    };
    const d = estado.cuenta.datos || {};
    const distinto = Object.keys(cambios).some(function (k) { return JSON.stringify(cambios[k]) !== JSON.stringify(d[k] == null ? "" : d[k]); });
    if (distinto) guardarEnCuenta(cambios);
  }

  // ---------- Reinicio ----------
  function reiniciar() {
    estado.perfil = null; estado.recomendaciones = []; estado.vacante = null; estado.cv = null;
    estado.preguntas = []; estado.iPregunta = 0; estado.puntajes = []; estado.contacto = {};
    estado.entrevista = { vacante: null, perfil: null }; estado.tabEnt = "aprendizaje"; cvsParaEntrevista = [];
    claveVacanteEnt = null;
    reiniciarPractica();
    estado.simulacion = { preguntas: [], i: 0, respuestas: [], resultado: null };
    $("#sim-respuesta").value = "";
    ["#in-nombre", "#in-edad", "#in-historia", "#in-resumen", "#in-respuesta", "#ent-nombre", "#ent-historia"].concat(CAMPOS_CV).forEach(function (s) { $(s).value = ""; });
    $("#lista-proyectos").replaceChildren();
    $("#lista-logros").replaceChildren();
    Object.keys(AGENTES).forEach(function (a) { marcarAgente(a, "espera"); });
    $("#bitacora").replaceChildren();
    if (estado.cuenta) llenarPasos(estado.cuenta);
    irA(1);
  }

  // ---------- Inicio ----------
  function iniciar() {
    detectarModo();

    renderOpciones();
    // Al escribir o elegir una habilidad conocida, el selector muestra su tipo automáticamente.
    $("#in-nueva-habilidad").addEventListener("input", function (e) {
      const conocida = buscarConocida(e.target.value.trim());
      if (conocida) elegirTipo(conocida.categoria);
    });

    $("#btn-ejemplo").addEventListener("click", function () {
      $("#in-nombre").value = EJEMPLO.nombre;
      $("#in-edad").value = EJEMPLO.edad;
      $("#in-historia").value = EJEMPLO.historia;
      $("#in-ciudad").value = EJEMPLO.ciudad;
      $("#in-escuela").value = EJEMPLO.escuela;
      $("#in-nivel").value = EJEMPLO.nivel;
      $("#in-periodo").value = EJEMPLO.periodo;
      $("#btn-analizar").focus();
    });

    const bAnalizar = $("#btn-analizar");
    bAnalizar.addEventListener("click", conCarga(bAnalizar, "Analizando…", analizarHistoria));

    $("#form-agregar").addEventListener("submit", agregarHabilidad);

    $("#btn-aprobar-perfil").addEventListener("click", aprobarPerfil);

    $("#btn-agregar-proyecto").addEventListener("click", function () { agregarProyecto(null, "#lista-proyectos", true); });
    $("#btn-agregar-logro").addEventListener("click", function () { agregarLogro(null, "#lista-logros", true); });
    const bGuardarExtras = $("#btn-guardar-extras");
    bGuardarExtras.addEventListener("click", conCarga(bGuardarExtras, "Buscando vacantes…", guardarExtrasYBuscar));
    const bOmitir = $("#btn-omitir-extras");
    bOmitir.addEventListener("click", conCarga(bOmitir, "Buscando vacantes…", omitirExtras));

    // Flujos: crear CV y entrenar entrevista.
    llenarCatalogoEntrevista();
    $("#flujo-cv").addEventListener("click", function () { irA(estado.paso || 1); });
    $("#flujo-entrevista").addEventListener("click", function () { abrirEntrenamiento(); });
    $("#btn-ir-entrenar").addEventListener("click", function () { abrirEntrenamiento("actual"); });
    $("#btn-otro-cv").addEventListener("click", function () { reiniciar(); });
    $("#ent-catalogo").addEventListener("change", actualizarVacanteEntrevista);
    $("#tab-aprendizaje").addEventListener("click", function () { mostrarTabEnt("aprendizaje"); });
    $("#tab-simulacion").addEventListener("click", function () { mostrarTabEnt("simulacion"); });
    $$(".ir-simulacion").forEach(function (b) { b.addEventListener("click", function () { mostrarTabEnt("simulacion"); window.scrollTo({ top: 0, behavior: "smooth" }); }); });
    $$(".ir-aprendizaje").forEach(function (b) { b.addEventListener("click", function () { mostrarTabEnt("aprendizaje"); window.scrollTo({ top: 0, behavior: "smooth" }); }); });
    const bPractica = $("#btn-practica-comenzar");
    bPractica.addEventListener("click", conCarga(bPractica, "Preparando práctica…", comenzarPractica));
    // Si cambia la historia (vacante del catálogo), el perfil se vuelve a armar en la siguiente práctica o simulación.
    $("#ent-historia").addEventListener("input", function () {
      if (fuenteEntrevista() === "catalogo" && !estado.preguntas.length && !estado.simulacion.preguntas.length) estado.entrevista.perfil = null;
    });
    const bSimComenzar = $("#btn-sim-comenzar");
    bSimComenzar.addEventListener("click", conCarga(bSimComenzar, "Preparando simulación…", comenzarSimulacion));
    const bSimRepetir = $("#btn-sim-repetir");
    bSimRepetir.addEventListener("click", conCarga(bSimRepetir, "Preparando simulación…", comenzarSimulacion));
    const bSimResponder = $("#btn-sim-responder");
    bSimResponder.addEventListener("click", async function () {
      if (bSimResponder.disabled) return;
      bSimResponder.disabled = true;
      try { await responderSimulacion(); }
      catch (e) { console.error(e); avisar("Algo salió mal: " + e.message); }
      finally { bSimResponder.disabled = false; bSimResponder.textContent = textoBotonSimulacion(); }
    });
    $("#btn-sim-escuchar").addEventListener("click", function () { leerEnVoz($("#sim-pregunta").textContent); });
    $("#btn-ent-ejemplo").addEventListener("click", function () {
      $("#ent-nombre").value = EJEMPLO.nombre;
      $("#ent-historia").value = EJEMPLO.historia;
    });

    $("#btn-descargar").addEventListener("click", function () {
      avisar("Elige «Guardar como PDF» en la ventana de impresión.");
      setTimeout(function () { window.print(); }, 300);
    });
    $("#btn-descargar-tex").addEventListener("click", descargarLatex);
    $("#btn-overleaf").addEventListener("click", abrirEnOverleaf);

    const bEvaluar = $("#btn-evaluar");
    bEvaluar.addEventListener("click", conCarga(bEvaluar, "Evaluando…", evaluarRespuesta));
    $("#btn-siguiente").addEventListener("click", siguientePregunta);
    $("#btn-escuchar").addEventListener("click", function () { leerEnVoz($("#ent-pregunta").textContent); });
    $("#btn-otra-vez").addEventListener("click", function () {
      estado.iPregunta = 0; estado.puntajes = [];
      renderPregunta();
    });

    $("#btn-reiniciar").addEventListener("click", function () { reiniciar(); mostrarVista("app"); guardarBorrador(); });
    configurarCuentas();

    document.addEventListener("click", function (e) {
      const destino = e.target.closest("[data-ir]");
      if (destino) irA(Number(destino.dataset.ir));
    });


    if ("speechSynthesis" in window) window.speechSynthesis.getVoices(); // precarga voces
  }

  document.addEventListener("DOMContentLoaded", iniciar);
})();
