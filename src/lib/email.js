import nodemailer from "nodemailer";

const globalForSmtp = globalThis;

function getBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
  }
  return false;
}

function ensureSmtpTransport() {
  if (globalForSmtp.__saveMyFoodsTransport) {
    return globalForSmtp.__saveMyFoodsTransport;
  }

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure =
    process.env.SMTP_SECURE !== undefined ? getBoolean(process.env.SMTP_SECURE) : port === 465;
  const user =
    process.env.SMTP_USER ||
    process.env.SMTP_USERNAME ||
    process.env.SMTP_EMAIL ||
    process.env.SMTP_LOGIN;
  const pass =
    process.env.SMTP_PASSWORD ||
    process.env.SMTP_PASS ||
    process.env.SMTP_APP_PASSWORD ||
    process.env.SMTP_SECRET;

  if (!user || !pass) {
    return null;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  globalForSmtp.__saveMyFoodsTransport = {
    transporter,
    fromAddress: process.env.SMTP_FROM_EMAIL || user,
  };

  return globalForSmtp.__saveMyFoodsTransport;
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
  const client = ensureSmtpTransport();
  if (!client) {
    throw new Error(
      "SMTP credentials are not configured. Please set SMTP_USER and SMTP_PASSWORD (or related variables).",
    );
  }

  const fromName = process.env.SMTP_FROM_NAME || "SaveMyFoods";
  const fromEmail = client.fromAddress;
  const replyTo = buyerEmail || undefined;
  const subject = `Purchase request for ${itemName}`;

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

  try {
    const formattedFrom =
      typeof fromEmail === "string" && fromEmail.includes("<")
        ? fromEmail
        : `${fromName} <${fromEmail}>`;
    const info = await client.transporter.sendMail({
      from: formattedFrom,
      to: sellerEmail,
      subject,
      html: htmlContent,
      text: textContent,
      replyTo,
    });
    return { success: true, messageId: info?.messageId ?? null };
  } catch (error) {
    console.error("Error sending purchase notification email:", error);
    throw error;
  }
}

