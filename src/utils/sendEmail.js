const resend = require("../config/mail");

const sendEmail = async (to, link, type = "reset") => {
  const emailConfigs = {
    verification: {
      subject: "Verify Your Account - Chem Tech Company",
      title: "Verify Your Email",
      message:
        "Welcome to Chem Tech Company! Please verify your email address to activate your account and get started.",
      buttonText: "Verify Email",
      footerNote:
        "If you did not create an account, you can safely ignore this email.",
    },
    reset: {
      subject: "Reset Your Password - Chem Tech Company",
      title: "Reset Your Password",
      message:
        "We received a request to reset your password. Click the button below to create a new password. This link will expire in 15 minutes.",
      buttonText: "Reset Password",
      footerNote:
        "If you did not request a password reset, please ignore this email. Your password will remain unchanged.",
    },
  };

  const config = emailConfigs[type];

  try {
    console.log("========== EMAIL DEBUG ==========");
    console.log("TO:", to);
    console.log("TYPE:", type);
    console.log("EMAIL_FROM:", process.env.EMAIL_FROM);
    console.log(
      "RESEND_API_KEY EXISTS:",
      !!process.env.RESEND_API_KEY
    );
    console.log("LINK:", link);

    const result = await resend.emails.send({
      from: `Chem Tech Company <${process.env.EMAIL_FROM}>`,
      to: [to],
      subject: config.subject,
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center">
              <table width="600" cellpadding="20" cellspacing="0" style="background:#fff;border-radius:10px;">
                <tr>
                  <td align="center">
                    <h1>Chem Tech Company</h1>
                    <h2>${config.title}</h2>

                    <p>${config.message}</p>

                    <p>
                      <a href="${link}"
                         style="
                           background:#2563eb;
                           color:#fff;
                           padding:12px 24px;
                           text-decoration:none;
                           border-radius:6px;
                           display:inline-block;
                         ">
                        ${config.buttonText}
                      </a>
                    </p>

                    <p>
                      Or open this link:
                    </p>

                    <p>
                      <a href="${link}">
                        ${link}
                      </a>
                    </p>

                    <hr>

                    <p>
                      ${config.footerNote}
                    </p>

                    <p>
                      © ${new Date().getFullYear()} Chem Tech Company
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
      `,
    });

    console.log("RESEND SUCCESS:");
    console.log(JSON.stringify(result, null, 2));
    console.log("================================");

    return result;
  } catch (error) {
    console.error("RESEND ERROR:");
    console.error(error);

    if (error.response) {
      console.error("ERROR RESPONSE:");
      console.error(JSON.stringify(error.response, null, 2));
    }

    console.error("================================");

    throw error;
  }
};

module.exports = sendEmail;
