import { NextRequest, NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";

// Devuelve los métodos de pago del negocio si tiene la tabla dinámica
// metodos_pago (igual que Kaxa Avanzado de escritorio). Day Express corre
// la build especial de pos-minimarket, que nunca tuvo esa tabla ni esa
// pantalla — para ese caso soportado=false, y quien llama (Venta, Cobrar,
// Pagar, esta misma pantalla) usa su propio listado fijo de reserva en
// vez de romper. Sin exigirAdmin: cualquier rol logueado necesita leer
// esto para elegir método al cobrar, no solo el admin.
export async function GET() {
  const sesion = obtenerSesion();
  if (!sesion) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  try {
    const res = await db.execute("SELECT id, nombre, moneda, activo, es_sistema FROM metodos_pago ORDER BY created_at");
    const metodos = res.rows.map((r) => ({
      id: String(r.id),
      nombre: String(r.nombre),
      moneda: String(r.moneda),
      activo: Number(r.activo),
      es_sistema: Number(r.es_sistema),
    }));
    return NextResponse.json({ soportado: true, metodos });
  } catch {
    return NextResponse.json({ soportado: false, metodos: [] });
  }
}

// Agregar un método nuevo — solo admin, mismo criterio de "sin borrado,
// solo desactivar" que MetodosPago.tsx del escritorio.
export async function POST(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion || sesion.rol !== "ADMIN") return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const { nombre, moneda } = await req.json();
  const nombreLimpio = String(nombre ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  if (!nombreLimpio) return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  if (moneda !== "BS" && moneda !== "USD") return NextResponse.json({ error: "Elige una moneda válida." }, { status: 400 });

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  try {
    await db.execute({
      sql: "INSERT INTO metodos_pago (id, nombre, moneda) VALUES (?, ?, ?)",
      args: [crypto.randomUUID(), nombreLimpio, moneda],
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo agregar (¿nombre repetido?): ${String(e)}` }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

// Activar/desactivar — solo admin. Mismo candado que el escritorio: un
// método de sistema (es_sistema=1) que usa la integración de delivery no
// se puede apagar mientras el delivery esté configurado (config.delivery_api_url).
export async function PATCH(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion || sesion.rol !== "ADMIN") return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const { id, activo } = await req.json();
  if (!id || (activo !== 0 && activo !== 1)) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);

  if (activo === 0) {
    const fila = await db.execute({ sql: "SELECT nombre, es_sistema FROM metodos_pago WHERE id = ?", args: [id] });
    const metodo = fila.rows[0];
    if (metodo && Number(metodo.es_sistema) === 1) {
      const cfg = await db.execute("SELECT delivery_api_url FROM config WHERE id = 1");
      if (cfg.rows[0]?.delivery_api_url) {
        return NextResponse.json(
          {
            error: `"${String(metodo.nombre).split("_").join(" ")}" lo usa la integración de delivery — no se puede desactivar mientras el delivery esté configurado.`,
          },
          { status: 400 }
        );
      }
    }
  }

  await db.execute({ sql: "UPDATE metodos_pago SET activo = ? WHERE id = ?", args: [activo, id] });
  return NextResponse.json({ ok: true });
}
