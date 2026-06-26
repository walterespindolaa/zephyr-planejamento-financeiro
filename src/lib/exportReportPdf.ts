/**
 * Exporta o relatório como PDF via janela de impressão do navegador.
 * Capa e contracapa em página inteira (limpas). As páginas de conteúdo têm,
 * em cada página, o logo + barra verde-musgo no topo e barra no rodapé,
 * usando thead/tfoot (que se repetem automaticamente na impressão).
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

  const logoUrl = `${window.location.origin}/zephyr-logo-dark.png`;

  const capa = capaUrl
    ? `<section class="full-page"><img src="${capaUrl}" /></section>`
    : `<section class="full-page cover-fallback"><h1>${titulo}</h1><p>${clienteNome}</p></section>`;
  const contracapa = contracapaUrl
    ? `<section class="full-page"><img src="${contracapaUrl}" /></section>`
    : "";

  w.document.write(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>${titulo} — ${clienteNome}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: Inter, 'DM Sans', sans-serif; color: #14201a; }

  /* Capa / contracapa — página inteira, sem cabeçalho */
  .full-page { width: 210mm; height: 297mm; page-break-after: always; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  .full-page img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cover-fallback { flex-direction: column; background: #0e1714; color: #fff; }
  .cover-fallback h1 { font-size: 30px; margin: 0 0 8px; padding: 0 24px; text-align: center; }

  /* Conteúdo — thead/tfoot repetem em cada página */
  table.report { width: 100%; border-collapse: collapse; }
  .hd-cell, .ft-cell { padding: 0; }
  .hd .bar { height: 7px; background: ${MOSS}; }
  .hd img { height: 20px; margin: 9px 0 9px 20mm; display: block; }
  .ft { position: relative; height: 14mm; }
  .ft .bar { position: absolute; bottom: 0; left: 0; right: 0; height: 6px; background: ${MOSS}; }
  .body-cell { padding: 5mm 20mm 0 20mm; }

  .content h2 { font-size: 16px; margin: 18px 0 6px; color: #14633e; }
  .content h3 { font-size: 14px; margin: 12px 0 4px; }
  .content p { font-size: 12px; line-height: 1.6; margin: 6px 0; }
  .content ul, .content ol { font-size: 12px; line-height: 1.6; padding-left: 20px; }
</style></head>
<body>
  ${capa}
  <table class="report">
    <thead><tr><td class="hd-cell"><div class="hd"><div class="bar"></div><img src="${logoUrl}" alt="Zephyr" /></div></td></tr></thead>
    <tfoot><tr><td class="ft-cell"><div class="ft"><div class="bar"></div></div></td></tr></tfoot>
    <tbody><tr><td class="body-cell"><main class="content">${summaryHtml ?? ""}${contentHtml}</main></td></tr></tbody>
  </table>
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
