// Despega · CV con la plantilla LaTeX (estilo "resume" de una página).
// datosCV() arma el contenido una sola vez; generarLatex() y generarHtml() lo presentan
// con el mismo diseño: en .tex (para Overleaf / pdflatex) y en HTML (para imprimir como PDF).
(function () {
  "use strict";

  const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // ---------- Contenido del CV ----------
  // Versión con el estilo corregido por el Adaptador, si corresponde 1 a 1 con lo que escribió la persona.
  function pulidos(corregidos, originales) {
    originales = originales || [];
    return Array.isArray(corregidos) && corregidos.length === originales.length ? corregidos : originales;
  }

  function datosCV(perfil, vacante, cv, contacto) {
    contacto = contacto || {};
    const estudios = perfil.estudios || {};

    const lineaContacto = [];
    if (contacto.telefono) lineaContacto.push({ texto: contacto.telefono });
    if (contacto.correo) lineaContacto.push({ texto: contacto.correo, url: "mailto:" + contacto.correo });
    if (contacto.enlace) {
      const url = /^https?:\/\//i.test(contacto.enlace) ? contacto.enlace : "https://" + contacto.enlace;
      lineaContacto.push({ texto: contacto.enlace.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, ""), url: url });
    }
    if (contacto.ciudad) lineaContacto.push({ texto: contacto.ciudad });

    const educacion = [];
    if (estudios.escuela || estudios.nivel) {
      educacion.push({
        institucion: estudios.escuela || estudios.nivel,
        ubicacion: contacto.ciudad || "",
        titulo: estudios.escuela ? (estudios.nivel || "") : "",
        periodo: estudios.periodo || ""
      });
    }

    // Habilidades: primero las destacadas para la vacante, luego el resto del perfil; separadas en técnicas y blandas.
    const categoriaDe = {};
    perfil.habilidades.forEach(function (h) { categoriaDe[normalizar(h.nombre)] = h.categoria; });
    const catalogo = (window.MotorLocal && window.MotorLocal.CATALOGO) || [];
    catalogo.forEach(function (c) {
      const n = normalizar(c.nombre);
      if (!categoriaDe[n]) categoriaDe[n] = c.categoria;
    });
    const vistas = {};
    const tecnicas = [], blandas = [];
    cv.habilidades_destacadas.concat(perfil.habilidades.map(function (h) { return h.nombre; })).forEach(function (nombre) {
      const n = normalizar(nombre);
      if (!n || vistas[n]) return;
      vistas[n] = true;
      (categoriaDe[n] === "blanda" ? blandas : tecnicas).push(nombre);
    });

    return {
      nombre: perfil.nombre,
      contacto: lineaContacto,
      perfil: cv.resumen_adaptado,
      educacion: educacion,
      experiencia: {
        titulo: "Experiencia práctica",
        lugar: contacto.ciudad || "",
        detalle: "Enfoque: " + vacante.puesto + " en " + vacante.empresa,
        logros: cv.logros
      },
      // Del paso 3 (opcional): si se omitió, quedan vacías y sus secciones no aparecen.
      proyectos: pulidos(cv.proyectos, perfil.proyectos),
      logros: pulidos(cv.reconocimientos, perfil.reconocimientos),
      tecnicas: tecnicas,
      blandas: blandas,
      disponibilidad: vacante.jornada + ", " + vacante.modalidad.toLowerCase() + ". Inicio inmediato."
    };
  }

  // ---------- LaTeX ----------
  // Escapa texto del usuario para que compile con pdflatex + babel (spanish).
  function esc(texto) {
    return String(texto == null ? "" : texto)
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{2B50}\u{2B06}\u{2194}-\u{21FF}]/gu, "")
      .replace(/"([^"]*)"/g, "“$1”") // comillas rectas en pares → tipográficas
      .replace(/[\\{}&%$#_~^<>"·–—…]/g, function (c) {
        return {
          "\\": "\\textbackslash{}", "{": "\\{", "}": "\\}", "&": "\\&", "%": "\\%", "$": "\\$",
          "#": "\\#", "_": "\\_", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}",
          "<": "$<$", ">": "$>$", "\"": "''", "·": "$\\cdot$", "–": "--", "—": "---", "…": "\\ldots{}"
        }[c];
      })
      .replace(/\s+/g, " ")
      .trim();
  }

  function escUrl(url) {
    // \href lee la URL casi literal: solo % y # necesitan escape.
    return String(url).replace(/[\\{}\s]/g, "").replace(/[%#]/g, function (c) { return "\\" + c; });
  }

  const PREAMBULO = String.raw`\documentclass[letterpaper,11pt]{article}

\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{marvosym}
\usepackage[usenames,dvipsnames]{color}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[spanish]{babel}
\usepackage{tabularx}
\input{glyphtounicode}

\pagestyle{fancy}
\fancyhf{}
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

\addtolength{\oddsidemargin}{-0.5in}
\addtolength{\evensidemargin}{-0.5in}
\addtolength{\textwidth}{1in}
\addtolength{\topmargin}{-.5in}
\addtolength{\textheight}{1.0in}

\urlstyle{same}

\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

\titleformat{\section}{
  \vspace{-4pt}\scshape\raggedright\large
}{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]

\pdfgentounicode=1

\newcommand{\resumeItem}[1]{
  \item\small{
    {#1 \vspace{-2pt}}
  }
}

\newcommand{\resumeSubheading}[4]{
  \vspace{-2pt}\item
    \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & #2 \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubSubheading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \textit{\small#1} & \textit{\small #2} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeProjectHeading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \small#1 & #2 \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubItem}[1]{\resumeItem{#1}\vspace{-4pt}}

\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}

\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.15in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}
`;

  function generarLatex(d) {
    const L = [PREAMBULO, "\\begin{document}", ""];

    // Encabezado
    L.push("\\begin{center}");
    L.push("    \\textbf{\\Huge \\scshape " + esc(d.nombre) + "} \\\\ \\vspace{1pt}");
    if (d.contacto.length) {
      L.push("    \\small");
      L.push(d.contacto.map(function (c) {
        return c.url ? "    \\href{" + escUrl(c.url) + "}{\\underline{" + esc(c.texto) + "}}" : "    " + esc(c.texto);
      }).join("\n    \\quad $|$ \\quad\n"));
    }
    L.push("\\end{center}", "");

    // Perfil
    if (d.perfil) {
      L.push("\\section{Perfil}");
      L.push(" \\begin{itemize}[leftmargin=0.15in, label={}]");
      L.push("    \\small{\\item{" + esc(d.perfil) + "}}");
      L.push(" \\end{itemize}", "");
    }

    // Educación
    if (d.educacion.length) {
      L.push("\\section{Educación}");
      L.push("  \\resumeSubHeadingListStart");
      d.educacion.forEach(function (e) {
        L.push("    \\resumeSubheading");
        L.push("      {" + esc(e.institucion) + "}{" + esc(e.ubicacion) + "}");
        L.push("      {" + esc(e.titulo) + "}{" + esc(e.periodo) + "}");
      });
      L.push("  \\resumeSubHeadingListEnd", "");
    }

    // Experiencia
    if (d.experiencia.logros.length) {
      L.push("\\section{Experiencia}");
      L.push("  \\resumeSubHeadingListStart");
      L.push("    \\resumeSubheading");
      L.push("      {" + esc(d.experiencia.titulo) + "}{" + esc(d.experiencia.lugar) + "}");
      L.push("      {" + esc(d.experiencia.detalle) + "}{}");
      L.push("      \\resumeItemListStart");
      d.experiencia.logros.forEach(function (l) { L.push("        \\resumeItem{" + esc(l) + "}"); });
      L.push("      \\resumeItemListEnd");
      L.push("  \\resumeSubHeadingListEnd", "");
    }

    // Proyectos (equivalente a "Projects" de la plantilla)
    if (d.proyectos.length) {
      L.push("\\section{Proyectos}");
      L.push("    \\resumeSubHeadingListStart");
      d.proyectos.forEach(function (p) {
        L.push("      \\resumeProjectHeading");
        L.push("          {\\textbf{" + esc(p.nombre) + "}" + (p.herramientas ? " $|$ \\emph{" + esc(p.herramientas) + "}" : "") + "}{" + esc(p.fecha) + "}");
        if (p.descripcion.length) {
          L.push("          \\resumeItemListStart");
          p.descripcion.forEach(function (linea) { L.push("            \\resumeItem{" + esc(linea) + "}"); });
          L.push("          \\resumeItemListEnd");
        }
      });
      L.push("    \\resumeSubHeadingListEnd", "");
    }

    // Logros (equivalente a "Achievements" de la plantilla)
    if (d.logros.length) {
      L.push("\\section{Logros}");
      L.push("    \\resumeSubHeadingListStart");
      d.logros.forEach(function (l) {
        L.push("      \\resumeProjectHeading");
        L.push("          {\\textbf{" + esc(l.titulo) + "}" + (l.detalle ? " $|$ \\emph{" + esc(l.detalle) + "}" : "") + "}{" + esc(l.fecha) + "}");
      });
      L.push("    \\resumeSubHeadingListEnd", "");
    }

    // Habilidades (equivalente a "Technical Skills" de la plantilla)
    const lineas = [];
    if (d.tecnicas.length) lineas.push("     \\textbf{Técnicas}{: " + esc(d.tecnicas.join(", ")) + ".}");
    if (d.blandas.length) lineas.push("     \\textbf{Blandas}{: " + esc(d.blandas.join(", ")) + ".}");
    lineas.push("     \\textbf{Disponibilidad}{: " + esc(d.disponibilidad) + "}");
    L.push("\\section{Habilidades}");
    L.push(" \\begin{itemize}[leftmargin=0.15in, label={}]");
    L.push("    \\small{\\item{");
    L.push(lineas.join(" \\\\\n"));
    L.push("    }}");
    L.push(" \\end{itemize}", "");

    L.push("\\end{document}", "");
    return L.join("\n");
  }

  // ---------- HTML con el mismo diseño (para imprimir / guardar como PDF) ----------
  function generarHtml(d, el) {
    const seccion = function (titulo) { return el("h2", { class: "lx-seccion", text: titulo }); };
    const fila = function (izq, der, clase) {
      return el("div", { class: "lx-fila " + (clase || "") }, el("span", null, izq), el("span", null, der || ""));
    };

    const partes = [
      el("h1", { class: "lx-nombre", text: d.nombre }),
      d.contacto.length
        ? el("p", { class: "lx-contacto" }, d.contacto.reduce(function (nodos, c, i) {
            if (i) nodos.push(el("span", { class: "lx-sep", text: "|" }));
            nodos.push(c.url ? el("a", { href: c.url, text: c.texto }) : el("span", { text: c.texto }));
            return nodos;
          }, []))
        : null
    ];

    if (d.perfil) partes.push(seccion("Perfil"), el("p", { class: "lx-texto", text: d.perfil }));

    if (d.educacion.length) {
      partes.push(seccion("Educación"));
      d.educacion.forEach(function (e) {
        partes.push(el("div", { class: "lx-bloque" },
          fila(el("strong", { text: e.institucion }), e.ubicacion),
          fila(el("em", { text: e.titulo }), el("em", { text: e.periodo }), "lx-sub")));
      });
    }

    if (d.experiencia.logros.length) {
      partes.push(seccion("Experiencia"), el("div", { class: "lx-bloque" },
        fila(el("strong", { text: d.experiencia.titulo }), d.experiencia.lugar),
        fila(el("em", { text: d.experiencia.detalle }), "", "lx-sub"),
        el("ul", null, d.experiencia.logros.map(function (l) { return el("li", { text: l }); }))));
    }

    const encabezado = function (titulo, detalle) {
      return detalle ? [el("strong", { text: titulo }), " | ", el("em", { text: detalle })] : el("strong", { text: titulo });
    };

    if (d.proyectos.length) {
      partes.push(seccion("Proyectos"));
      d.proyectos.forEach(function (p) {
        partes.push(el("div", { class: "lx-bloque" },
          fila(encabezado(p.nombre, p.herramientas), p.fecha, "lx-sub"),
          p.descripcion.length ? el("ul", null, p.descripcion.map(function (l) { return el("li", { text: l }); })) : null));
      });
    }

    if (d.logros.length) {
      partes.push(seccion("Logros"));
      d.logros.forEach(function (l) {
        partes.push(el("div", { class: "lx-bloque lx-compacto" }, fila(encabezado(l.titulo, l.detalle), l.fecha, "lx-sub")));
      });
    }

    partes.push(seccion("Habilidades"), el("div", { class: "lx-texto" },
      d.tecnicas.length ? el("p", null, el("strong", { text: "Técnicas" }), ": " + d.tecnicas.join(", ") + ".") : null,
      d.blandas.length ? el("p", null, el("strong", { text: "Blandas" }), ": " + d.blandas.join(", ") + ".") : null,
      el("p", null, el("strong", { text: "Disponibilidad" }), ": " + d.disponibilidad)));

    return partes;
  }

  window.CvLatex = { datosCV: datosCV, generarLatex: generarLatex, generarHtml: generarHtml };
})();
