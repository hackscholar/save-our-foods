import nodemailer from "nodemailer";

const globalForEmail = globalThis;

async function ensureSmtpTransporter() {
  if (globalForEmail.__smtpTransporter) {
    return globalForEmail.__smtpTransporter;
  }

  const {
    SMTP_HOST = "smtp.gmail.com",
    SMTP_PORT = "587",
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
  } = process.env;

  // If no SMTP creds provided, create an Ethereal test account for local testing
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn(
      "SMTP_USER or SMTP_PASS not set — using Ethereal test account for local email testing.",
    );
    const testAccount = await nodemailer.createTestAccount();
    globalForEmail.__smtpTransporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    globalForEmail.__etherealTestAccount = testAccount;
    return globalForEmail.__smtpTransporter;
  }

  const port = Number(SMTP_PORT) || 587;
  const secure =
    typeof SMTP_SECURE === "string" ? SMTP_SECURE.toLowerCase() === "true" : port === 465;

  globalForEmail.__smtpTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return globalForEmail.__smtpTransporter;
}

async function sendEmail({ to, subject, html, text, replyTo }) {
  const transporter = await ensureSmtpTransporter();

  const fromAddress =
    process.env.SMTP_FROM_EMAIL ||
    (process.env.SMTP_USER ? `SaveMyFoods <${process.env.SMTP_USER}>` : "SaveMyFoods <no-reply@savemyfoods.local>");

  try {
    const response = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
      text,
      replyTo: replyTo || undefined,
    });

    const previewUrl = nodemailer.getTestMessageUrl(response);
    if (previewUrl) {
      console.info("Email preview URL (Ethereal):", previewUrl);
    }

    return { success: true, messageId: response?.messageId, previewUrl };
  } catch (error) {
    console.error("Error sending email via SMTP:", error);
    throw error;
  }
}

export async function sendPurchaseNotificationEmail({
  sellerEmail,
  sellerName,
  buyerName,
  buyerEmail,
  itemName,
  itemPrice,
  itemQuantity,
}) {
  if (!sellerEmail) {
    throw new Error("Seller email is required");
  }

  const subject = `New Purchase Request: ${itemName}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Purchase Request</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: #2c3e50; margin-top: 0;">New Purchase Request</h1>
        </div>
        
        <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e3ded2; border-radius: 8px;">
          <p>Hello ${sellerName || "Seller"},</p>
          
          <p>You have received a new purchase request for your item:</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #2c3e50;">${itemName}</h2>
            ${itemPrice ? `<p style="margin: 5px 0;"><strong>Price:</strong> $${Number(itemPrice).toFixed(2)}</p>` : ""}
            ${itemQuantity ? `<p style="margin: 5px 0;"><strong>Quantity:</strong> ${itemQuantity}</p>` : ""}
          </div>
          
          <div style="background-color: #e8f4f8; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2c3e50;">Buyer Information:</h3>
            <p style="margin: 5px 0;"><strong>Name:</strong> ${buyerName || "Not provided"}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${buyerEmail || "Not provided"}</p>
          </div>
          
          <p>Please contact the buyer to arrange the purchase details.</p>
          
          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            Best regards,<br>
            Save My Foods Team
          </p>
        </div>
      </body>
    </html>
  `;

  const textContent = `
New Purchase Request

Hello ${sellerName || "Seller"},

You have received a new purchase request for your item:

Item: ${itemName}
${itemPrice ? `Price: $${Number(itemPrice).toFixed(2)}` : ""}
${itemQuantity ? `Quantity: ${itemQuantity}` : ""}

Buyer Information:
Name: ${buyerName || "Not provided"}
Email: ${buyerEmail || "Not provided"}

Please contact the buyer to arrange the purchase details.

Best regards,
Save My Foods Team
  `.trim();

  return sendEmail({
    to: sellerEmail,
    subject,
    html: htmlContent,
    text: textContent,
    replyTo: buyerEmail,
  });
}

export async function sendCartInvoiceEmail({ buyerEmail, buyerName, items }) {
  if (!buyerEmail) {
    throw new Error("Buyer email is required to send invoice.");
  }

  const total = items.reduce(
    (sum, item) => sum + Number(item.price ?? 0) * Number(item.quantity ?? 1),
    0,
  );

  const rowsHtml = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.name}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${
            item.quantity ?? 1
          }</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">$${
            Number(item.price ?? 0).toFixed(2)
          }</td>
        </tr>
      `,
    )
    .join("");

  const htmlContent = `
    <h1 style="font-family: Arial, sans-serif;">Your SaveMyFoods Purchase</h1>
    <p>Hello ${buyerName || "there"},</p>
    <p>Here is a summary of your cart:</p>
    <table style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">
      <thead>
        <tr>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Item</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb;">Qty</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">Price</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;"><strong>Total</strong></td>
          <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;"><strong>$${total.toFixed(
            2,
          )}</strong></td>
        </tr>
      </tfoot>
    </table>
    <p>Thank you for supporting your community!</p>
  `;

  const textContent = [
    "Your SaveMyFoods Purchase",
    "",
    ...items.map(
      (item) =>
        `${item.name} - Qty: ${item.quantity ?? 1} - $${Number(item.price ?? 0).toFixed(2)}`,
    ),
    "",
    `Total: $${total.toFixed(2)}`,
  ].join("\n");

  return sendEmail({
    to: buyerEmail,
    subject: "Your SaveMyFoods cart summary",
    html: htmlContent,
    text: textContent,
  });
}

