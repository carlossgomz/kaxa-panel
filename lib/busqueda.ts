// Réplica exacta de src/busqueda.ts del escritorio — búsqueda insensible a
// acentos ("azucar" debe encontrar "Azúcar"). Ver ese archivo para el
// detalle de por qué hace falta el REPLACE encadenado en vez de solo LOWER.
export function sqlSinAcentos(columna: string): string {
  const pares: [string, string][] = [
    ["á", "a"], ["é", "e"], ["í", "i"], ["ó", "o"], ["ú", "u"], ["ñ", "n"],
    ["Á", "a"], ["É", "e"], ["Í", "i"], ["Ó", "o"], ["Ú", "u"], ["Ñ", "n"],
  ];
  let expr = `LOWER(${columna})`;
  for (const [acentuada, plana] of pares) {
    expr = `REPLACE(${expr},'${acentuada}','${plana}')`;
  }
  return expr;
}

const DIACRITICOS = /[̀-ͯ]/g;

export function normalizarTexto(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(DIACRITICOS, "");
}
