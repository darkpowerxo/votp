use crate::config::SmtpConfig;
use anyhow::Result;
use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};
use tracing::{error, info};

pub struct EmailService {
    config: SmtpConfig,
    transport: SmtpTransport,
}

impl EmailService {
    pub fn new(config: SmtpConfig) -> Result<Self> {
        let credentials = Credentials::new(config.username.clone(), config.password.clone());
        
        let transport = if config.use_ssl {
            SmtpTransport::relay(&config.host)?
                .credentials(credentials)
                .port(config.port)
                .build()
        } else {
            SmtpTransport::builder_dangerous(&config.host)
                .credentials(credentials)
                .port(config.port)
                .build()
        };

        Ok(EmailService { config, transport })
    }

    pub async fn send_verification_code(&self, email: &str, code: &str) -> Result<()> {
        let subject = "VOTP - Verify Your Email";
        let body = format!(
            r#"
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #333; margin-bottom: 10px;">Voice of the People</h1>
                    <h2 style="color: #666; font-weight: normal;">Email Verification</h2>
                </div>
                
                <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px; text-align: center;">
                    <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                        Please use the following verification code to complete your registration:
                    </p>
                    
                    <div style="background-color: #007bff; color: white; font-size: 24px; font-weight: bold; padding: 15px 30px; border-radius: 6px; letter-spacing: 3px; margin: 20px 0;">
                        {}
                    </div>
                    
                    <p style="font-size: 14px; color: #666; margin-top: 20px;">
                        This code will expire in 10 minutes for security purposes.
                    </p>
                </div>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                    <p style="font-size: 12px; color: #999;">
                        If you didn't request this verification code, please ignore this email.
                    </p>
                </div>
            </body>
            </html>
            "#,
            code
        );

        let email_message = Message::builder()
            .from(self.config.from_email.parse()?)
            .to(email.parse()?)
            .subject(subject)
            .header(ContentType::TEXT_HTML)
            .body(body)?;

        match self.transport.send(&email_message) {
            Ok(_) => {
                info!("Verification email sent successfully to {}", email);
                Ok(())
            }
            Err(e) => {
                error!("Failed to send verification email to {}: {}", email, e);
                Err(anyhow::anyhow!("Failed to send email: {}", e))
            }
        }
    }

    pub async fn send_welcome_email(&self, email: &str, name: &str) -> Result<()> {
        let subject = "Welcome to VOTP - Voice of the People!";
        let body = format!(
            r#"
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #333; margin-bottom: 10px;">Welcome to Voice of the People!</h1>
                </div>
                
                <div style="padding: 20px;">
                    <p style="font-size: 16px; color: #333;">Hi {},</p>
                    
                    <p style="font-size: 16px; color: #333; line-height: 1.6;">
                        Thank you for joining Voice of the People! Your account has been successfully created 
                        and verified. You can now start sharing your thoughts and engaging with comments on 
                        any website across the internet.
                    </p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">Getting Started:</h3>
                        <ul style="color: #666; line-height: 1.8;">
                            <li>Install our Chrome extension to start commenting on any website</li>
                            <li>Click the extension icon to open the comment sidebar</li>
                            <li>Join conversations and share your voice with the community</li>
                        </ul>
                    </div>
                    
                    <p style="font-size: 16px; color: #333; line-height: 1.6;">
                        We're excited to have you as part of our community where every voice matters!
                    </p>
                </div>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                    <p style="font-size: 12px; color: #999;">
                        This is an automated message from Voice of the People.
                    </p>
                </div>
            </body>
            </html>
            "#,
            name
        );

        let email_message = Message::builder()
            .from(self.config.from_email.parse()?)
            .to(email.parse()?)
            .subject(subject)
            .header(ContentType::TEXT_HTML)
            .body(body)?;

        match self.transport.send(&email_message) {
            Ok(_) => {
                info!("Welcome email sent successfully to {}", email);
                Ok(())
            }
            Err(e) => {
                error!("Failed to send welcome email to {}: {}", email, e);
                Err(anyhow::anyhow!("Failed to send email: {}", e))
            }
        }
    }
}