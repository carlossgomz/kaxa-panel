import type { Client } from "@libsql/client";

// Mismo producto "placeholder" del recargo de delivery que excluyen
// Reportes y Estadisticas.tsx del escritorio — no es un producto real.
const PRODUCTO_DELIVERY_ID = "f195fbac-103d-48fa-a27a-28371fba7745";

export type Consejo = {
  prioridad: "urgente" | "atencion" | "positivo" | "tip";
  icono: string;
  texto: string;
  href?: string;
};

export type ResumenPeriodos = {
  hoyBs: number;
  ayerBs: number;
  semanaBs: number;
  semanaAnteriorBs: number;
  mesBs: number;
  mesAnteriorBs: number;
};

// Consejos generales del negocio, sin depender de ningún dato — para que
// el Asistente Kax siempre tenga algo que decir, incluso un día tranquilo
// sin alertas ni récords. Rota por día (mismo consejo todo el día, cambia
// al día siguiente) en vez de ser aleatorio en cada carga de página.
const TIPS_GENERALES = [
  "Revisa tu stock una vez por semana — te ahorra sorpresas de última hora.",
  "Un cliente que vuelve vale más que uno nuevo: trátalo bien y va a volver.",
  "Los costos cambian rápido — compara precios con tus proveedores de vez en cuando.",
  "Mientras más métodos de pago aceptes, menos ventas se te van por no tener cómo cobrar.",
  "Un inventario ordenado hace que cobrar sea más rápido, sobre todo en horas pico.",
  "Vale la pena destacar tus productos de mayor margen — no todos generan lo mismo.",
  "Cierra la caja todos los días, aunque sea rápido — evita sustos más adelante.",
  "Escuchar lo que piden tus clientes es la mejor forma de saber qué traer nuevo.",
  "Un cliente fiado que paga a tiempo es un cliente que vale la pena cuidar.",
  "Revisar tus reportes cada semana ayuda a notar cambios antes de que sean un problema.",
];

function tipDelDia(): string {
  const diaDelAnio = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000);
  return TIPS_GENERALES[diaDelAnio % TIPS_GENERALES.length];
}

const UMBRAL_DIAS_CREDITO = 15;
const UMBRAL_DIAS_FACTURA = 15;
const UMBRAL_MARGEN_PCT = 10; // por debajo de esto (o negativo) se avisa
const UMBRAL_DIAS_SIN_MOVIMIENTO = 30;
const UMBRAL_CAPITAL_ESTANCADO_USD = 15;

