const nodemailer = require("nodemailer");
require("dotenv").config(); // Load environment variables

// ZeptoMail: SMTP auth user is "emailapikey"; recipients must see your verified domain address.
const emailFromAddress = process.env.EMAIL_FROM;
const emailFromName = process.env.EMAIL_NAME || "Kamp Scout";
const emailFrom =
  emailFromAddress && `"${emailFromName}" <${emailFromAddress}>`;

// ZeptoMail SMTP (auth user is always "emailapikey"; From must be a verified sender)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 465,
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Function to send an email notification
const sendEmailNotification = async (
  campsiteId,
  subject,
  message,
  recipientEmail
) => {
  if (!emailFrom) {
    console.log("Failed to send email notification: EMAIL_FROM is not set", {
      campsiteId,
      recipient: recipientEmail,
      subject,
    });
    return;
  }

  // Determine if message is a string or an object with text/html
  const isMessageObject = typeof message === "object" && message !== null;

  const mailOptions = {
    from: emailFrom,
    to: recipientEmail, // Recipient email address
    subject: subject,
    text: isMessageObject ? message.text : message, // Plain text version
    html: isMessageObject ? message.html : message, // HTML version
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email notification sent successfully`, {
      campsiteId,
      recipient: recipientEmail,
      subject,
    });
  } catch (error) {
    console.log(`Failed to send email notification`, {
      error: error.message,
      campsiteId,
      recipient: recipientEmail,
      subject,
    });
  }
};

module.exports = { sendEmailNotification };
