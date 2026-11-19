// Despega · cuentas de usuario.
//
// Dos almacenes con la misma interfaz:
//  - "navegador": funciona con solo abrir la página (archivo local o sitio estático como GitHub Pages).
//    Las cuentas, datos y CV se guardan en localStorage de este navegador; las contraseñas se guardan
//    como hash PBKDF2-SHA256 con sal (Web Crypto), nunca en texto plano.
//  - "servidor": si servidor.py está corriendo, se usa su API (/api/cuenta, /api/cvs) y su base SQLite.
//
// Cuentas.sesion() elige el almacén y devuelve { disponible, modo, usuario }.
(function () {
  "use strict";

  const ITERACIONES = 310000;
  const DURACION_SESION = 30 * 24 * 3600 * 1000; // 30 días
  const MAX_CVS = 50;
  const CLAVE_BD = "despega.cuentas.v1";
  const CLAVE_SESION = "despega.sesion.v1";

  function error(mensaje, status) {
    const e = new Error(mensaje);
    e.status = status || 400;
    return e;
  }

  // ---------------------------------------------------------------------------
  // Validación (las mismas reglas que cuentas.py)
  // ---------------------------------------------------------------------------
  function limpiarNombre(nombre) {
    nombre = String(nombre || "").replace(/\s+/g, " ").trim();
    if (nombre.length < 5 || nombre.length > 80 || nombre.split(" ").length < 2) {
      throw error("Escribe tu nombre completo (nombre y apellido).");
    }
    if (!/^\p{L}+(?:[ '\-.]+\p{L}+)*\.?$/u.test(nombre)) {
      throw error("El nombre solo puede tener letras, espacios, guiones y apóstrofos.");
    }
    return nombre;
  }

  // "José  Pérez" y "jose perez" son la misma cuenta.
  function claveDe(nombre) {
    return String(nombre || "").replace(/\s+/g, " ").trim().toLowerCase()
      .normalize("NFKD").replace(/\p{M}/gu, "");
  }

  function validarContrasena(c) {
    c = String(c || "");
    if (c.length < 8) throw error("La contraseña debe tener al menos 8 caracteres.");
    if (c.length > 128) throw error("La contraseña es demasiado larga (máximo 128 caracteres).");
    return c;
  }

  // ---------------------------------------------------------------------------
  // Almacén: navegador
  // ---------------------------------------------------------------------------
  const b64 = {
    de: function (bytes) { return btoa(String.fromCharCode.apply(null, new Uint8Array(bytes))); },
    a: function (texto) { return Uint8Array.from(atob(texto), function (c) { return c.charCodeAt(0); }); }
  };

  async function hashContrasena(contrasena, sal, iteraciones) {
    const llave = await crypto.subtle.importKey("raw", new TextEncoder().encode(contrasena), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iteraciones }, llave, 256);
    return b64.de(bits);
  }

  // Comparación en tiempo constante de dos cadenas base64.
  function iguales(a, b) {
    if (a.length !== b.length) return false;
    let dif = 0;
    for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return dif === 0;
  }

  function leerBD() {
    try {
      const bd = JSON.parse(localStorage.getItem(CLAVE_BD) || "null");
      if (bd && bd.usuarios && bd.cvs) return bd;
    } catch (e) { /* datos dañados o almacenamiento bloqueado */ }
    return { siguienteId: 1, usuarios: {}, cvs: {} };
  }

  function escribirBD(bd) {
    try {
      localStorage.setItem(CLAVE_BD, JSON.stringify(bd));
    } catch (e) {
      throw error("No hay espacio en este navegador para guardar. Borra algunos CV guardados e intenta de nuevo.", 507);
    }
  }

  function leerSesion() {
    try {
      const s = JSON.parse(localStorage.getItem(CLAVE_SESION) || "null");
      if (s && s.clave && s.expira > Date.now()) return s;
    } catch (e) { /* sin sesión */ }
    return null;
  }

  function guardarSesion(clave) {
    try { localStorage.setItem(CLAVE_SESION, JSON.stringify({ clave: clave, expira: Date.now() + DURACION_SESION })); }
    catch (e) { /* sin persistencia: la sesión dura mientras la página esté abierta */ }
  }

  function borrarSesion() {
    try { localStorage.removeItem(CLAVE_SESION); } catch (e) { /* nada que borrar */ }
  }

  function publico(u) { return { nombre: u.nombre, datos: u.datos || {} }; }

  let claveActual = null; // cuenta con sesión en esta página

  function usuarioActual(bd) {
    const u = claveActual && bd.usuarios[claveActual];
    if (!u) throw error("Inicia sesión para continuar.", 401);
    return u;
  }

  async function comprobar(u, contrasena, mensaje, status) {
    const hash = await hashContrasena(String(contrasena || ""), b64.a(u.sal), u.iteraciones);
    if (!iguales(hash, u.hash)) throw error(mensaje, status);
  }

  function filaCv(cv) {
    return { id: cv.id, creado: cv.creado, puesto: cv.puesto, empresa: cv.empresa, tiene_pdf: false };
  }

  function buscarCv(bd, u, id) {
    const cv = (bd.cvs[u.id] || []).find(function (c) { return String(c.id) === String(id); });
    if (!cv) throw error("No se encontró ese CV.", 404);
    return cv;
  }

  const Navegador = {
    modo: "navegador",

    sesion: async function () {
      const s = leerSesion();
      const u = s && leerBD().usuarios[s.clave];
      if (!u) { borrarSesion(); return null; }
      claveActual = s.clave;
      guardarSesion(s.clave); // renueva los 30 días
      return publico(u);
    },

    registrar: async function (nombre, contrasena) {
      nombre = limpiarNombre(nombre);
      contrasena = validarContrasena(contrasena);
      const clave = claveDe(nombre);
      if (leerBD().usuarios[clave]) throw error("Ya existe una cuenta con ese nombre. Inicia sesión o usa tu segundo apellido.", 409);
      const sal = crypto.getRandomValues(new Uint8Array(16));
      const hash = await hashContrasena(contrasena, sal, ITERACIONES);
      const bd = leerBD(); // se vuelve a leer por si otra pestaña cambió algo mientras se calculaba el hash
      if (bd.usuarios[clave]) throw error("Ya existe una cuenta con ese nombre.", 409);
      const u = { id: bd.siguienteId++, nombre: nombre, sal: b64.de(sal), hash: hash, iteraciones: ITERACIONES, datos: {}, creado: Date.now() / 1000 };
      bd.usuarios[clave] = u;
      escribirBD(bd);
      claveActual = clave;
      guardarSesion(clave);
      return publico(u);
    },

    entrar: async function (nombre, contrasena) {
      const clave = claveDe(nombre);
      const u = leerBD().usuarios[clave];
      if (!u) {
        // Mismo trabajo y mismo mensaje que con una contraseña incorrecta.
        await hashContrasena(String(contrasena || ""), new Uint8Array(16), ITERACIONES);
        throw error("Nombre o contraseña incorrectos.", 401);
      }
      await comprobar(u, contrasena, "Nombre o contraseña incorrectos.", 401);
      claveActual = clave;
      guardarSesion(clave);
      return publico(u);
    },

    salir: async function () {
      claveActual = null;
      borrarSesion();
      return { ok: true };
    },

    guardarDatos: async function (datos) {
      if (!datos || typeof datos !== "object" || Array.isArray(datos)) throw error("Datos inválidos.");
      const bd = leerBD();
      usuarioActual(bd).datos = datos;
      escribirBD(bd);
      return { datos: datos };
    },

    cambiarNombre: async function (nombre) {
      nombre = limpiarNombre(nombre);
      const bd = leerBD();
      const u = usuarioActual(bd);
      const nueva = claveDe(nombre);
      if (nueva !== claveActual && bd.usuarios[nueva]) throw error("Ya existe otra cuenta con ese nombre.", 409);
      delete bd.usuarios[claveActual];
      u.nombre = nombre;
      bd.usuarios[nueva] = u;
      escribirBD(bd);
      claveActual = nueva;
      guardarSesion(nueva);
      return { nombre: nombre };
    },

    cambiarContrasena: async function (actual, nueva) {
      const u0 = usuarioActual(leerBD());
      await comprobar(u0, actual, "La contraseña actual no es correcta.", 403);
      nueva = validarContrasena(nueva);
      const sal = crypto.getRandomValues(new Uint8Array(16));
      const hash = await hashContrasena(nueva, sal, ITERACIONES);
      const bd = leerBD();
      const u = usuarioActual(bd);
      u.sal = b64.de(sal); u.hash = hash; u.iteraciones = ITERACIONES;
      escribirBD(bd);
      return { ok: true };
    },

    eliminar: async function (contrasena) {
      const u0 = usuarioActual(leerBD());
      await comprobar(u0, contrasena, "La contraseña actual no es correcta.", 403);
      const bd = leerBD();
      const u = usuarioActual(bd);
      delete bd.cvs[u.id];
      delete bd.usuarios[claveActual];
      escribirBD(bd);
      claveActual = null;
      borrarSesion();
      return { ok: true };
    },

    listarCvs: async function () {
      const bd = leerBD();
      const u = usuarioActual(bd);
      return (bd.cvs[u.id] || []).slice().sort(function (a, b) { return b.creado - a.creado; }).map(filaCv);
    },

    guardarCv: async function (cv) {
      const tex = String(cv.tex || "");
      if (tex.indexOf("\\documentclass") !== 0) throw error("El CV no es válido.");
      const bd = leerBD();
      const u = usuarioActual(bd);
      const lista = bd.cvs[u.id] || (bd.cvs[u.id] = []);
      const nuevo = {
        id: bd.siguienteId++, creado: Date.now() / 1000,
        puesto: String(cv.puesto || "").slice(0, 120), empresa: String(cv.empresa || "").slice(0, 120),
        tex: tex, datos: cv.datos || {}
      };
      lista.push(nuevo);
      lista.sort(function (a, b) { return b.creado - a.creado; });
      lista.splice(MAX_CVS); // conserva solo los más recientes
      escribirBD(bd);
      return filaCv(nuevo);
    },

    eliminarCv: async function (id) {
      const bd = leerBD();
      const u = usuarioActual(bd);
      const cv = buscarCv(bd, u, id);
      bd.cvs[u.id] = bd.cvs[u.id].filter(function (c) { return c !== cv; });
      escribirBD(bd);
      return { ok: true };
    },

    obtenerCv: async function (id) {
      const bd = leerBD();
      return buscarCv(bd, usuarioActual(bd), id);
    },

    leerTex: async function (id) { return (await Navegador.obtenerCv(id)).tex; },

    urlPdf: function () { return null; }
  };

  // ---------------------------------------------------------------------------
  // Almacén: servidor (servidor.py)
  // ---------------------------------------------------------------------------
  async function pedir(metodo, ruta, cuerpo) {
    const opciones = { method: metodo, credentials: "same-origin", cache: "no-store", headers: {} };
    if (cuerpo !== undefined) {
      opciones.headers["Content-Type"] = "application/json";
      opciones.body = JSON.stringify(cuerpo);
    }
    const r = await fetch(ruta, opciones);
    let j = null;
    try { j = await r.json(); } catch (e) { /* respuesta sin JSON */ }
    if (!r.ok) throw error((j && j.error) || ("Error " + r.status), r.status);
    return j;
  }

  const ruta = function (id, accion) { return "/api/cvs/" + encodeURIComponent(id) + "/" + accion; };

  const Servidor = {
    modo: "servidor",
    sesion: async function () {
      try { return await pedir("GET", "/api/cuenta"); }
      catch (e) { if (e.status === 401) return null; throw e; }
    },
    registrar: function (nombre, contrasena) { return pedir("POST", "/api/cuenta/registro", { nombre: nombre, contrasena: contrasena }); },
    entrar: function (nombre, contrasena) { return pedir("POST", "/api/cuenta/login", { nombre: nombre, contrasena: contrasena }); },
    salir: function () { return pedir("POST", "/api/cuenta/logout", {}); },
    guardarDatos: function (datos) { return pedir("POST", "/api/cuenta/datos", { datos: datos }); },
    cambiarNombre: function (nombre) { return pedir("POST", "/api/cuenta/nombre", { nombre: nombre }); },
    cambiarContrasena: function (actual, nueva) { return pedir("POST", "/api/cuenta/contrasena", { actual: actual, nueva: nueva }); },
    eliminar: function (contrasena) { return pedir("POST", "/api/cuenta/eliminar", { contrasena: contrasena }); },
    listarCvs: function () { return pedir("GET", "/api/cvs").then(function (r) { return r.cvs; }); },
    guardarCv: function (cv) { return pedir("POST", "/api/cvs", cv); },
    eliminarCv: function (id) { return pedir("POST", ruta(id, "eliminar"), {}); },
    obtenerCv: async function (id) { return { tex: await Servidor.leerTex(id), datos: null }; },
    leerTex: async function (id) {
      const r = await fetch(ruta(id, "tex"), { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) throw error("No se pudo leer el CV.", r.status);
      return r.text();
    },
    urlPdf: function (id) { return ruta(id, "pdf"); }
  };

  // ---------------------------------------------------------------------------
  // Selección del almacén
  // ---------------------------------------------------------------------------
  function navegadorDisponible() {
    try {
      const prueba = "despega.prueba";
      localStorage.setItem(prueba, "1");
      localStorage.removeItem(prueba);
    } catch (e) { return "Este navegador no permite guardar datos (¿modo privado o cookies bloqueadas?)."; }
    if (!window.crypto || !crypto.subtle) return "Las cuentas necesitan abrir la página con https:// o como archivo local.";
    return null;
  }

  async function servidorConCuentas() {
    if (location.protocol !== "http:" && location.protocol !== "https:") return false;
    try {
      const r = await fetch("/api/estado", { cache: "no-store" });
      if (!r.ok) return false;
      const j = await r.json();
      return !!(j && j.cuentas);
    } catch (e) { return false; }
  }

  let almacen = Navegador;

  const Cuentas = {
    modo: null,         // "servidor" | "navegador" | null (sin cuentas)
    motivo: null,       // por qué no hay cuentas, si modo es null

    // Devuelve { disponible, modo, usuario, motivo }.
    sesion: async function () {
      if (await servidorConCuentas()) {
        almacen = Servidor;
      } else {
        const problema = navegadorDisponible();
        if (problema) {
          Cuentas.modo = null; Cuentas.motivo = problema;
          return { disponible: false, modo: null, usuario: null, motivo: problema };
        }
        almacen = Navegador;
      }
      Cuentas.modo = almacen.modo;
      try {
        return { disponible: true, modo: almacen.modo, usuario: await almacen.sesion() };
      } catch (e) {
        return { disponible: true, modo: almacen.modo, usuario: null };
      }
    }
  };

  ["registrar", "entrar", "salir", "guardarDatos", "cambiarNombre", "cambiarContrasena", "eliminar",
    "listarCvs", "guardarCv", "eliminarCv", "obtenerCv", "leerTex", "urlPdf"].forEach(function (nombre) {
    Cuentas[nombre] = function () { return almacen[nombre].apply(almacen, arguments); };
  });

  window.Cuentas = Cuentas;
})();
