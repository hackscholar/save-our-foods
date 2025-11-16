import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function generateCartInvoice({ buyerName, buyerEmail, items }) {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
  const { width } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 780;
  const drawText = (text, x, options = {}) => {
    const {
      size = 12,
      font: fontResource = font,
      color = rgb(0, 0, 0),
      align = "left",
      maxWidth = width - 100,
    } = options;

    let textX = x;
    if (align === "center") {
      const textWidth = fontResource.widthOfTextAtSize(text, size);
      textX = x - textWidth / 2;
    } else if (align === "right") {
      const textWidth = fontResource.widthOfTextAtSize(text, size);
      textX = x - textWidth;
    }

    page.drawText(text, { x: textX, y, size, font: fontResource, color, maxWidth });
    return size;
  };

  drawText("SaveOurFoods Purchase Summary", width / 2, {
    size: 22,
    font: boldFont,
    align: "center",
  });
  y -= 40;
  drawText(`Buyer: ${buyerName ?? "Unknown"}`, 50);
  y -= 18;
  drawText(`Email: ${buyerEmail ?? "Unknown"}`, 50);
  y -= 30;

  drawSectionHeader(page, y);
  y -= 25;

  let total = 0;
  items.forEach((item) => {
    const quantity = Number(item.quantity ?? 1);
    const price = Number(item.price ?? 0);
    total += quantity * price;
    drawRow(page, { name: item.name ?? "Unnamed item", quantity, price }, y, font);
    y -= 20;
    if (y < 80) {
      const newPage = pdfDoc.addPage([595.28, 841.89]);
      y = 780;
      page = newPage;
      drawSectionHeader(page, y);
      y -= 25;
    }
  });

  y -= 20;
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
  y -= 18;
  drawText(`Total: $${total.toFixed(2)}`, width - 60, {
    size: 14,
    font: boldFont,
    align: "right",
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function drawSectionHeader(page, y) {
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
  y -= 12;
  page.drawText("Item", { x: 50, y, size: 12 });
  page.drawText("Qty", { x: 340, y, size: 12 });
  page.drawText("Price", { x: 470, y, size: 12 });
  y -= 10;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
}

function drawRow(page, item, y, font) {
  page.drawText(item.name, {
    x: 50,
    y,
    size: 11,
    font,
  });
  page.drawText(String(item.quantity), {
    x: 350,
    y,
    size: 11,
    font,
  });
  page.drawText(`$${Number(item.price).toFixed(2)}`, {
    x: 470,
    y,
    size: 11,
    font,
  });
}
