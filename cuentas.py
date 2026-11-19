"""
Cuentas de Despega: usuarios, sesiones, datos guardados y CVs.

- Base de datos SQLite en datos/despega.db (cámbiala con DESPEGA_BD). No se sube a git.
- Contraseñas con PBKDF2-SHA256 y sal aleatoria; nunca se guardan en texto plano.
- La sesión es un token aleatorio en una cookie HttpOnly; en la base solo se guarda su hash.
- Cada CV guarda su .tex y, si hay pdflatex instalado, también el PDF compilado.
"""

import hashlib
import hmac
import json
import os
import re
import secrets
import shutil
import sqlite3
import subprocess
import tempfile
import time
import unicodedata
from contextlib import closing
from pathlib import Path

RUTA_BD = Path(os.environ.get("DESPEGA_BD") or Path(__file__).resolve().parent / "datos" / "despega.db")
ITERACIONES = 310_000
DURACION_SESION = 30 * 24 * 3600  # 30 días
MAX_DATOS = 100_000  # bytes de JSON por cuenta
MAX_TEX = 120_000
MAX_CVS = 50  # por cuenta; al pasar el límite se borran los más antiguos
PDFLATEX = shutil.which("pdflatex")


class ErrorCuenta(Exception):
    def __init__(self, mensaje: str, codigo: int = 400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.codigo = codigo


def _conectar() -> sqlite3.Connection:
    RUTA_BD.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(RUTA_BD, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def iniciar() -> None:
    with closing(_conectar()) as con, con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS usuarios (
                id      INTEGER PRIMARY KEY,
                nombre  TEXT NOT NULL,
                clave   TEXT NOT NULL UNIQUE,   -- nombre normalizado para iniciar sesión
                sal     BLOB NOT NULL,
                hash    BLOB NOT NULL,
                datos   TEXT NOT NULL DEFAULT '{}',
                creado  REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sesiones (
                token_hash TEXT PRIMARY KEY,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                expira     REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS cvs (
                id         INTEGER PRIMARY KEY,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                creado     REAL NOT NULL,
                puesto     TEXT NOT NULL DEFAULT '',
                empresa    TEXT NOT NULL DEFAULT '',
                tex        TEXT NOT NULL,
                pdf        BLOB,
                datos      TEXT NOT NULL DEFAULT '{}'
            );
            """
        )
        con.execute("DELETE FROM sesiones WHERE expira < ?", (time.time(),))


# ---------------------------------------------------------------------------
# Validación y utilidades
# ---------------------------------------------------------------------------

def _limpiar_nombre(nombre) -> str:
    nombre = re.sub(r"\s+", " ", str(nombre or "")).strip()
    if len(nombre) < 5 or len(nombre) > 80 or len(nombre.split(" ")) < 2:
        raise ErrorCuenta("Escribe tu nombre completo (nombre y apellido).")
    if not re.fullmatch(r"[^\W\d_]+(?:[ '\-.]+[^\W\d_]+)*\.?", nombre):
        raise ErrorCuenta("El nombre solo puede tener letras, espacios, guiones y apóstrofos.")
    return nombre


def _clave(nombre: str) -> str:
    """'José  Pérez' y 'jose perez' son la misma cuenta."""
    sin_acentos = unicodedata.normalize("NFKD", nombre.casefold())
    return "".join(c for c in sin_acentos if not unicodedata.combining(c))


def _validar_contrasena(contrasena) -> str:
    contrasena = str(contrasena or "")
    if len(contrasena) < 8:
        raise ErrorCuenta("La contraseña debe tener al menos 8 caracteres.")
    if len(contrasena) > 128:
        raise ErrorCuenta("La contraseña es demasiado larga (máximo 128 caracteres).")
    return contrasena


def _hash(contrasena: str, sal: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", contrasena.encode("utf-8"), sal, ITERACIONES)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def _nueva_sesion(con: sqlite3.Connection, usuario_id: int) -> str:
    token = secrets.token_urlsafe(32)
    con.execute(
        "INSERT INTO sesiones (token_hash, usuario_id, expira) VALUES (?, ?, ?)",
        (_hash_token(token), usuario_id, time.time() + DURACION_SESION),
    )
    return token


def _publico(fila: sqlite3.Row) -> dict:
    return {"nombre": fila["nombre"], "datos": json.loads(fila["datos"] or "{}")}


# Hash de relleno para que "usuario inexistente" tarde lo mismo que "contraseña incorrecta".
_SAL_RELLENO = secrets.token_bytes(16)
_HASH_RELLENO = _hash("relleno-despega", _SAL_RELLENO)


# ---------------------------------------------------------------------------
# Cuentas y sesiones
# ---------------------------------------------------------------------------

def registrar(nombre, contrasena) -> tuple[dict, str]:
    nombre = _limpiar_nombre(nombre)
    contrasena = _validar_contrasena(contrasena)
    sal = secrets.token_bytes(16)
    hash_ = _hash(contrasena, sal)
    with closing(_conectar()) as con, con:
        try:
            cur = con.execute(
                "INSERT INTO usuarios (nombre, clave, sal, hash, creado) VALUES (?, ?, ?, ?, ?)",
                (nombre, _clave(nombre), sal, hash_, time.time()),
            )
        except sqlite3.IntegrityError:
            raise ErrorCuenta("Ya existe una cuenta con ese nombre. Inicia sesión o usa tu segundo apellido.", 409)
        token = _nueva_sesion(con, cur.lastrowid)
        fila = con.execute("SELECT * FROM usuarios WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _publico(fila), token


def iniciar_sesion(nombre, contrasena) -> tuple[dict, str]:
    nombre = re.sub(r"\s+", " ", str(nombre or "")).strip()
    contrasena = str(contrasena or "")
    with closing(_conectar()) as con, con:
        fila = con.execute("SELECT * FROM usuarios WHERE clave = ?", (_clave(nombre),)).fetchone()
        if fila is None:
            hmac.compare_digest(_hash(contrasena, _SAL_RELLENO), _HASH_RELLENO)
            raise ErrorCuenta("Nombre o contraseña incorrectos.", 401)
        if not hmac.compare_digest(_hash(contrasena, fila["sal"]), fila["hash"]):
            raise ErrorCuenta("Nombre o contraseña incorrectos.", 401)
        token = _nueva_sesion(con, fila["id"])
    return _publico(fila), token


def usuario_de_token(token) -> sqlite3.Row | None:
    if not token:
        return None
    with closing(_conectar()) as con:
        return con.execute(
            "SELECT u.* FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id "
            "WHERE s.token_hash = ? AND s.expira > ?",
            (_hash_token(token), time.time()),
        ).fetchone()


def cerrar_sesion(token) -> None:
    if not token:
        return
    with closing(_conectar()) as con, con:
        con.execute("DELETE FROM sesiones WHERE token_hash = ?", (_hash_token(token),))


def publico(usuario: sqlite3.Row) -> dict:
    return _publico(usuario)


def _comprobar_contrasena(usuario: sqlite3.Row, contrasena) -> None:
    if not hmac.compare_digest(_hash(str(contrasena or ""), usuario["sal"]), usuario["hash"]):
        raise ErrorCuenta("La contraseña actual no es correcta.", 403)


def guardar_datos(usuario: sqlite3.Row, datos) -> dict:
    if not isinstance(datos, dict):
        raise ErrorCuenta("Datos inválidos.")
    texto = json.dumps(datos, ensure_ascii=False)
    if len(texto.encode("utf-8")) > MAX_DATOS:
        raise ErrorCuenta("Tus datos son demasiado grandes para guardarse.")
    with closing(_conectar()) as con, con:
        con.execute("UPDATE usuarios SET datos = ? WHERE id = ?", (texto, usuario["id"]))
    return datos


def cambiar_nombre(usuario: sqlite3.Row, nombre) -> str:
    nombre = _limpiar_nombre(nombre)
    with closing(_conectar()) as con, con:
        try:
            con.execute("UPDATE usuarios SET nombre = ?, clave = ? WHERE id = ?", (nombre, _clave(nombre), usuario["id"]))
        except sqlite3.IntegrityError:
            raise ErrorCuenta("Ya existe otra cuenta con ese nombre.", 409)
    return nombre


def cambiar_contrasena(usuario: sqlite3.Row, actual, nueva, token_actual: str) -> None:
    _comprobar_contrasena(usuario, actual)
    nueva = _validar_contrasena(nueva)
    sal = secrets.token_bytes(16)
    with closing(_conectar()) as con, con:
        con.execute("UPDATE usuarios SET sal = ?, hash = ? WHERE id = ?", (sal, _hash(nueva, sal), usuario["id"]))
        # Cierra las demás sesiones abiertas con la contraseña anterior.
        con.execute(
            "DELETE FROM sesiones WHERE usuario_id = ? AND token_hash != ?",
            (usuario["id"], _hash_token(token_actual)),
        )


def eliminar_cuenta(usuario: sqlite3.Row, contrasena) -> None:
    _comprobar_contrasena(usuario, contrasena)
    with closing(_conectar()) as con, con:
        con.execute("DELETE FROM usuarios WHERE id = ?", (usuario["id"],))


# ---------------------------------------------------------------------------
# CVs
# ---------------------------------------------------------------------------

def compilar_pdf(tex: str) -> bytes | None:
    """Compila el .tex con pdflatex (sin shell-escape). Devuelve None si no hay pdflatex o falla."""
    if not PDFLATEX:
        return None
    with tempfile.TemporaryDirectory(prefix="despega-cv-") as carpeta:
        Path(carpeta, "cv.tex").write_text(tex, encoding="utf-8")
        try:
            subprocess.run(
                [PDFLATEX, "-interaction=nonstopmode", "-halt-on-error", "-no-shell-escape", "cv.tex"],
                cwd=carpeta, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                timeout=60, check=False,
            )
        except (OSError, subprocess.TimeoutExpired):
            return None
        pdf = Path(carpeta, "cv.pdf")
        return pdf.read_bytes() if pdf.exists() else None


def _fila_cv(fila: sqlite3.Row) -> dict:
    return {
        "id": fila["id"],
        "creado": fila["creado"],
        "puesto": fila["puesto"],
        "empresa": fila["empresa"],
        "tiene_pdf": bool(fila["tiene_pdf"]),
    }


def listar_cvs(usuario: sqlite3.Row) -> list[dict]:
    with closing(_conectar()) as con:
        filas = con.execute(
            "SELECT id, creado, puesto, empresa, pdf IS NOT NULL AS tiene_pdf FROM cvs "
            "WHERE usuario_id = ? ORDER BY creado DESC",
            (usuario["id"],),
        ).fetchall()
    return [_fila_cv(f) for f in filas]


def guardar_cv(usuario: sqlite3.Row, puesto, empresa, tex, datos) -> dict:
    tex = str(tex or "")
    if not tex.startswith("\\documentclass") or len(tex) > MAX_TEX:
        raise ErrorCuenta("El CV no es válido.")
    datos_json = json.dumps(datos if isinstance(datos, dict) else {}, ensure_ascii=False)
    if len(datos_json.encode("utf-8")) > MAX_DATOS:
        raise ErrorCuenta("El CV es demasiado grande.")
    pdf = compilar_pdf(tex)  # fuera de la transacción: puede tardar unos segundos
    with closing(_conectar()) as con, con:
        cur = con.execute(
            "INSERT INTO cvs (usuario_id, creado, puesto, empresa, tex, pdf, datos) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (usuario["id"], time.time(), str(puesto or "")[:120], str(empresa or "")[:120], tex, pdf, datos_json),
        )
        # Conserva solo los MAX_CVS más recientes.
        con.execute(
            "DELETE FROM cvs WHERE usuario_id = ? AND id NOT IN "
            "(SELECT id FROM cvs WHERE usuario_id = ? ORDER BY creado DESC LIMIT ?)",
            (usuario["id"], usuario["id"], MAX_CVS),
        )
        fila = con.execute(
            "SELECT id, creado, puesto, empresa, pdf IS NOT NULL AS tiene_pdf FROM cvs WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
    return _fila_cv(fila)


def obtener_cv(usuario: sqlite3.Row, cv_id: int) -> sqlite3.Row:
    with closing(_conectar()) as con:
        fila = con.execute("SELECT * FROM cvs WHERE id = ? AND usuario_id = ?", (cv_id, usuario["id"])).fetchone()
    if fila is None:
        raise ErrorCuenta("No se encontró ese CV.", 404)
    return fila


def eliminar_cv(usuario: sqlite3.Row, cv_id: int) -> None:
    with closing(_conectar()) as con, con:
        cur = con.execute("DELETE FROM cvs WHERE id = ? AND usuario_id = ?", (cv_id, usuario["id"]))
    if cur.rowcount == 0:
        raise ErrorCuenta("No se encontró ese CV.", 404)
