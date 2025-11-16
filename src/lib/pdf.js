export async function generateCartInvoice({ buyerName, buyerEmail, items }) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const safeBuyerName = buyerName || "Unknown Buyer";
  const safeBuyerEmail = buyerEmail || "Unknown Email";

  let total = 0;
  const rows = normalizedItems.map((item, index) => {
    const quantity = Number(item?.quantity ?? 1);
    const price = Number(item?.price ?? 0);
    const subtotal = quantity * price;
    total += subtotal;
    return {
      text: `${index + 1}. ${item?.name ?? "Unnamed Item"}  |  Qty: ${quantity}  |  Unit: $${price.toFixed(
        2,
      )}  |  Subtotal: $${subtotal.toFixed(2)}`,
      size: 12,
    };
  });

  const timestamp = new Date().toISOString();

  const entries = [
    { text: "SaveMyFoods Purchase Summary", size: 20, leading: 30 },
    { text: `Buyer: ${safeBuyerName}`, size: 12 },
    { text: `Email: ${safeBuyerEmail}`, size: 12, leading: 20 },
    { text: "Items", size: 14, leading: 26 },
    ...(rows.length > 0
      ? rows
      : [{ text: "No items supplied for this invoice.", size: 12 }]),
    { text: `Total: $${total.toFixed(2)}`, size: 14, leading: 30 },
    { text: `Generated on ${timestamp}`, size: 10 },
  ];

  const pdfBuffer = buildSimplePdf(entries);
  return pdfBuffer;
}

function buildSimplePdf(entries) {
  const pageHeight = 841.89;
  const startY = pageHeight - 60; // leave a margin
  const minY = 60;

  const pageContents = [];
  let currentPageOps = [];
  let currentY = startY;

  const flushPage = () => {
    if (currentPageOps.length === 0) {
      return;
    }
    pageContents.push(["BT", ...currentPageOps, "ET"].join("\n"));
    currentPageOps = [];
    currentY = startY;
  };

  entries.forEach((entry) => {
    const leading = entry.leading ?? 18;
    if (currentY < minY) {
      flushPage();
    }
    currentPageOps.push(`/F1 ${entry.size ?? 12} Tf`);
    currentPageOps.push(`1 0 0 1 50 ${currentY.toFixed(2)} Tm`);
    currentPageOps.push(`(${escapePdfText(entry.text ?? "")}) Tj`);
    currentY -= leading;
  });

  flushPage();

  if (pageContents.length === 0) {
    pageContents.push("BT /F1 12 Tf 1 0 0 1 50 780 Tm (Invoice could not be generated.) Tj ET");
  }

  const objects = [];
  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  const firstPageObjId = 4;

  const pageObjectIds = pageContents.map((_, index) => firstPageObjId + index * 2);
  const contentObjectIds = pageObjectIds.map((pageId) => pageId + 1);

  objects.push({ id: catalogId, body: `<< /Type /Catalog /Pages ${pagesId} 0 R >>` });
  objects.push({
    id: pagesId,
    body: `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageContents.length} >>`,
  });
  objects.push({
    id: fontId,
    body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  });

  pageContents.forEach((content, index) => {
    const pageId = pageObjectIds[index];
    const contentId = contentObjectIds[index];
    objects.push({
      id: pageId,
      body: `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595.28 ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    });

    const contentLength = Buffer.byteLength(content, "utf8");
    objects.push({
      id: contentId,
      body: `<< /Length ${contentLength} >>\nstream\n${content}\nendstream`,
    });
  });

  const maxId = contentObjectIds.at(-1) ?? fontId;
  const xref = new Array(maxId + 1).fill(0);
  let offset = 0;
  const chunks = [];

  const pushChunk = (chunk) => {
    chunks.push(chunk);
    offset += Buffer.byteLength(chunk, "utf8");
  };

  pushChunk("%PDF-1.4\n");

  objects
    .sort((a, b) => a.id - b.id)
    .forEach((obj) => {
      xref[obj.id] = offset;
      pushChunk(`${obj.id} 0 obj\n${obj.body}\nendobj\n`);
    });

  const xrefStart = offset;
  let xrefContent = `xref\n0 ${xref.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < xref.length; i += 1) {
    xrefContent += `${String(xref[i]).padStart(10, "0")} 00000 n \n`;
  }
  xrefContent += `trailer\n<< /Size ${xref.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  pushChunk(xrefContent);

  return Buffer.from(chunks.join(""), "utf8");
}

function escapePdfText(input) {
  return String(input ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}
