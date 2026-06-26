import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * Gera o PDF e baixa direto. Renderiza PÁGINA A PÁGINA: agrupa os blocos que
 * cabem em cada página e divide tabelas longas por linha — sem cortar texto.
 * Capa/contracapa em página inteira; logo + barras verde-musgo em cada página.
 */
const MOSS: [number, number, number] = [59, 74, 43];
const A4 = { w: 210, h: 297 };
const MARGIN_X = 18;
const HEADER_H = 16;
const FOOTER_H = 12;
const CONTENT_W = A4.w - MARGIN_X * 2;
const CONTENT_H = A4.h - HEADER_H - FOOTER_H;
const PX_PER_MM = 96 / 25.4;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
function imgToJpeg(img: HTMLImageElement): string {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  c.getContext("2d")!.drawImage(img, 0, 0);
  return c.toDataURL("image/jpeg", 0.95);
}

const HOLDER_CSS = `position:fixed;left:-99999px;top:0;width:WIDTHpx;background:#fff;`;
const DOC_STYLE = `
  .pdfdoc { font-family: Inter, 'DM Sans', sans-serif; color:#14201a; padding:2px; }
  .pdfdoc h2 { font-size:15px; margin:14px 0 6px; color:#14633e; }
  .pdfdoc h3 { font-size:13px; margin:10px 0 4px; }
  .pdfdoc p { font-size:11.5px; line-height:1.6; margin:6px 0; }
  .pdfdoc ul, .pdfdoc ol { font-size:11.5px; line-height:1.6; padding-left:18px; }
  .pdfdoc strong { font-weight:700; }`;

export async function exportReportPdf(opts: {
  titulo: string;
  clienteNome: string;
  contentHtml: string;
  summaryHtml?: string;
  capaUrl?: string | null;
  contracapaUrl?: string | null;
}) {
  const { titulo, clienteNome, contentHtml, summaryHtml, capaUrl, contracapaUrl } = opts;
  const widthPx = Math.round(CONTENT_W * PX_PER_MM);
  const maxHpx = CONTENT_H * PX_PER_MM;

  // container de medição
  const meas = document.createElement("div");
  meas.style.cssText = HOLDER_CSS.replace("WIDTH", String(widthPx));
  meas.innerHTML = `<style>${DOC_STYLE}</style><div class="pdfdoc">${summaryHtml ?? ""}${contentHtml}</div>`;
  document.body.appendChild(meas);
  await waitImages(meas);
  const doc = meas.querySelector(".pdfdoc") as HTMLElement;

  // 1) lista de "unidades de render" (elementos), dividindo tabelas longas por linha
  type Unit = { html: string; h: number };
  const units: Unit[] = [];
  for (const child of Array.from(doc.children)) {
    const el = child as HTMLElement;
    const h = el.getBoundingClientRect().height;
    if (el.tagName === "TABLE" && h > maxHpx) {
      const rows = Array.from(el.querySelectorAll("tr")) as HTMLElement[];
      const header = rows[0];
      const headerH = header.getBoundingClientRect().height;
      let group: HTMLElement[] = [];
      let gh = headerH;
      const flush = () => {
        if (!group.length) return;
        const t = el.cloneNode(false) as HTMLElement;
        t.appendChild(header.cloneNode(true));
        group.forEach((r) => t.appendChild(r.cloneNode(true)));
        units.push({ html: t.outerHTML, h: gh });
        group = [];
        gh = headerH;
      };
      rows.slice(1).forEach((r) => {
        const rh = r.getBoundingClientRect().height;
        if (gh + rh > maxHpx) flush();
        group.push(r);
        gh += rh;
      });
      flush();
    } else {
      units.push({ html: el.outerHTML, h });
    }
  }
  document.body.removeChild(meas);

  // 2) agrupa unidades em páginas que cabem
  const pages: string[][] = [];
  let cur: string[] = [];
  let curH = 0;
  for (const u of units) {
    if (curH > 0 && curH + u.h > maxHpx) {
      pages.push(cur);
      cur = [];
      curH = 0;
    }
    cur.push(u.html);
    curH += u.h;
  }
  if (cur.length) pages.push(cur);

  // 3) monta o PDF
  const pdf = new jsPDF("p", "mm", "a4");
  // capa
  if (capaUrl) {
    try { pdf.addImage(imgToJpeg(await loadImage(capaUrl)), "JPEG", 0, 0, A4.w, A4.h); }
    catch { coverFallback(pdf, titulo, clienteNome); }
  } else coverFallback(pdf, titulo, clienteNome);

  let logo: HTMLImageElement | null = null;
  try { logo = await loadImage(`${window.location.origin}/zephyr-logo-dark.png`); } catch {}
  const logoH = 6;
  const logoW = logo ? (logo.width / logo.height) * logoH : 0;
  const drawChrome = () => {
    pdf.setFillColor(...MOSS);
    pdf.rect(0, 0, A4.w, 2, "F");
    if (logo) pdf.addImage(logo, "PNG", MARGIN_X, 5, logoW, logoH);
    pdf.setFillColor(...MOSS);
    pdf.rect(0, A4.h - 2, A4.w, 2, "F");
  };

  for (const pageHtml of pages) {
    pdf.addPage();
    drawChrome();
    const cont = document.createElement("div");
    cont.style.cssText = HOLDER_CSS.replace("WIDTH", String(widthPx));
    cont.innerHTML = `<style>${DOC_STYLE}</style><div class="pdfdoc">${pageHtml.join("")}</div>`;
    document.body.appendChild(cont);
    await waitImages(cont);
    const c = await html2canvas(cont.querySelector(".pdfdoc") as HTMLElement, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    document.body.removeChild(cont);
    const hmm = (c.height / c.width) * CONTENT_W;
    pdf.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN_X, HEADER_H, CONTENT_W, Math.min(hmm, CONTENT_H));
  }

  // contracapa
  if (contracapaUrl) {
    try { pdf.addPage(); pdf.addImage(imgToJpeg(await loadImage(contracapaUrl)), "JPEG", 0, 0, A4.w, A4.h); } catch {}
  }

  pdf.save(`${titulo}.pdf`);
}

function coverFallback(pdf: jsPDF, titulo: string, nome: string) {
  pdf.setFillColor(14, 23, 20);
  pdf.rect(0, 0, A4.w, A4.h, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(22);
  pdf.text(titulo, A4.w / 2, A4.h / 2, { align: "center", maxWidth: A4.w - 40 });
  pdf.setFontSize(12);
  pdf.text(nome, A4.w / 2, A4.h / 2 + 16, { align: "center" });
}

function waitImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  return Promise.all(
    imgs.map((img) => (img.complete ? Promise.resolve() : new Promise<void>((r) => { img.onload = img.onerror = () => r(); })))
  ).then(() => undefined);
}
