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
    cuenta: null,          // { nombre, datos } si hay sesión iniciada
    cuentasDisponibles: false,
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
    if (n === 6) return estado.preguntas.length > 0;
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
        campoExtra("Nombre del proyecto", "p-nombre", datos.nombre, { placeholder: "Ej. Venta de postres en la escuela" }),
        campoExtra("Herramientas o tema", "p-herramientas", datos.herramientas, { placeholder: "Ej. Instagram, Excel" }),
        campoExtra("Fecha", "p-fecha", datos.fecha, { placeholder: "Ej. 2024", chico: true, max: 30 })),
      campoExtra("¿Qué hiciste y qué lograste? (una idea por renglón)", "p-descripcion",
        (datos.descripcion || []).join("\n"),
        { multilinea: true, placeholder: "Ej. Organicé la producción y venta; vendí más de 300 piezas en un semestre." }),
      botonQuitar("Quitar proyecto"));
    $(contenedor || "#lista-proyectos").append(fila);
    if (enfocar) fila.querySelector("input").focus();
  }

  function agregarLogro(datos, contenedor, enfocar) {
    datos = datos || {};
    const fila = el("div", { class: "extra extra-logro" },
      el("div", { class: "fila-extra" },
        campoExtra("Logro", "l-titulo", datos.titulo, { placeholder: "Ej. Torneo estatal de matemáticas" }),
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
    guardarCvEnCuenta();
    irA(5);
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
      el("div", null, seccionesExtra(p))
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
    irA(6);
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

  // ---------- Cuentas ----------
  // datos de la cuenta: { edad, historia, contacto:{telefono,correo,ciudad,enlace}, estudios:{escuela,nivel,periodo}, proyectos, logros }

  function mostrarVista(vista) {
    $("#acceso").hidden = vista !== "acceso";
    $("#mi-cuenta").hidden = vista !== "cuenta";
    $(".pasos").hidden = vista !== "app";
    $(".distribucion").hidden = vista !== "app";
    $("#btn-reiniciar").hidden = vista === "acceso";
    actualizarEncabezado(vista);
    window.scrollTo({ top: 0 });
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
    reiniciar();  // limpia el flujo y llena los pasos con los datos guardados
    mostrarVista("app");
  }

  async function cerrarSesionLocal() {
    estado.cuenta = null;
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
    $("#btn-invitado").addEventListener("click", function () { mostrarVista("app"); });
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
    $("#nota-cuentas").textContent = s.modo === "navegador"
      ? "🔒 Tu cuenta se guarda en este navegador y en este equipo. Para ver tus datos, entra siempre desde aquí."
      : "🔒 Tu cuenta se guarda en el servidor de Despega de este equipo.";
    if (!s.disponible && s.motivo) console.info("Cuentas no disponibles:", s.motivo);
    if (s.usuario) await iniciarConCuenta(s.usuario);
    else mostrarVista(s.disponible ? "acceso" : "app");  // sin servidor: modo invitado directo
  }

  // ---------- Reinicio ----------
  function reiniciar() {
    estado.perfil = null; estado.recomendaciones = []; estado.vacante = null; estado.cv = null;
    estado.preguntas = []; estado.iPregunta = 0; estado.puntajes = []; estado.contacto = {};
    ["#in-nombre", "#in-edad", "#in-historia", "#in-resumen", "#in-respuesta"].concat(CAMPOS_CV).forEach(function (s) { $(s).value = ""; });
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

    $("#btn-reiniciar").addEventListener("click", function () { reiniciar(); mostrarVista("app"); });
    configurarCuentas();

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
