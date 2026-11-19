// Despega · problemas tipo LeetCode de nivel junior (fácil) para practicar entrevistas técnicas.
//
// La práctica se basa en EXPLICAR LA LÓGICA (como en una entrevista real: estructura de datos, pasos,
// casos borde y complejidad), no en ejecutar código: así sirve para cualquier lenguaje que pidan las
// vacantes y funciona sin servidor ni internet. El código de referencia está en Python y JavaScript.
//
// "conceptos": grupos de palabras (sin acentos, en minúsculas) que el modo demo busca en la explicación.
// El primer grupo es la idea clave; los demás son pasos importantes.
window.PROBLEMAS = [
  {
    id: "suma-de-dos",
    titulo: "Suma de dos",
    tema: "Arreglos y hash maps",
    enunciado: "Dado un arreglo de enteros nums y un entero objetivo, devuelve los índices de los dos números que suman objetivo. Hay exactamente una solución y no puedes usar el mismo elemento dos veces.",
    ejemplos: [
      { entrada: "nums = [2, 7, 11, 15], objetivo = 9", salida: "[0, 1]", nota: "2 + 7 = 9" },
      { entrada: "nums = [3, 2, 4], objetivo = 6", salida: "[1, 2]", nota: "2 + 4 = 6" }
    ],
    pistas: [
      "La fuerza bruta prueba todos los pares: O(n²). ¿Puedes hacerlo en un solo recorrido?",
      "Para cada número x, el que te falta es objetivo − x. ¿Qué estructura te dice en O(1) si ya lo viste?"
    ],
    idea: [
      "Recorro el arreglo una sola vez guardando en un diccionario (hash map) cada valor con su índice.",
      "Para cada número x calculo lo que falta: objetivo − x.",
      "Si lo que falta ya está en el diccionario, encontré la pareja y devuelvo sus dos índices.",
      "Si no, guardo x con su índice y sigo. Revisar antes de guardar evita usar el mismo elemento dos veces."
    ],
    complejidad: "Tiempo O(n), espacio O(n). (La fuerza bruta con dos ciclos es O(n²) en tiempo.)",
    conceptos: [["hash", "diccionario", "mapa", "map", "dict", "tabla"], ["objetivo -", "objetivo menos", "complemento", "lo que falta", "me falta", "diferencia", "resta"], ["una pasada", "un solo recorrido", "una vez", "recorr"]],
    codigo: {
      python: `def suma_de_dos(nums, objetivo):
    vistos = {}                      # valor -> índice
    for i, x in enumerate(nums):
        falta = objetivo - x
        if falta in vistos:
            return [vistos[falta], i]
        vistos[x] = i
    return []`,
      javascript: `function sumaDeDos(nums, objetivo) {
  const vistos = new Map();          // valor -> índice
  for (let i = 0; i < nums.length; i++) {
    const falta = objetivo - nums[i];
    if (vistos.has(falta)) return [vistos.get(falta), i];
    vistos.set(nums[i], i);
  }
  return [];
}`
    }
  },
  {
    id: "parentesis-validos",
    titulo: "Paréntesis válidos",
    tema: "Pilas",
    enunciado: "Dada una cadena que solo contiene los caracteres ( ) [ ] { }, determina si es válida: cada apertura debe cerrarse con el mismo tipo y en el orden correcto.",
    ejemplos: [
      { entrada: "s = \"()[]{}\"", salida: "true" },
      { entrada: "s = \"([)]\"", salida: "false", nota: "se cierran en desorden" },
      { entrada: "s = \"{[]}\"", salida: "true" }
    ],
    pistas: [
      "El último que se abrió debe ser el primero que se cierre. ¿Qué estructura funciona así?",
      "Al terminar de recorrer la cadena, ¿qué debe pasar con lo que quedó abierto?"
    ],
    idea: [
      "Uso una pila (stack): el último paréntesis abierto es el primero que debe cerrarse (LIFO).",
      "Recorro la cadena: si es apertura, la meto a la pila.",
      "Si es cierre, la pila no debe estar vacía y su cima debe ser la apertura del mismo tipo; si coincide, la saco.",
      "Al final la cadena es válida solo si la pila quedó vacía."
    ],
    complejidad: "Tiempo O(n), espacio O(n).",
    conceptos: [["pila", "stack", "lifo"], ["cima", "tope", "ultimo", "pop", "saco", "sacar"], ["vacia", "al final", "quede vacia"]],
    codigo: {
      python: `def es_valida(s):
    pareja = {')': '(', ']': '[', '}': '{'}
    pila = []
    for c in s:
        if c in pareja:                      # es un cierre
            if not pila or pila[-1] != pareja[c]:
                return False
            pila.pop()
        else:                                # es una apertura
            pila.append(c)
    return not pila`,
      javascript: `function esValida(s) {
  const pareja = { ')': '(', ']': '[', '}': '{' };
  const pila = [];
  for (const c of s) {
    if (c in pareja) {                       // es un cierre
      if (pila.length === 0 || pila[pila.length - 1] !== pareja[c]) return false;
      pila.pop();
    } else {                                 // es una apertura
      pila.push(c);
    }
  }
  return pila.length === 0;
}`
    }
  },
  {
    id: "palindromo",
    titulo: "Palíndromo válido",
    tema: "Cadenas y dos punteros",
    enunciado: "Dada una frase, determina si es un palíndromo considerando solo letras y números, e ignorando mayúsculas y minúsculas.",
    ejemplos: [
      { entrada: "s = \"Anita lava la tina\"", salida: "true" },
      { entrada: "s = \"Hola, mundo\"", salida: "false" }
    ],
    pistas: [
      "Compara el primer carácter con el último, el segundo con el penúltimo…",
      "¿Qué haces con los espacios y signos de puntuación?"
    ],
    idea: [
      "Uso dos punteros: uno al inicio (izquierda) y otro al final (derecha).",
      "Si un puntero está en un carácter que no es letra ni número, lo salto.",
      "Comparo los dos caracteres en minúscula; si son distintos, no es palíndromo.",
      "Si coinciden, acerco los punteros y repito hasta que se crucen.",
      "Alternativa válida: limpiar la cadena y compararla con su reversa (usa O(n) de memoria extra)."
    ],
    complejidad: "Tiempo O(n), espacio O(1) con dos punteros.",
    conceptos: [["dos punteros", "dos indices", "izquierda y derecha", "extremos", "inicio y fin", "inicio y al final", "reversa", "invert", "al reves"], ["alfanum", "ignor", "salt", "limpi", "filtr", "minuscula"], ["compar"]],
    codigo: {
      python: `def es_palindromo(s):
    i, j = 0, len(s) - 1
    while i < j:
        if not s[i].isalnum():
            i += 1
        elif not s[j].isalnum():
            j -= 1
        elif s[i].lower() != s[j].lower():
            return False
        else:
            i += 1
            j -= 1
    return True`,
      javascript: `function esPalindromo(s) {
  const esAlfanum = (c) => /[a-z0-9]/i.test(c);
  let i = 0, j = s.length - 1;
  while (i < j) {
    if (!esAlfanum(s[i])) i++;
    else if (!esAlfanum(s[j])) j--;
    else if (s[i].toLowerCase() !== s[j].toLowerCase()) return false;
    else { i++; j--; }
  }
  return true;
}`
    }
  },
  {
    id: "anagrama",
    titulo: "Anagrama válido",
    tema: "Cadenas y conteo",
    enunciado: "Dadas dos cadenas s y t, determina si t es un anagrama de s: tiene exactamente las mismas letras con la misma frecuencia.",
    ejemplos: [
      { entrada: "s = \"roma\", t = \"amor\"", salida: "true" },
      { entrada: "s = \"casa\", t = \"saco\"", salida: "false" }
    ],
    pistas: [
      "Si las longitudes son distintas, ¿pueden ser anagramas?",
      "¿Cómo cuentas cuántas veces aparece cada letra?"
    ],
    idea: [
      "Si las cadenas tienen distinta longitud, no pueden ser anagramas.",
      "Cuento la frecuencia de cada letra de s con un diccionario (o un arreglo de 26 posiciones).",
      "Recorro t restando cada letra; si alguna llega a menos de cero (o no existe), no es anagrama.",
      "Alternativa válida: ordenar ambas cadenas y compararlas, en O(n log n)."
    ],
    complejidad: "Tiempo O(n), espacio O(1) si el alfabeto es fijo (26 letras).",
    conceptos: [["frecuencia", "cont", "diccionario", "hash", "mapa", "arreglo de 26", "orden", "sort"], ["longitud", "tamano", "mismo largo", "length"], ["rest"]],
    codigo: {
      python: `def es_anagrama(s, t):
    if len(s) != len(t):
        return False
    conteo = {}
    for c in s:
        conteo[c] = conteo.get(c, 0) + 1
    for c in t:
        if conteo.get(c, 0) == 0:
            return False
        conteo[c] -= 1
    return True`,
      javascript: `function esAnagrama(s, t) {
  if (s.length !== t.length) return false;
  const conteo = new Map();
  for (const c of s) conteo.set(c, (conteo.get(c) || 0) + 1);
  for (const c of t) {
    if (!conteo.get(c)) return false;
    conteo.set(c, conteo.get(c) - 1);
  }
  return true;
}`
    }
  },
  {
    id: "comprar-vender",
    titulo: "Mejor momento para comprar y vender",
    tema: "Arreglos",
    enunciado: "Te dan un arreglo precios donde precios[i] es el precio de una acción el día i. Elige un día para comprar y un día posterior para vender y devuelve la ganancia máxima. Si no se puede ganar, devuelve 0.",
    ejemplos: [
      { entrada: "precios = [7, 1, 5, 3, 6, 4]", salida: "5", nota: "comprar a 1, vender a 6" },
      { entrada: "precios = [7, 6, 4, 3, 1]", salida: "0", nota: "siempre baja" }
    ],
    pistas: [
      "Para vender hoy con la mayor ganancia, ¿qué necesitas saber de los días anteriores?",
      "Se puede resolver en un solo recorrido y sin memoria extra."
    ],
    idea: [
      "Recorro los precios una sola vez guardando el precio mínimo visto hasta ahora.",
      "En cada día calculo la ganancia si vendiera hoy: precio de hoy − mínimo.",
      "Me quedo con la mayor ganancia; si nunca es positiva, el resultado es 0."
    ],
    complejidad: "Tiempo O(n), espacio O(1).",
    conceptos: [["minimo", "menor precio", "mas barato", "mas bajo"], ["una pasada", "un solo recorrido", "una vez", "recorr"], ["ganancia", "diferencia", "rest", "maxim"]],
    codigo: {
      python: `def max_ganancia(precios):
    minimo = float('inf')
    mejor = 0
    for p in precios:
        minimo = min(minimo, p)
        mejor = max(mejor, p - minimo)
    return mejor`,
      javascript: `function maxGanancia(precios) {
  let minimo = Infinity, mejor = 0;
  for (const p of precios) {
    minimo = Math.min(minimo, p);
    mejor = Math.max(mejor, p - minimo);
  }
  return mejor;
}`
    }
  },
  {
    id: "duplicados",
    titulo: "Contiene duplicados",
    tema: "Arreglos y conjuntos",
    enunciado: "Dado un arreglo de enteros, devuelve true si algún valor aparece al menos dos veces y false si todos son distintos.",
    ejemplos: [
      { entrada: "nums = [1, 2, 3, 1]", salida: "true" },
      { entrada: "nums = [1, 2, 3, 4]", salida: "false" }
    ],
    pistas: [
      "¿Qué estructura te dice rápidamente si ya viste un número?",
      "Otra opción: si ordenas el arreglo, ¿dónde quedan los repetidos?"
    ],
    idea: [
      "Recorro el arreglo guardando cada número en un conjunto (set).",
      "Si el número ya estaba en el conjunto, encontré un duplicado y devuelvo true.",
      "Si termino el recorrido sin repetidos, devuelvo false.",
      "Alternativa válida: ordenar y comparar cada elemento con su vecino (O(n log n) y sin memoria extra)."
    ],
    complejidad: "Tiempo O(n), espacio O(n) con el conjunto.",
    conceptos: [["conjunto", "set", "hash", "diccionario", "orden", "sort"], ["ya esta", "ya estaba", "visto", "existe", "repet"], ["recorr", "vecino"]],
    codigo: {
      python: `def contiene_duplicados(nums):
    vistos = set()
    for x in nums:
        if x in vistos:
            return True
        vistos.add(x)
    return False`,
      javascript: `function contieneDuplicados(nums) {
  const vistos = new Set();
  for (const x of nums) {
    if (vistos.has(x)) return true;
    vistos.add(x);
  }
  return false;
}`
    }
  },
  {
    id: "busqueda-binaria",
    titulo: "Búsqueda binaria",
    tema: "Búsqueda",
    enunciado: "Dado un arreglo de enteros ordenado de menor a mayor y un objetivo, devuelve el índice del objetivo o −1 si no está. Tu solución debe ser O(log n).",
    ejemplos: [
      { entrada: "nums = [-1, 0, 3, 5, 9, 12], objetivo = 9", salida: "4" },
      { entrada: "nums = [-1, 0, 3, 5, 9, 12], objetivo = 2", salida: "-1" }
    ],
    pistas: [
      "El arreglo ya está ordenado: si ves el elemento del medio, ¿qué mitad puedes descartar?",
      "Cuida la condición del ciclo para no saltarte el último elemento."
    ],
    idea: [
      "Mantengo dos límites: izquierda al inicio y derecha al final.",
      "Mientras izquierda ≤ derecha, miro el elemento del medio.",
      "Si es el objetivo, devuelvo su índice; si es menor, descarto la mitad izquierda; si es mayor, la derecha.",
      "Si los límites se cruzan, el objetivo no está: devuelvo −1. Cada paso divide el espacio a la mitad."
    ],
    complejidad: "Tiempo O(log n), espacio O(1).",
    conceptos: [["mitad", "medio", "divid", "binaria", "partir"], ["izquierda", "derecha", "limite", "descart"], ["log"]],
    codigo: {
      python: `def busqueda_binaria(nums, objetivo):
    izq, der = 0, len(nums) - 1
    while izq <= der:
        medio = (izq + der) // 2
        if nums[medio] == objetivo:
            return medio
        if nums[medio] < objetivo:
            izq = medio + 1
        else:
            der = medio - 1
    return -1`,
      javascript: `function busquedaBinaria(nums, objetivo) {
  let izq = 0, der = nums.length - 1;
  while (izq <= der) {
    const medio = Math.floor((izq + der) / 2);
    if (nums[medio] === objetivo) return medio;
    if (nums[medio] < objetivo) izq = medio + 1;
    else der = medio - 1;
  }
  return -1;
}`
    }
  },
  {
    id: "invertir-lista",
    titulo: "Invertir una lista enlazada",
    tema: "Listas enlazadas",
    enunciado: "Dada la cabeza de una lista simplemente enlazada (cada nodo tiene un valor y un apuntador al siguiente), inviértela y devuelve la nueva cabeza.",
    ejemplos: [
      { entrada: "1 → 2 → 3 → 4 → 5", salida: "5 → 4 → 3 → 2 → 1" },
      { entrada: "lista vacía", salida: "lista vacía" }
    ],
    pistas: [
      "Si cambias el apuntador «siguiente» de un nodo, ¿cómo no pierdes el resto de la lista?",
      "Necesitas recordar el nodo anterior, el actual y el siguiente."
    ],
    idea: [
      "Uso tres apuntadores: anterior (empieza vacío), actual (empieza en la cabeza) y siguiente.",
      "En cada paso guardo siguiente = actual.siguiente para no perder el resto de la lista.",
      "Volteo el enlace: actual.siguiente = anterior.",
      "Avanzo: anterior = actual y actual = siguiente. Cuando actual queda vacío, anterior es la nueva cabeza.",
      "Funciona también con la lista vacía o de un solo nodo."
    ],
    complejidad: "Tiempo O(n), espacio O(1).",
    conceptos: [["anterior", "previo", "prev"], ["siguiente", "next", "apuntador", "puntero", "guardo"], ["volte", "invert", "apunte al anterior", "apuntar al anterior", "cambio la direccion"]],
    codigo: {
      python: `def invertir(cabeza):
    anterior = None
    actual = cabeza
    while actual:
        siguiente = actual.siguiente   # no perder el resto
        actual.siguiente = anterior    # voltear el enlace
        anterior = actual
        actual = siguiente
    return anterior`,
      javascript: `function invertir(cabeza) {
  let anterior = null, actual = cabeza;
  while (actual) {
    const siguiente = actual.siguiente;  // no perder el resto
    actual.siguiente = anterior;         // voltear el enlace
    anterior = actual;
    actual = siguiente;
  }
  return anterior;
}`
    }
  },
  {
    id: "fusionar-ordenados",
    titulo: "Fusionar dos arreglos ordenados",
    tema: "Dos punteros",
    enunciado: "Dados dos arreglos ordenados de menor a mayor, devuelve un solo arreglo ordenado con todos sus elementos.",
    ejemplos: [
      { entrada: "a = [1, 3, 5], b = [2, 4, 6]", salida: "[1, 2, 3, 4, 5, 6]" },
      { entrada: "a = [], b = [0]", salida: "[0]" }
    ],
    pistas: [
      "Ambos ya están ordenados: ¿qué elemento va primero en el resultado?",
      "¿Qué pasa cuando uno de los arreglos se termina antes que el otro?"
    ],
    idea: [
      "Uso dos punteros, i para a y j para b, empezando en 0.",
      "Comparo a[i] con b[j], agrego el menor al resultado y avanzo ese puntero.",
      "Cuando uno de los arreglos se acaba, agrego todo lo que quede del otro (ya está ordenado).",
      "Ordenar la concatenación también funciona, pero cuesta O((n+m) log(n+m)) y no aprovecha el orden."
    ],
    complejidad: "Tiempo O(n + m), espacio O(n + m) para el resultado.",
    conceptos: [["dos punteros", "dos indices", "i y j", "puntero"], ["menor", "compar", "mas chico", "mas pequeno"], ["lo que quede", "restante", "sobrante", "resto", "se acaba", "se termina"]],
    codigo: {
      python: `def fusionar(a, b):
    i = j = 0
    res = []
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:
            res.append(a[i])
            i += 1
        else:
            res.append(b[j])
            j += 1
    res.extend(a[i:])
    res.extend(b[j:])
    return res`,
      javascript: `function fusionar(a, b) {
  let i = 0, j = 0;
  const res = [];
  while (i < a.length && j < b.length) {
    if (a[i] <= b[j]) res.push(a[i++]);
    else res.push(b[j++]);
  }
  return res.concat(a.slice(i), b.slice(j));
}`
    }
  },
  {
    id: "primer-unico",
    titulo: "Primer carácter único",
    tema: "Cadenas y conteo",
    enunciado: "Dada una cadena, devuelve el índice del primer carácter que no se repite. Si no existe, devuelve −1.",
    ejemplos: [
      { entrada: "s = \"cocodrilo\"", salida: "4", nota: "la «d» aparece una sola vez" },
      { entrada: "s = \"aabb\"", salida: "-1" }
    ],
    pistas: [
      "Primero necesitas saber cuántas veces aparece cada carácter.",
      "Con ese conteo, ¿en qué orden recorres la cadena para encontrar el primero?"
    ],
    idea: [
      "Primera pasada: cuento la frecuencia de cada carácter con un diccionario.",
      "Segunda pasada: recorro la cadena en orden y devuelvo el índice del primer carácter con frecuencia 1.",
      "Si ninguno tiene frecuencia 1, devuelvo −1."
    ],
    complejidad: "Tiempo O(n), espacio O(1) si el alfabeto es fijo (O(k) para k caracteres distintos).",
    conceptos: [["frecuencia", "cont", "diccionario", "hash", "mapa"], ["dos pasadas", "segunda pasada", "otra vez", "de nuevo", "despues recorro", "volver a recorrer", "segundo recorrido"], ["frecuencia 1", "una sola vez", "igual a 1", "no se repite"]],
    codigo: {
      python: `def primer_unico(s):
    conteo = {}
    for c in s:
        conteo[c] = conteo.get(c, 0) + 1
    for i, c in enumerate(s):
        if conteo[c] == 1:
            return i
    return -1`,
      javascript: `function primerUnico(s) {
  const conteo = new Map();
  for (const c of s) conteo.set(c, (conteo.get(c) || 0) + 1);
  for (let i = 0; i < s.length; i++) {
    if (conteo.get(s[i]) === 1) return i;
  }
  return -1;
}`
    }
  }
];
