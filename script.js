// ==== ELEMENTOS DEL DOM ====
const selectAnio = document.getElementById("anio");
const selectMes = document.getElementById("mes");
const btnVerMes = document.getElementById("verMes");
const contenedorSemanas = document.getElementById("contenedorSemanas");
const detalleSemana = document.getElementById("detalleSemana");
const tituloSemana = document.getElementById("tituloSemana");
const tablaBody = document.querySelector("#tablaHorarios tbody");
const totalHorasEl = document.getElementById("totalHoras");
const btnGuardar = document.getElementById("guardarSemana");
const btnVolver = document.getElementById("volver");
const btnExportar = document.getElementById("exportarExcel");

// ==== DATOS GLOBALES ====
let semanaActual = null;
let horarios = JSON.parse(localStorage.getItem("horarios")) || {}; // estructura: { año: { mes: { semana: [ {dia, entrada, salida, horas} ] } } }

// ==== INICIALIZACIÓN ====
document.addEventListener("DOMContentLoaded", () => {
  cargarAnios();
  cargarMeses();
});

// ==== CARGAR AÑOS Y MESES ====
function cargarAnios() {
  const anioActual = new Date().getFullYear();
  for (let i = anioActual - 2; i <= anioActual + 1; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    if (i === anioActual) opt.selected = true;
    selectAnio.appendChild(opt);
  }
}

function cargarMeses() {
  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  meses.forEach((m, i) => {
    const opt = document.createElement("option");
    opt.value = i + 1;
    opt.textContent = m;
    if (i === new Date().getMonth()) opt.selected = true;
    selectMes.appendChild(opt);
  });
}

// ==== MOSTRAR SEMANAS DEL MES ====
btnVerMes.addEventListener("click", () => {
  const anio = selectAnio.value;
  const mes = selectMes.value;
  mostrarSemanas(anio, mes);
});

function mostrarSemanas(anio, mes) {
  contenedorSemanas.innerHTML = "";
  detalleSemana.classList.add("oculto");
  const semanas = obtenerSemanasDelMes(anio, mes);

  semanas.forEach((sem, i) => {
    const rango = `${formatearFecha(sem.inicio)}-${formatearFecha(sem.fin)}`;

    // ✅ Buscar la semana en este mes o en los meses vecinos
    const dataGuardada =
      horarios[anio]?.[mes]?.[rango] ||
      horarios[anio]?.[mes - 1]?.[rango] ||
      horarios[anio]?.[parseInt(mes) + 1]?.[rango];

    const div = document.createElement("div");
    div.className = "semana";
    div.innerHTML = `
      <h3>Semana ${i + 1}</h3>
      <p>${formatearFecha(sem.inicio)} - ${formatearFecha(sem.fin)}</p>
    `;

    // ✅ Si la semana tiene datos completos → fondo verde
    if (dataGuardada && dataGuardada.length > 0) {
      const completa = dataGuardada.every(d => d.entrada && d.salida && d.horas > 0);
      if (completa) div.classList.add("semana-completa");
    }

    // ✅ Al hacer clic, pasamos los datos aunque vengan del mes vecino
    div.addEventListener("click", () => {
      abrirSemana(anio, mes, sem, dataGuardada ? rango : null);
    });

    contenedorSemanas.appendChild(div);
  });

  calcularTotales(anio, mes);
}


// ==== CALCULAR SEMANAS DE UN MES (SIEMPRE EMPIEZAN LUNES) ====
function obtenerSemanasDelMes(anio, mes) {
  const semanas = [];
  const primerDiaMes = new Date(anio, mes - 1, 1);

  // Ajustar para que empiece el lunes anterior (si no lo es)
  const diaSemana = primerDiaMes.getDay(); // 0 = domingo, 1 = lunes...
  const inicioPrimeraSemana = new Date(primerDiaMes);
  const offset = diaSemana === 0 ? -6 : 1 - diaSemana;
  inicioPrimeraSemana.setDate(primerDiaMes.getDate() + offset);

  let inicio = new Date(inicioPrimeraSemana);

  while (inicio.getMonth() <= mes - 1 && inicio.getFullYear() === parseInt(anio)) {
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 6);
    semanas.push({ inicio: new Date(inicio), fin });

    inicio.setDate(inicio.getDate() + 7);
    if (inicio.getMonth() > mes - 1 && inicio.getDate() < 7) break;
  }

  return semanas;
}

