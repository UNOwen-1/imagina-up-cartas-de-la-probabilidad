#!/usr/bin/env python3
"""
Servidor local de Despega.

- Sirve la página web (index.html, css/, js/) en http://localhost:8000
- Expone POST /api/agente para que los 4 agentes usen Claude (IA real).
- Si no hay SDK de Anthropic o no hay API key, la página funciona igual en "modo demo".

Uso:
    python servidor.py                 # modo demo o IA real (si hay API key)
    $env:ANTHROPIC_API_KEY="sk-..."    # (PowerShell) activa la IA real
    $env:DESPEGA_MODO="demo"           # fuerza el modo demo aunque haya API key
    $env:DESPEGA_MODELO="claude-..."   # cambia el modelo (por defecto claude-opus-5-5)
"""

import json
import os
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
PUERTO = int(os.environ.get("PORT", "8000"))
MODELO = os.environ.get("DESPEGA_MODELO", "claude-opus-5-5")
# Modelos que aceptan el respaldo automático del servidor si el modelo rechaza una solicitud.
MODELOS_CON_RESPALDO = {"claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1", "claude-fable-5-2"}
MAX_CUERPO = 300_000  # bytes

try:
    import anthropic
except ImportError:
    anthropic = None


def hay_credenciales() -> bool:
    if os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN") or os.environ.get("ANTHROPIC_PROFILE"):
        return True
    return (Path.home() / ".config" / "anthropic").exists()  # perfil creado con `ant auth login`


def motivo_sin_ia() -> str | None:
    if os.environ.get("DESPEGA_MODO", "").lower() == "demo":
        return "Modo demo forzado con DESPEGA_MODO=demo."
    if anthropic is None:
        return "Falta instalar el SDK: pip install -r requirements.txt"
    if not hay_credenciales():
        return "No hay API key: define ANTHROPIC_API_KEY para usar la IA real."
    return None


MOTIVO_SIN_IA = motivo_sin_ia()
IA_ACTIVA = MOTIVO_SIN_IA is None
cliente = anthropic.Anthropic(timeout=80.0, max_retries=1) if IA_ACTIVA else None


# ---------------------------------------------------------------------------
# Definición de los agentes: instrucciones + esquema JSON de salida
# ---------------------------------------------------------------------------

REGLAS_COMUNES = (
    "Hablas en español latinoamericano, de tú, con un tono cálido, claro y motivador para jóvenes de 18 a 25 años. "
    "Usa lenguaje inclusivo neutro (evita asumir el género de la persona). "
    "Nunca inventes experiencias, estudios ni habilidades que la persona no mencionó. "
    "Responde solo con el JSON pedido."
)

