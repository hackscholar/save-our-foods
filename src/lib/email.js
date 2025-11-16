import { Resend } from "resend";

const globalForResend = globalThis;

function ensureResendClient() {
  if (!globalForResend.__resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // Return null instead of throwing - we'll handle this in the send function
      return null;
    }
    globalForResend.__resendClient = new Resend(apiKey);
  }
  return globalForResend.__resendClient;
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
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

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

  const resendClient = ensureResendClient();
  if (!resendClient) {
    throw new Error("RESEND_API_KEY is not configured. Please set it in your environment variables.");
  }

  try {
    const { data, error } = await resendClient.emails.send({
      from: fromEmail,
      to: sellerEmail,
      subject,
      html: htmlContent,
      text: textContent,
    });

    if (error) {
      console.error("Failed to send email:", error);
      throw error;
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("Error sending purchase notification email:", error);
    throw error;
  }
}

