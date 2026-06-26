/**
 * Exporta o relatório como PDF via janela de impressão do navegador.
 * Pagina nativamente (A4) e insere capa (1ª página) e contracapa (última).
 * Cabeçalho com logo + barra verde-musgo no topo e no rodapé, repetidos em cada página.
 */
const MOSS = "#3b4a2b"; // verde musgo escuro

export function exportReportPdf(opts: {
  titulo: string;
  clienteNome: string;
  contentHtml: string;
  summaryHtml?: string;
  capaUrl?: string | null;
  contracapaUrl?: string | null;
}) {
  const { titulo, clienteNome, contentHtml, summaryHtml, capaUrl, contracapaUrl } = opts;
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) {
    alert("Permita pop-ups para exportar o PDF.");
    return;
  }

  const origin = window.location.origin;
  const logoUrl = `${origin}/zephyr-logo-dark.png`;

  const capa = capaUrl
    ? `<section class="full-page"><img src="${capaUrl}" /></section>`
    : `<section class="full-page cover-fallback">
         <h1>${titulo}</h1><p>${clienteNome}</p>
       </section>`;

  const contracapa = contracapaUrl
    ? `<section class="full-page"><img src="${contracapaUrl}" /></section>`
    : "";

  w.document.write(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>${titulo} — ${clienteNome}</title>
<style>
  @page { size: A4; margin: 22mm 14mm 16mm 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, 'DM Sans', sans-serif; color: #14201a; }

  /* Cabeçalho e rodapé fixos — repetem em cada página impressa, dentro das margens */
  .run-header { position: fixed; top: 0; left: 0; right: 0; }
  .run-header .bar { height: 6px; background: ${MOSS}; }
  .run-header img { height: 22px; margin: 9px 0 0 14mm; display: block; }
  .run-footer { position: fixed; bottom: 0; left: 0; right: 0; }
  .run-footer .bar { height: 5px; background: ${MOSS}; }

  /* Capa/contracapa ocupam a página inteira, sem margem nem cabeçalho */
  .full-page { position: relative; width: 210mm; height: 297mm; margin: -22mm -14mm -16mm -14mm; page-break-after: always; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  .full-page img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cover-fallback { flex-direction: column; background: #0e1714; color: #fff; }
  .cover-fallback h1 { font-size: 32px; margin: 0 0 8px; padding: 0 24px; text-align: center; }

  .content h2 { font-size: 18px; margin: 18px 0 6px; color: #14633e; }
  .content h3 { font-size: 15px; margin: 12px 0 4px; }
  .content p { font-size: 12px; line-height: 1.6; margin: 6px 0; }
  .content ul, .content ol { font-size: 12px; line-height: 1.6; padding-left: 20px; }
</style></head>
<body>
  <div class="run-header"><div class="bar"></div><img src="${logoUrl}" alt="Zephyr" /></div>
  <div class="run-footer"><div class="bar"></div></div>

  ${capa}
  <main class="content">${summaryHtml ?? ""}${contentHtml}</main>
  ${contracapa}

  <script>
    window.onload = function () {
      var imgs = Array.prototype.slice.call(document.images);
      Promise.all(imgs.map(function (img) {
        return img.complete ? Promise.resolve() : new Promise(function (r) { img.onload = img.onerror = r; });
      })).then(function () { setTimeout(function () { window.print(); }, 300); });
    };
  </script>
</body></html>`);
  w.document.close();
}
