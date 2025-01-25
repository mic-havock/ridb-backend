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
  const mailOptions = {
    from: process.env.EMAIL_USER, // Sender address
    to: recipientEmail, // Recipient email address
    subject: subject,
    text: message, // Email text body
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email notification sent for campsite ${campsiteId}`);
  } catch (error) {
    console.error(
      `Error sending email for campsite ${campsiteId}:`,
      error.message
    );
  }
};

module.exports = { sendEmailNotification };