AGENTES = {
    "perfilador": {
        "sistema": (
            "Eres el Agente Perfilador de Despega, un orientador laboral para jóvenes sin experiencia formal. "
            "Tu trabajo: leer la historia de la persona y traducir lo que hace en su vida diaria (negocio familiar, escuela, "
            "redes sociales, voluntariado, hobbies, cuidados) a habilidades profesionales que valoran las empresas. "
            "Para cada habilidad, 'evidencia' debe ser una frase corta copiada o casi literal de la historia que la demuestre. "
            "Clasifica cada habilidad como 'técnica' o 'blanda'. Encuentra entre 4 y 10 habilidades. "
            "Cuando una habilidad coincida con alguna de esta lista, usa exactamente ese nombre: {catalogo}. "
            "El resumen_profesional es de 2 o 3 frases en primera persona del CV, sin exagerar. " + REGLAS_COMUNES
        ),
        "esquema": {
            "type": "object",
            "properties": {
                "nombre": {"type": "string"},
                "resumen_profesional": {"type": "string"},
                "habilidades": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "nombre": {"type": "string"},
                            "categoria": {"type": "string", "enum": ["técnica", "blanda"]},
                            "evidencia": {"type": "string"},
                        },
                        "required": ["nombre", "categoria", "evidencia"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["nombre", "resumen_profesional", "habilidades"],
            "additionalProperties": False,
        },
    },
    "buscador": {
        "sistema": (
            "Eres el Agente Buscador de Despega. Recibes el perfil aprobado de una persona joven y una lista de vacantes "
            "sin experiencia requerida. Elige las 3 vacantes más compatibles. Para cada una: 'id' exacto de la vacante, "
            "'compatibilidad' (entero de 0 a 100, realista), 'por_que' (1–2 frases que citen habilidades y evidencias "
            "concretas del perfil), 'te_falta' (la habilidad más importante que pide la vacante y la persona no tiene; "
            "si no falta nada, dilo) y 'consejo' (una acción gratuita y concreta para desarrollarla en menos de 2 semanas). "
            + REGLAS_COMUNES
        ),
        "esquema": {
            "type": "object",
            "properties": {
                "recomendaciones": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "compatibilidad": {"type": "integer"},
                            "por_que": {"type": "string"},
                            "te_falta": {"type": "string"},
                            "consejo": {"type": "string"},
                        },
                        "required": ["id", "compatibilidad", "por_que", "te_falta", "consejo"],
                        "additionalProperties": False,
                    },
                }
            },
            "required": ["recomendaciones"],
            "additionalProperties": False,
        },
    },
    "adaptador": {
        "sistema": (
            "Eres el Agente Adaptador de CV de Despega. Recibes el perfil de una persona joven y la vacante que eligió. "
            "Reescribe su CV para esa vacante: 'resumen_adaptado' (3 frases en primera persona que mencionen el puesto y "
            "la empresa), 'habilidades_destacadas' (máximo 6 nombres, primero las que pide la vacante), 'logros' (3 a 4 "
            "viñetas que conviertan sus experiencias informales en logros profesionales, usando solo hechos de su perfil) "
            "y 'cambios' (3 a 4 frases que expliquen qué cambiaste y por qué; si la vacante pide algo que la persona no "
            "tiene, explica que no lo agregaste para no inventar). " + REGLAS_COMUNES
        ),
        "esquema": {
            "type": "object",
            "properties": {
                "resumen_adaptado": {"type": "string"},
                "habilidades_destacadas": {"type": "array", "items": {"type": "string"}},
                "logros": {"type": "array", "items": {"type": "string"}},
                "cambios": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["resumen_adaptado", "habilidades_destacadas", "logros", "cambios"],
            "additionalProperties": False,
        },
    },
    "entrenador_preguntas": {
        "sistema": (
            "Eres el Agente Entrenador de entrevistas de Despega. Genera exactamente 3 preguntas de entrevista realistas "
            "para la vacante, adaptadas al perfil de la persona (una de motivación, una de experiencia usando una de sus "
            "habilidades reales y una situacional sobre su primer empleo). Para cada una, 'que_busca' explica en una frase "
            "qué quiere descubrir el reclutador. " + REGLAS_COMUNES
        ),
        "esquema": {
            "type": "object",
            "properties": {
                "preguntas": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {"pregunta": {"type": "string"}, "que_busca": {"type": "string"}},
                        "required": ["pregunta", "que_busca"],
                        "additionalProperties": False,
                    },
                }
            },
            "required": ["preguntas"],
            "additionalProperties": False,
        },
    },
    "entrenador_evaluar": {
        "sistema": (
            "Eres el Agente Entrenador de entrevistas de Despega. Evalúa la respuesta de una persona joven a una pregunta "
            "de entrevista para la vacante indicada. Da 'puntaje' (entero de 1 a 5, honesto pero alentador), 'lo_bueno' "
            "(1–2 frases concretas sobre lo que hizo bien), 'mejorar' (1–2 consejos accionables, por ejemplo el método "
            "situación–acción–resultado) y 'respuesta_ejemplo' (una respuesta modelo de 60–90 palabras basada solo en "
            "hechos reales de su perfil). " + REGLAS_COMUNES
        ),
        "esquema": {
            "type": "object",
            "properties": {
                "puntaje": {"type": "integer"},
                "lo_bueno": {"type": "string"},
                "mejorar": {"type": "string"},
                "respuesta_ejemplo": {"type": "string"},
            },
            "required": ["puntaje", "lo_bueno", "mejorar", "respuesta_ejemplo"],
            "additionalProperties": False,
        },
    },
}

CATALOGO = (
    "Atención al cliente, Ventas, Marketing digital, Creación de contenido, Fotografía y video, Excel, "
    "Control de inventario, Manejo de efectivo, Organización de eventos, Organización, Trabajo en equipo, Liderazgo, "
    "Comunicación, Enseñanza, Programación, Diseño gráfico, Inglés, Logística y reparto, Puntualidad, "
    "Preparación de alimentos, Soporte técnico, Redacción, Presentaciones, Gestión de pedidos, Responsabilidad, "
    "Cuidado de personas, Compromiso social, Análisis de datos, Resolución de problemas, Aprendizaje rápido, Creatividad"
)


class ErrorAgente(Exception):
    pass