function formatearFecha(fecha) {
  return fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

// ==== ABRIR SEMANA ====
function abrirSemana(anio, mes, semana, rangoExistente = null) {
  const rango = rangoExistente || `${formatearFecha(semana.inicio)}-${formatearFecha(semana.fin)}`;
  semanaActual = { anio, mes, rango };
  tituloSemana.textContent = `Semana del ${formatearFecha(semana.inicio)} al ${formatearFecha(semana.fin)}`;

  contenedorSemanas.innerHTML = "";
  detalleSemana.classList.remove("oculto");

  const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  tablaBody.innerHTML = "";

  // ✅ Buscar datos guardados en este mes o en los vecinos
  const dataGuardada =
    horarios[anio]?.[mes]?.[rango] ||
    horarios[anio]?.[mes - 1]?.[rango] ||
    horarios[anio]?.[parseInt(mes) + 1]?.[rango] ||
    [];

  dias.forEach((dia, i) => {
    const fila = document.createElement("tr");
    const entrada = dataGuardada[i]?.entrada || "";
    const salida = dataGuardada[i]?.salida || "";
    const horas = dataGuardada[i]?.horas || "";

    fila.innerHTML = `
      <td>${dia}</td>
      <td><input type="time" class="entrada" value="${entrada}"></td>
      <td><input type="time" class="salida" value="${salida}"></td>
      <td class="horas">${horas}</td>
    `;
    tablaBody.appendChild(fila);
  });

  calcularTotal();
}


// ==== CALCULAR HORAS DIARIAS Y TOTALES ====
tablaBody.addEventListener("input", e => {
  if (e.target.classList.contains("entrada") || e.target.classList.contains("salida")) {
    const fila = e.target.closest("tr");
    const entrada = fila.querySelector(".entrada").value;
    const salida = fila.querySelector(".salida").value;
    const celdaHoras = fila.querySelector(".horas");

    if (entrada && salida) {
      const horas = calcularHoras(entrada, salida);
      celdaHoras.textContent = horas.toFixed(2);
    } else {
      celdaHoras.textContent = "";
    }

    calcularTotal();
  }
});

function calcularHoras(entrada, salida) {
  const [h1, m1] = entrada.split(":").map(Number);
  const [h2, m2] = salida.split(":").map(Number);
  const inicio = h1 * 60 + m1;
  const fin = h2 * 60 + m2;
  return (fin - inicio) / 60;
}

function calcularTotal() {
  const celdas = document.querySelectorAll(".horas");
  let total = 0;

  celdas.forEach(c => {
    total += parseFloat(c.textContent) || 0;
  });

  totalHorasEl.textContent = total.toFixed(2);
  totalHorasEl.classList.toggle("hora-exceso", total > 24);
}

// ==== GUARDAR SEMANA ====
btnGuardar.addEventListener("click", () => {
  if (!semanaActual) return;

  const filas = tablaBody.querySelectorAll("tr");
  const datos = [];

  filas.forEach(f => {
    const dia = f.cells[0].textContent;
    const entrada = f.querySelector(".entrada").value;
    const salida = f.querySelector(".salida").value;
    const horas = parseFloat(f.querySelector(".horas").textContent) || 0;
    datos.push({ dia, entrada, salida, horas });
  });

  const anio = parseInt(semanaActual.anio);
  const mesPrincipal = parseInt(semanaActual.mes);
  const rango = semanaActual.rango;

  if (!horarios[anio]) horarios[anio] = {};

  // Guardar en el mes actual
  if (!horarios[anio][mesPrincipal]) horarios[anio][mesPrincipal] = {};
  horarios[anio][mesPrincipal][rango] = datos;

  // --- NUEVO ---
  // Analizamos el rango para detectar si cruza de mes
  const [inicioStr, finStr] = rango.split("-");
  const [diaInicio, mesInicio] = inicioStr.split("/").map(Number);
  const [diaFin, mesFin] = finStr.split("/").map(Number);

  // Si la semana cruza de mes, también guardamos en el otro mes
  if (mesInicio !== mesFin) {
    const mesAdyacente = mesFin !== mesPrincipal ? mesFin : mesInicio;
    if (!horarios[anio][mesAdyacente]) horarios[anio][mesAdyacente] = {};
    horarios[anio][mesAdyacente][rango] = datos;
  }

  // 🔁 Sincronizar si ya existía en meses vecinos
  if (horarios[anio][mesPrincipal - 1]?.[rango])
    horarios[anio][mesPrincipal - 1][rango] = datos;
  if (horarios[anio][mesPrincipal + 1]?.[rango])
    horarios[anio][mesPrincipal + 1][rango] = datos;

  // Guardar en localStorage
  localStorage.setItem("horarios", JSON.stringify(horarios));

  alert("✅ Semana guardada y sincronizada con el mes vecino (si aplica).");
});


// ==== VOLVER ====
btnVolver.addEventListener("click", () => {
  const anio = selectAnio.value;
  const mes = selectMes.value;
  mostrarSemanas(anio, mes);
});

// ==== EXPORTAR A EXCEL (se agrega después) ====
// ==== EXPORTAR A EXCEL ====
btnExportar.addEventListener("click", () => {
  if (!semanaActual) {
    alert("⚠️ No hay una semana seleccionada.");
    return;
  }

  const filas = tablaBody.querySelectorAll("tr");
  const datos = [];

  filas.forEach(f => {
    const dia = f.cells[0].textContent;
    const entrada = f.querySelector(".entrada").value;
    const salida = f.querySelector(".salida").value;
    const horas = f.querySelector(".horas").textContent;
    datos.push({ Día: dia, Entrada: entrada, Salida: salida, "Horas trabajadas": horas });
  });

  const total = totalHorasEl.textContent;
  datos.push({});
  datos.push({ Día: "TOTAL SEMANAL", "Horas trabajadas": total });

  // Crear hoja de Excel
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(datos);
  XLSX.utils.book_append_sheet(wb, ws, "Semana");

  // Nombre del archivo
  const nombreArchivo = `Horarios_${semanaActual.anio}_${semanaActual.mes}_${semanaActual.rango.replace(/\//g, "-")}.xlsx`;

  // Descargar archivo
  XLSX.writeFile(wb, nombreArchivo);
});

// ==== CALCULAR TOTAL MENSUAL Y ANUAL ====
function calcularTotales(anio, mes) {
  const dataAnio = horarios[anio];
  if (!dataAnio) {
    document.getElementById("totalMensual").textContent = "Total mensual: 0 hs";
    document.getElementById("totalAnual").textContent = "Total anual: 0 hs";
    return;
  }

  // ---- Total mensual ----
  const dataMes = dataAnio[mes];
  let totalMensual = 0;
  if (dataMes) {
    Object.values(dataMes).forEach(semana => {
      semana.forEach(dia => {
        totalMensual += dia.horas || 0;
      });
    });
  }

  // ---- Total anual ----
  let totalAnual = 0;
  Object.values(dataAnio).forEach(mesData => {
    Object.values(mesData).forEach(semana => {
      semana.forEach(dia => {
        totalAnual += dia.horas || 0;
      });
    });
  });

  document.getElementById("totalMensual").textContent = `Total mensual: ${totalMensual.toFixed(2)} hs`;
  document.getElementById("totalAnual").textContent = `Total anual: ${totalAnual.toFixed(2)} hs`;
}

// Recalcular cuando se cambia el mes
btnVerMes.addEventListener("click", () => {
  const anio = selectAnio.value;
  const mes = selectMes.value;
  mostrarSemanas(anio, mes);
  calcularTotales(anio, mes);
});

// ==== EXPORTAR MES Y AÑO ====

// Función para obtener el nombre del mes por número
function obtenerNombreMes(numero) {
  const nombres = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  return nombres[numero - 1] || "";
}

// Exportar Mes
document.getElementById("exportarMes").addEventListener("click", () => {
  const anio = selectAnio.value;
  const mes = selectMes.value;
  const dataMes = horarios[anio]?.[mes];

  if (!dataMes) {
    alert("⚠️ No hay datos guardados para este mes.");
    return;
  }

  const datos = [];
  Object.entries(dataMes).forEach(([rango, dias]) => {
    datos.push({ Semana: rango });
    dias.forEach(dia => {
      datos.push({
        Día: dia.dia,
        Entrada: dia.entrada,
        Salida: dia.salida,
        "Horas trabajadas": dia.horas.toFixed(2)
      });
    });
    datos.push({});
  });

  // Agregar total mensual
  const totalMensual = document.getElementById("totalMensual").textContent.split(": ")[1];
  datos.push({ Día: "TOTAL MENSUAL", "Horas trabajadas": totalMensual });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(datos);
  XLSX.utils.book_append_sheet(wb, ws, "Mes");

  const nombreArchivo = `Horarios_${anio}_${mes}.xlsx`;
  XLSX.writeFile(wb, nombreArchivo);
});

// Exportar Año
document.getElementById("exportarAnio").addEventListener("click", () => {
  const anio = selectAnio.value;
  const dataAnio = horarios[anio];

  if (!dataAnio) {
    alert("⚠️ No hay datos guardados para este año.");
    return;
  }

  const datos = [];
  Object.entries(dataAnio).forEach(([mes, semanas]) => {
    datos.push({ Mes: obtenerNombreMes(mes) });
    Object.entries(semanas).forEach(([rango, dias]) => {
      datos.push({ Semana: rango });
      dias.forEach(dia => {
        datos.push({
          Día: dia.dia,
          Entrada: dia.entrada,
          Salida: dia.salida,
          "Horas trabajadas": dia.horas.toFixed(2)
        });
      });
      datos.push({});
    });
    datos.push({});
  });

  // Agregar total anual
  const totalAnual = document.getElementById("totalAnual").textContent.split(": ")[1];
  datos.push({ Día: "TOTAL ANUAL", "Horas trabajadas": totalAnual });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(datos);
  XLSX.utils.book_append_sheet(wb, ws, "Año");

  const nombreArchivo = `Horarios_${anio}.xlsx`;
  XLSX.writeFile(wb, nombreArchivo);
});
