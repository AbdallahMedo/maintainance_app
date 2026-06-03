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

  await resend.emails.send({
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
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;">
                
                <tr>
                  <td style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: white; margin: 20px 0 10px 0; font-size: 28px; font-weight: 700;">
                      Chem Tech Company
                    </h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 14px;">
                      Innovation in Chemical Solutions
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 50px 40px;">
                    <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">
                      ${config.title}
                    </h2>

                    <p style="color: #475569; margin: 0 0 30px 0; font-size: 16px; line-height: 1.6;">
                      ${config.message}
                    </p>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 10px 0 30px 0;">
                          <a href="${link}"
                             style="
                               display: inline-block;
                               padding: 16px 40px;
                               background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
                               color: white;
                               text-decoration: none;
                               border-radius: 8px;
                               font-weight: 600;
                               font-size: 16px;
                             ">
                             ${config.buttonText}
                          </a>
                        </td>
                      </tr>
                    </table>

                    <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin-top: 20px;">
                      <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b;">
                        Or copy and paste this link in your browser:
                      </p>
                      <p style="margin: 0; word-break: break-all; font-size: 13px;">
                        <a href="${link}" style="color: #2563eb;">
                          ${link}
                        </a>
                      </p>
                    </div>

                    <p style="margin: 30px 0 0 0; font-size: 14px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                      <strong>Note:</strong> ${config.footerNote}
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="background-color: #f8fafc; padding: 30px 40px; text-align: center;">
                    <p style="margin: 0 0 10px 0; color: #475569; font-size: 14px;">
                      © ${new Date().getFullYear()} Chem Tech Company. All rights reserved.
                    </p>
                    <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                      This is an automated message, please do not reply to this email.
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
};

module.exports = sendEmail;