def ejecutar_agente(nombre: str, datos: dict) -> dict:
    agente = AGENTES[nombre]
    sistema = agente["sistema"].replace("{catalogo}", CATALOGO)
    mensaje = "Datos de entrada (JSON):\n" + json.dumps(datos, ensure_ascii=False, indent=1)

    parametros = dict(
        model=MODELO,
        max_tokens=8000,
        system=sistema,
        messages=[{"role": "user", "content": mensaje}],
        output_config={
            "effort": "low",  # respuestas rápidas para la demo
            "format": {"type": "json_schema", "schema": agente["esquema"]},
        },
    )

    try:
        if MODELO in MODELOS_CON_RESPALDO:
            respuesta = cliente.beta.messages.create(
                betas=["server-side-fallback-2026-07-01"], fallbacks="default", **parametros
            )
        else:
            respuesta = cliente.messages.create(**parametros)
    except anthropic.AuthenticationError:
        raise ErrorAgente("API key inválida")
    except anthropic.PermissionDeniedError:
        raise ErrorAgente("la API key no tiene permisos para este modelo")
    except anthropic.NotFoundError:
        raise ErrorAgente(f"modelo no encontrado: {MODELO}")
    except anthropic.RateLimitError:
        raise ErrorAgente("límite de uso alcanzado, intenta en un momento")
    except anthropic.BadRequestError as e:
        raise ErrorAgente(f"solicitud inválida: {e.message}")
    except anthropic.APIStatusError as e:
        raise ErrorAgente(f"error del servicio ({e.status_code})")
    except anthropic.APIConnectionError:
        raise ErrorAgente("sin conexión a internet")

    if respuesta.stop_reason == "refusal":
        raise ErrorAgente("el modelo no pudo responder a esta solicitud")
    if respuesta.stop_reason == "max_tokens":
        raise ErrorAgente("la respuesta quedó incompleta")

    texto = next((b.text for b in respuesta.content if b.type == "text"), None)
    if not texto:
        raise ErrorAgente("respuesta vacía")
    return json.loads(texto)


# ---------------------------------------------------------------------------
# Servidor HTTP
# ---------------------------------------------------------------------------

class Manejador(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(RAIZ), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, formato, *args):
        if "/api/" in (self.path or ""):
            sys.stderr.write("  [api] " + (formato % args) + "\n")

    def responder_json(self, codigo: int, cuerpo: dict):
        datos = json.dumps(cuerpo, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(datos)))
        self.end_headers()
        self.wfile.write(datos)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/estado":
            self.responder_json(200, {"ia": IA_ACTIVA, "modelo": MODELO if IA_ACTIVA else None, "motivo": MOTIVO_SIN_IA})
            return
        super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] != "/api/agente":
            self.responder_json(404, {"error": "ruta no encontrada"})
            return
        if not IA_ACTIVA:
            self.responder_json(503, {"error": MOTIVO_SIN_IA})
            return
        try:
            largo = int(self.headers.get("Content-Length", "0"))
            if largo <= 0 or largo > MAX_CUERPO:
                raise ValueError("tamaño de solicitud inválido")
            cuerpo = json.loads(self.rfile.read(largo).decode("utf-8"))
            nombre = cuerpo.get("agente")
            if nombre not in AGENTES:
                raise ValueError("agente desconocido")
            datos = cuerpo.get("datos") or {}
        except (ValueError, json.JSONDecodeError) as e:
            self.responder_json(400, {"error": str(e)})
            return

        try:
            resultado = ejecutar_agente(nombre, datos)
            self.responder_json(200, resultado)
        except ErrorAgente as e:
            sys.stderr.write(f"  [agente {nombre}] {e}\n")
            self.responder_json(502, {"error": str(e)})
        except json.JSONDecodeError:
            self.responder_json(502, {"error": "la IA devolvió un JSON inválido"})


def main():
    # Evita errores con emojis en consolas de Windows.
    for flujo in (sys.stdout, sys.stderr):
        try:
            flujo.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    servidor =ThreadingHTTPServer(("127.0.0.1", PUERTO), Manejador)
    url = f"http://localhost:{PUERTO}"
    print("\n  🚀 Despega está corriendo en " + url)
    if IA_ACTIVA:
        print(f"  🤖 IA real activada · modelo {MODELO}")
    else:
        print(f"  ⚡ Modo demo · {MOTIVO_SIN_IA}")
    print("  Presiona Ctrl+C para detener.\n")
    if os.environ.get("DESPEGA_NO_ABRIR") != "1":
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\n  Servidor detenido. ¡Éxito en el hackatón!")
    finally:
        servidor.server_close()


if __name__ == "__main__":
    main()
