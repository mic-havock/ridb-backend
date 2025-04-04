const nodemailer = require("nodemailer");
require("dotenv").config(); // Load environment variables

// Create a transporter for sending emails
const transporter = nodemailer.createTransport({
  service: "gmail", // Or your email provider (e.g., Yahoo, Outlook)
  auth: {
    user: process.env.EMAIL_USER, // Your email address
    pass: process.env.EMAIL_PASS, // Your email password or app-specific password
  },
});

// Function to send an email notification
const sendEmailNotification = async (
  campsiteId,
  subject,
  message,
  recipientEmail
) => {
  // Determine if message is a string or an object with text/html
  const isMessageObject = typeof message === "object" && message !== null;

  const mailOptions = {
    from: process.env.EMAIL_USER, // Sender address
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
