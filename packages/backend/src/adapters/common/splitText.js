export function splitText(text = '', limit = 4000) {
  const value = String(text); if (!value) return ['']; const parts = [];
  let rest = value;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n\n', limit); if (cut < limit * 0.4) cut = rest.lastIndexOf('\n', limit); if (cut < limit * 0.4) cut = rest.lastIndexOf(' ', limit); if (cut < 1) cut = limit;
    parts.push(rest.slice(0, cut)); rest = rest.slice(cut);
  }
  if (rest || !parts.length) parts.push(rest); return parts;
}
