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
    nombre: "Mariana López",
    edad: 20,
    historia:
      "Ayudo en la papelería de mi familia desde hace tres años: atiendo a los clientes, cobro en caja y hago el corte del día. " +
      "También manejo el Instagram y el TikTok del negocio; grabo videos de los productos nuevos y ya tenemos más de 2,000 seguidores. " +
      "Llevo el inventario en Excel y aviso a mi papá cuando hay que surtir. " +
      "Los fines de semana doy clases de regularización de matemáticas a mis primos. " +
      "En la prepa organicé la kermés de fin de año junto con mi grupo.",
    ciudad: "Guadalajara, MX",
    escuela: "CETis 14",
    nivel: "Bachillerato técnico en contabilidad",
    periodo: "2021 – 2024"
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
    if (n === 3) return estado.recomendaciones.length > 0;
    if (n === 4) return !!estado.cv;
    if (n === 5) return estado.preguntas.length > 0;
    return false;
  }

  function irA(n) {
    if (!puedeIrA(n)) return;
    estado.paso = n;
    $$(".paso").forEach(function (s) { s.classList.toggle("activo", s.id === "paso-" + n); });
    $$("#lista-pasos li").forEach(function (li) {
      const p = Number(li.dataset.paso);
      li.classList.toggle("activo", p === n);
      li.classList.toggle("hecho", p < n);
      if (p === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    const titulo = $("#t-paso-" + n);
    if (titulo) { titulo.setAttribute("tabindex", "-1"); titulo.focus({ preventScroll: true }); }
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
    estado.recomendaciones = []; estado.vacante = null; estado.cv = null; estado.preguntas = [];
    ["buscador", "adaptador", "entrenador"].forEach(function (a) { marcarAgente(a, "espera"); });

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

  // ---------- Paso 2 → Buscador ----------
  async function buscarVacantes() {
    if (!estado.perfil.habilidades.length) { avisar("Agrega al menos una habilidad."); return; }
    estado.perfil.resumen_profesional = $("#in-resumen").value.trim() || estado.perfil.resumen_profesional;

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
    irA(3);
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
            el("p", { class: "vacante-empresa", text: v.empresa }),
            el("div", { class: "vacante-datos" },
              ["📍 " + v.ciudad, "🏢 " + v.modalidad, "⏱ " + v.jornada, "💰 " + v.sueldo].map(function (d) {
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
    estado.preguntas = [];
    marcarAgente("entrenador", "espera");
    registrar("adaptador", "ajustando tu CV para " + v.puesto + "…");

    const r = await llamarAgente("adaptador", "adaptador", { perfil: estado.perfil, vacante: v }, function (x) {
      return x && x.resumen_adaptado && Array.isArray(x.habilidades_destacadas) && Array.isArray(x.logros);
    });
    estado.cv = r;
    registrar("adaptador", "CV listo con " + r.cambios.length + " mejoras.");
    renderCV();
    irA(4);
  }

  function renderCV() {
    const p = estado.perfil, v = estado.vacante, cv = estado.cv;
    const requeridas = v.habilidades.map(normalizar);
    $("#cv-vacante-nombre").textContent = v.puesto + " en " + v.empresa;

    const subtitulo = (p.edad ? p.edad + " años · " : "") + "Busco mi primer empleo";
    const historiaCorta = p.historia.length > 280 ? p.historia.slice(0, 279) + "…" : p.historia;

    $("#cv-antes").replaceChildren(
      el("p", { class: "cv-nombre", text: p.nombre }),
      el("p", { class: "cv-objetivo", text: subtitulo }),
      el("h4", { text: "Perfil" }),
      el("p", { text: p.resumen_profesional }),
      el("h4", { text: "Habilidades" }),
      el("div", { class: "chips" }, p.habilidades.map(function (h) { return el("span", { class: "chip", text: h.nombre }); })),
      el("h4", { text: "Experiencia" }),
      el("p", { text: historiaCorta })
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
      el("h4", { text: "Experiencia y logros" }),
      el("ul", null, cv.logros.map(function (l) { return el("li", { text: l }); }))
    );

    $("#lista-cambios").replaceChildren.apply($("#lista-cambios"), (cv.cambios || []).map(function (c) { return el("li", { text: c }); }));

    // Versión para imprimir / guardar como PDF, con el mismo diseño que la plantilla LaTeX.
    const imprimible = $("#cv-imprimir");
    imprimible.replaceChildren.apply(imprimible, window.CvLatex.generarHtml(datosDelCV(), el));
  }

  // ---------- CV en LaTeX ----------
  function datosDelCV() {
    return window.CvLatex.datosCV(estado.perfil, estado.vacante, estado.cv, estado.contacto);
  }

  function nombreArchivoCV() {
    const base = normalizar(estado.perfil.nombre).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "cv";
    return "CV_" + base + ".tex";
  }

  function descargarLatex() {
    const blob = new Blob([window.CvLatex.generarLatex(datosDelCV())], { type: "application/x-tex;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: nombreArchivoCV() });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    avisar("Listo: compílalo con pdflatex o súbelo a Overleaf.");
  }

  // Overleaf acepta un documento enviado por formulario (POST a /docs) y lo compila a PDF.
  function abrirEnOverleaf() {
    const form = el("form", { action: "https://www.overleaf.com/docs", method: "post", target: "_blank" },
      el("input", { type: "hidden", name: "snip", value: window.CvLatex.generarLatex(datosDelCV()) }),
      el("input", { type: "hidden", name: "snip_name", value: nombreArchivoCV() }),
      el("input", { type: "hidden", name: "engine", value: "pdflatex" }));
    document.body.append(form);
    form.submit();
    form.remove();
  }

  // ---------- Paso 4 → Entrenador ----------
  async function prepararEntrevista() {
    registrar("entrenador", "preparando preguntas para " + estado.vacante.empresa + "…");
    const r = await llamarAgente("entrenador_preguntas", "entrenador", { perfil: estado.perfil, vacante: estado.vacante }, function (x) {
      return x && Array.isArray(x.preguntas) && x.preguntas.length > 0;
    });
    estado.preguntas = r.preguntas.slice(0, 3);
    estado.iPregunta = 0;
    estado.puntajes = [];
    registrar("entrenador", estado.preguntas.length + " preguntas listas. ¡Tú puedes!");
    $("#ent-vacante-nombre").textContent = estado.vacante.puesto + " en " + estado.vacante.empresa;
    renderPregunta();
    irA(5);
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
  }

  async function evaluarRespuesta() {
    const respuesta = $("#in-respuesta").value.trim();
    if (respuesta.split(/\s+/).filter(Boolean).length < 3) {
      avisar("Escribe o dicta tu respuesta antes de evaluarla.");
      $("#in-respuesta").focus();
      return;
    }
    const q = estado.preguntas[estado.iPregunta];
    const r = await llamarAgente("entrenador_evaluar", "entrenador", {
      pregunta: q.pregunta, respuesta: respuesta, vacante: estado.vacante, perfil: estado.perfil
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
      (estado.perfil.nombre !== "Tu nombre" ? estado.perfil.nombre.split(" ")[0] + ", tu" : "Tu") +
      " promedio en la entrevista fue de " + promedio.toFixed(1) + " de 5. " +
      (promedio >= 4 ? "¡Tienes todo listo para postularte!" : "Practica una vez más con los consejos y vas a llegar con mucha más seguridad.");
    registrar("entrenador", "entrevista terminada. Promedio " + promedio.toFixed(1) + "/5.");
  }

  // ---------- Voz (Web Speech API) ----------
  const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;

  function configurarDictado(boton, destino, estadoEl) {
    const textoOriginal = boton.textContent;
    if (!Reconocimiento) {
      boton.disabled = true;
      boton.title = "Tu navegador no soporta dictado por voz. Usa Chrome o Edge.";
      return;
    }
    let rec = null;
    let huboError = false;
    boton.addEventListener("click", function () {
      if (rec) { rec.stop(); return; }
      rec = new Reconocimiento();
      rec.lang = "es-MX";
      rec.interimResults = true;
      rec.continuous = true;
      huboError = false;
      const base = destino.value.trim() ? destino.value.trim() + " " : "";
      rec.onresult = function (e) {
        let texto = "";
        for (let i = 0; i < e.results.length; i++) texto += e.results[i][0].transcript;
        destino.value = base + texto.trim();
      };
      rec.onerror = function (e) {
        huboError = true;
        estadoEl.hidden = false;
        estadoEl.textContent = e.error === "not-allowed"
          ? "⚠️ Permite el uso del micrófono en tu navegador para dictar."
          : "⚠️ No se pudo usar el micrófono (" + e.error + "). Puedes escribir tu respuesta.";
      };
      rec.onend = function () {
        rec = null;
        boton.classList.remove("grabando");
        boton.textContent = textoOriginal;
        if (!huboError) estadoEl.hidden = true;
      };
      try {
        rec.start();
        boton.classList.add("grabando");
        boton.textContent = "⏹ Detener";
        estadoEl.hidden = false;
        estadoEl.textContent = "🎙️ Escuchando… habla con naturalidad. Presiona «Detener» al terminar.";
      } catch (err) {
        rec = null;
        avisar("No se pudo iniciar el micrófono.");
      }
    });
  }

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

  // ---------- Reinicio ----------
  function reiniciar() {
    estado.perfil = null; estado.recomendaciones = []; estado.vacante = null; estado.cv = null;
    estado.preguntas = []; estado.iPregunta = 0; estado.puntajes = []; estado.contacto = {};
    ["#in-nombre", "#in-edad", "#in-historia", "#in-resumen", "#in-respuesta"].concat(CAMPOS_CV).forEach(function (s) { $(s).value = ""; });
    Object.keys(AGENTES).forEach(function (a) { marcarAgente(a, "espera"); });
    $("#bitacora").replaceChildren();
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

    const bAprobar = $("#btn-aprobar-perfil");
    bAprobar.addEventListener("click", conCarga(bAprobar, "Buscando vacantes…", buscarVacantes));

    const bCV = $("#btn-aprobar-cv");
    bCV.addEventListener("click", conCarga(bCV, "Preparando entrevista…", prepararEntrevista));

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

    $("#btn-reiniciar").addEventListener("click", reiniciar);

    document.addEventListener("click", function (e) {
      const destino = e.target.closest("[data-ir]");
      if (destino) irA(Number(destino.dataset.ir));
    });

    configurarDictado($("#btn-dictar"), $("#in-historia"), $("#estado-dictado"));
    configurarDictado($("#btn-responder-voz"), $("#in-respuesta"), $("#estado-voz-respuesta"));

    if ("speechSynthesis" in window) window.speechSynthesis.getVoices(); // precarga voces
  }

  document.addEventListener("DOMContentLoaded", iniciar);
})();
