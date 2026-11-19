// Despega · cliente de cuentas (habla con servidor.py).
// La sesión viaja en una cookie HttpOnly; este archivo nunca ve ni guarda la contraseña después de enviarla.
(function () {
  "use strict";

  async function pedir(metodo, ruta, cuerpo) {
    const opciones = { method: metodo, credentials: "same-origin", cache: "no-store", headers: {} };
    if (cuerpo !== undefined) {
      opciones.headers["Content-Type"] = "application/json";
      opciones.body = JSON.stringify(cuerpo);
    }
    const r = await fetch(ruta, opciones);
    let j = null;
    try { j = await r.json(); } catch (e) { /* respuesta sin JSON */ }
    if (!r.ok) {
      const error = new Error((j && j.error) || ("Error " + r.status));
      error.status = r.status;
      throw error;
    }
    return j;
  }

  // Devuelve { disponible, usuario }: disponible=false si no hay servidor (archivo abierto directo).
  async function sesion() {
    if (location.protocol === "file:") return { disponible: false, usuario: null };
    try {
      return { disponible: true, usuario: await pedir("GET", "/api/cuenta") };
    } catch (e) {
      if (e.status === 401) return { disponible: true, usuario: null };
      return { disponible: false, usuario: null };
    }
  }

  window.Cuentas = {
    sesion: sesion,
    registrar: function (nombre, contrasena) { return pedir("POST", "/api/cuenta/registro", { nombre: nombre, contrasena: contrasena }); },
    entrar: function (nombre, contrasena) { return pedir("POST", "/api/cuenta/login", { nombre: nombre, contrasena: contrasena }); },
    salir: function () { return pedir("POST", "/api/cuenta/logout", {}); },
    guardarDatos: function (datos) { return pedir("POST", "/api/cuenta/datos", { datos: datos }); },
    cambiarNombre: function (nombre) { return pedir("POST", "/api/cuenta/nombre", { nombre: nombre }); },
    cambiarContrasena: function (actual, nueva) { return pedir("POST", "/api/cuenta/contrasena", { actual: actual, nueva: nueva }); },
    eliminar: function (contrasena) { return pedir("POST", "/api/cuenta/eliminar", { contrasena: contrasena }); },
    listarCvs: function () { return pedir("GET", "/api/cvs").then(function (r) { return r.cvs; }); },
    guardarCv: function (cv) { return pedir("POST", "/api/cvs", cv); },
    eliminarCv: function (id) { return pedir("POST", "/api/cvs/" + encodeURIComponent(id) + "/eliminar", {}); },
    urlTex: function (id) { return "/api/cvs/" + encodeURIComponent(id) + "/tex"; },
    urlPdf: function (id) { return "/api/cvs/" + encodeURIComponent(id) + "/pdf"; },
    leerTex: async function (id) {
      const r = await fetch("/api/cvs/" + encodeURIComponent(id) + "/tex", { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) throw new Error("No se pudo leer el CV.");
      return r.text();
    }
  };
})();
