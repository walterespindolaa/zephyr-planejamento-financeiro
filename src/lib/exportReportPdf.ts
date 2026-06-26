import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * Gera o PDF e baixa direto (sem abrir página/diálogo de impressão).
 * Capa e contracapa em página inteira; páginas de conteúdo com logo + barra
 * verde-musgo no topo e no rodapé, desenhados em cada página.
 */
const MOSS: [number, number, number] = [59, 74, 43]; // #3b4a2b

const A4 = { w: 210, h: 297 };
const MARGIN_X = 18;
const HEADER_H = 16; // zona do cabeçalho (mm)
const FOOTER_H = 12; // zona do rodapé (mm)
const CONTENT_W = A4.w - MARGIN_X * 2;
const CONTENT_H = A4.h - HEADER_H - FOOTER_H;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Converte a imagem para JPEG dataURL (preenche a página inteira ao adicionar). */
function imgToJpeg(img: HTMLImageElement): string {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  c.getContext("2d")!.drawImage(img, 0, 0);
  return c.toDataURL("image/jpeg", 0.95);
}

export async function exportReportPdf(opts: {
  titulo: string;
  clienteNome: string;
  contentHtml: string;
  summaryHtml?: string;
  capaUrl?: string | null;
  contracapaUrl?: string | null;
}) {
  const { titulo, clienteNome, contentHtml, summaryHtml, capaUrl, contracapaUrl } = opts;

  // 1) Render do conteúdo num container escondido, na largura útil
  const pxPerMm = 96 / 25.4;
  const holder = document.createElement("div");
  holder.style.cssText = `position:fixed;left:-99999px;top:0;width:${Math.round(CONTENT_W * pxPerMm)}px;background:#fff;`;
  holder.innerHTML = `
    <style>
      .pdfdoc { font-family: Inter, 'DM Sans', sans-serif; color:#14201a; padding:2px; }
      .pdfdoc h2 { font-size:15px; margin:16px 0 6px; color:#14633e; }
      .pdfdoc h3 { font-size:13px; margin:10px 0 4px; }
      .pdfdoc p { font-size:11.5px; line-height:1.6; margin:6px 0; }
      .pdfdoc ul, .pdfdoc ol { font-size:11.5px; line-height:1.6; padding-left:18px; }
      .pdfdoc strong { font-weight:700; }
    </style>
    <div class="pdfdoc">${summaryHtml ?? ""}${contentHtml}</div>`;
  document.body.appendChild(holder);

  const canvas = await html2canvas(holder, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
  document.body.removeChild(holder);

  const pdf = new jsPDF("p", "mm", "a4");

  // 2) Capa
  if (capaUrl) {
    try {
      const img = await loadImage(capaUrl);
      pdf.addImage(imgToJpeg(img), "JPEG", 0, 0, A4.w, A4.h); // estica p/ página inteira
    } catch {
      pdf.setFillColor(14, 23, 20);
      pdf.rect(0, 0, A4.w, A4.h, "F");
    }
  } else {
    pdf.setFillColor(14, 23, 20);
    pdf.rect(0, 0, A4.w, A4.h, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.text(titulo, A4.w / 2, A4.h / 2, { align: "center", maxWidth: A4.w - 40 });
    pdf.setFontSize(12);
    pdf.text(clienteNome, A4.w / 2, A4.h / 2 + 16, { align: "center" });
  }

  // logo (cabeçalho)
  let logo: HTMLImageElement | null = null;
  try {
    logo = await loadImage(`${window.location.origin}/zephyr-logo-dark.png`);
  } catch {
    /* sem logo */
  }
  const logoH = 6;
  const logoW = logo ? (logo.width / logo.height) * logoH : 0;

  const drawChrome = () => {
    pdf.setFillColor(MOSS[0], MOSS[1], MOSS[2]);
    pdf.rect(0, 0, A4.w, 2, "F"); // barra topo
    if (logo) pdf.addImage(logo, "PNG", MARGIN_X, 5, logoW, logoH);
    pdf.setFillColor(MOSS[0], MOSS[1], MOSS[2]);
    pdf.rect(0, A4.h - 2, A4.w, 2, "F"); // barra rodapé
  };

  // 3) Páginas de conteúdo (fatiando o canvas)
  const scalePxPerMm = canvas.width / CONTENT_W;
  const pageSlicePx = Math.floor(CONTENT_H * scalePxPerMm);
  let rendered = 0;
  while (rendered < canvas.height) {
    pdf.addPage();
    drawChrome();
    const sliceH = Math.min(pageSlicePx, canvas.height - rendered);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH;
    slice.getContext("2d")!.drawImage(canvas, 0, rendered, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    const sliceHmm = sliceH / scalePxPerMm;
    pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN_X, HEADER_H, CONTENT_W, sliceHmm);
    rendered += sliceH;
  }

  // 4) Contracapa
  if (contracapaUrl) {
    try {
      const img = await loadImage(contracapaUrl);
      pdf.addPage();
      pdf.addImage(imgToJpeg(img), "JPEG", 0, 0, A4.w, A4.h); // estica p/ página inteira
    } catch {
      /* ignora */
    }
  }

  pdf.save(`${titulo}.pdf`);
}