// Los productos por peso guardan el stock con decimales de punto flotante
// (ej. 4.562000000000003 kg) — se redondea a 2 decimales y se quitan los
// ceros sobrantes para mostrar algo legible.
function formatoUnidades(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function diasDesde(fechaTexto: string): number {
  const ms = Date.now() - new Date(fechaTexto.replace(" ", "T") + "Z").getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

// El "Asistente Kax" en Inicio — consejos accionables sacados de reglas
// simples sobre los datos del propio negocio (nada de IA ni costo por
// mensaje: todo son consultas SQL con umbrales, como cualquier otra
// pantalla). Carlos pidió específicamente cuentas por cobrar viejas,
// facturas de proveedor atrasadas y stock bajo de productos que sí
// venden — se agregaron otras 3 por iniciativa propia (margen negativo,
// stock muerto, y una de ánimo cuando el día viene bien) porque el pedido
// fue "nomina ayudas y sugerencias también", no solo esas tres.
export async function obtenerConsejos(
  db: Client,
  rol: string,
  tasa: number,
  resumen: ResumenPeriodos
): Promise<Consejo[]> {
  const { hoyBs, ayerBs, semanaBs, semanaAnteriorBs, mesBs, mesAnteriorBs } = resumen;
  const consejos: Consejo[] = [];
  const esAdmin = rol === "ADMIN";

  // 1. Crédito de cliente pendiente hace muchos días (todos los roles: Cobrar
  // es una sección que también usa el cajero).
  const creditoViejo = await db.execute(
    `SELECT v.cliente_nombre, v.cliente_cedula, MIN(v.fecha_hora) as fecha_mas_vieja,
            SUM(v.monto_pendiente_usd) as total_pendiente_usd
     FROM ventas v WHERE v.estado = 'CREDITO_PENDIENTE'
     GROUP BY v.cliente_cedula ORDER BY fecha_mas_vieja ASC LIMIT 1`
  );
  const filaCredito = creditoViejo.rows[0];
  if (filaCredito) {
    const dias = diasDesde(String(filaCredito.fecha_mas_vieja));
    if (dias >= UMBRAL_DIAS_CREDITO) {
      const nombre = String(filaCredito.cliente_nombre);
      const usd = Number(filaCredito.total_pendiente_usd);
      consejos.push({
        prioridad: "urgente",
        icono: "💵",
        texto: `${nombre} te debe USD ${usd.toFixed(2)} desde hace ${dias} días — quizás valga la pena recordarle.`,
        href: `/panel/cobrar/${encodeURIComponent(String(filaCredito.cliente_cedula))}`,
      });
    }
  }

  if (esAdmin) {
    // 2. Factura de proveedor pendiente hace muchos días.
    const facturaVieja = await db.execute(
      `SELECT pr.id as proveedor_id, pr.nombre as proveedor_nombre, fc.numero_factura, fc.fecha,
              (fc.monto_total_usd - fc.monto_pagado_usd) as saldo_usd
       FROM facturas_compra fc JOIN proveedores pr ON pr.id = fc.proveedor_id
       WHERE fc.estado != 'PAGADA' ORDER BY fc.fecha ASC LIMIT 1`
    );
    const filaFactura = facturaVieja.rows[0];
    if (filaFactura) {
      const dias = diasDesde(String(filaFactura.fecha));
      if (dias >= UMBRAL_DIAS_FACTURA) {
        consejos.push({
          prioridad: "urgente",
          icono: "📦",
          texto: `La factura ${filaFactura.numero_factura} de ${filaFactura.proveedor_nombre} lleva ${dias} días sin pagarse (saldo USD ${Number(filaFactura.saldo_usd).toFixed(2)}).`,
          href: `/panel/pagar/${filaFactura.proveedor_id}`,
        });
      }
    }

    // 4. Margen casi nulo o negativo — el costo subió (nueva compra a mayor
    // precio) y el precio de venta se quedó atrás, algo muy común cuando el
    // dólar se mueve seguido. Se compara contra la tasa de HOY, no la de
    // cuando se fijó el precio.
    const margenBajo = await db.execute({
      sql: `SELECT p.nombre,
                   p.precio_venta_bs - p.costo_actual_usd * ? as margen_bs,
                   p.costo_actual_usd * ? as costo_bs
            FROM productos p
            WHERE p.activo = 1 AND p.id != ? AND p.costo_actual_usd > 0 AND p.precio_venta_bs > 0
            ORDER BY (p.precio_venta_bs - p.costo_actual_usd * ?) / (p.costo_actual_usd * ?) ASC
            LIMIT 1`,
      args: [tasa, tasa, PRODUCTO_DELIVERY_ID, tasa, tasa],
    });
    const filaMargen = margenBajo.rows[0];
    if (filaMargen) {
      const costoBs = Number(filaMargen.costo_bs);
      const margenBs = Number(filaMargen.margen_bs);
      const margenPct = costoBs > 0 ? (margenBs / costoBs) * 100 : 100;
      if (margenPct < UMBRAL_MARGEN_PCT) {
        consejos.push({
          prioridad: "atencion",
          icono: margenPct < 0 ? "🆘" : "⚠️",
          texto:
            margenPct < 0
              ? `"${filaMargen.nombre}" se está vendiendo por debajo de su costo actual — revisa su precio.`
              : `"${filaMargen.nombre}" apenas deja margen (${margenPct.toFixed(0)}%) al costo de hoy — capaz conviene subirle el precio.`,
          href: "/panel/inventario",
        });
      }
    }

    // 3. Producto que vende bien y tiene poco stock (según SU propio
    // stock_minimo configurado, no un número inventado).
    const pocoStock = await db.execute({
      sql: `SELECT p.nombre, p.stock_actual,
                   SUM(vi.cantidad * (vi.precio_unit_bs - p.costo_actual_usd * v.tasa_cambio_dia)) as ganancia_30d_bs
            FROM productos p
            JOIN venta_items vi ON vi.producto_id = p.id
            JOIN ventas v ON v.id = vi.venta_id
            WHERE p.activo = 1 AND p.id != ? AND p.stock_minimo > 0 AND p.stock_actual <= p.stock_minimo
              AND date(v.fecha_hora) >= date('now', '-4 hours', '-30 days')
            GROUP BY p.id ORDER BY ganancia_30d_bs DESC LIMIT 1`,
      args: [PRODUCTO_DELIVERY_ID],
    });
    const filaPocoStock = pocoStock.rows[0];
    if (filaPocoStock) {
      consejos.push({
        prioridad: "atencion",
        icono: "📉",
        texto: `"${filaPocoStock.nombre}" queda en ${formatoUnidades(Number(filaPocoStock.stock_actual))} unidades y en el último mes generó Bs ${Number(filaPocoStock.ganancia_30d_bs).toLocaleString("es-VE", { maximumFractionDigits: 0 })} de ganancia — vale la pena reponerlo pronto.`,
        href: "/panel/inventario",
      });
    }

    // 5. Stock muerto: capital importante parado en un producto que no se
    // mueve hace tiempo.
    const stockMuerto = await db.execute({
      sql: `SELECT p.nombre, p.stock_actual, p.stock_actual * p.costo_actual_usd as capital_usd
            FROM productos p
            WHERE p.activo = 1 AND p.id != ? AND p.stock_actual > 0
              AND p.created_at <= date('now', '-4 hours', '-${UMBRAL_DIAS_SIN_MOVIMIENTO} days')
              AND NOT EXISTS (
                SELECT 1 FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id
                WHERE vi.producto_id = p.id AND date(v.fecha_hora) >= date('now', '-4 hours', '-${UMBRAL_DIAS_SIN_MOVIMIENTO} days')
              )
            ORDER BY capital_usd DESC LIMIT 1`,
      args: [PRODUCTO_DELIVERY_ID],
    });
    const filaMuerto = stockMuerto.rows[0];
    if (filaMuerto && Number(filaMuerto.capital_usd) >= UMBRAL_CAPITAL_ESTANCADO_USD) {
      consejos.push({
        prioridad: "atencion",
        icono: "🐌",
        texto: `"${filaMuerto.nombre}" tiene ${formatoUnidades(Number(filaMuerto.stock_actual))} unidades sin venderse hace más de ${UMBRAL_DIAS_SIN_MOVIMIENTO} días (USD ${Number(filaMuerto.capital_usd).toFixed(2)} parados ahí) — quizás una promoción lo mueva.`,
        href: "/panel/inventario",
      });
    }
  }

  // 6, 7, 8. Buenas noticias — reusan números que Inicio ya calculó, sin
  // consultas extra. hoy-vs-ayer es literalmente lo que pidió Carlos
  // ("que se haya vendido más que el día anterior"); semana y mes son la
  // misma idea a otra escala, para que el asistente celebre algo casi
  // cualquier día, no solo alertas.
  if (hoyBs > 0 && ayerBs > 0 && hoyBs > ayerBs * 1.05) {
    const mejora = Math.round((hoyBs / ayerBs - 1) * 100);
    consejos.push({
      prioridad: "positivo",
      icono: "🚀",
      texto: `¡Hoy vendiste más que ayer! Bs ${hoyBs.toLocaleString("es-VE", { maximumFractionDigits: 0 })} (+${mejora}%) — así se hace.`,
    });
  }
  if (semanaBs > 0 && semanaAnteriorBs > 0 && semanaBs > semanaAnteriorBs * 1.1) {
    const mejora = Math.round((semanaBs / semanaAnteriorBs - 1) * 100);
    consejos.push({
      prioridad: "positivo",
      icono: "📅",
      texto: `Esta semana vas ${mejora}% mejor que la anterior — vas por buen camino.`,
    });
  }
  if (mesBs > 0 && mesAnteriorBs > 0 && mesBs > mesAnteriorBs * 1.1) {
    const mejora = Math.round((mesBs / mesAnteriorBs - 1) * 100);
    consejos.push({
      prioridad: "positivo",
      icono: "🗓️",
      texto: `Este mes va ${mejora}% mejor que el pasado — sigue así.`,
    });
  }

  // 9. Consejo general del día — siempre presente, para que el asistente
  // nunca se quede callado en un día sin nada especial que avisar.
  consejos.push({ prioridad: "tip", icono: "💡", texto: tipDelDia() });

  const orden = { urgente: 0, atencion: 1, positivo: 2, tip: 3 };
  return consejos.sort((a, b) => orden[a.prioridad] - orden[b.prioridad]);
}
