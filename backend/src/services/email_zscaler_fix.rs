use crate::config::SmtpConfig;
use anyhow::Result;
use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::client::{Tls, TlsParameters};
use lettre::{Message, SmtpTransport, Transport};
use tracing::{error, info, warn};

pub struct EmailService {
    config: SmtpConfig,
    transport: SmtpTransport,
}

impl EmailService {
    pub fn new(config: SmtpConfig) -> Result<Self> {
        let credentials = Credentials::new(config.username.clone(), config.password.clone());
        
        info!("Setting up SMTP transport for {}:{}", config.host, config.port);
        
        // Check if we should skip TLS verification (for corporate networks)
        let skip_tls_verify = std::env::var("SMTP_SKIP_TLS_VERIFY").unwrap_or_default() == "true";
        let dangerous_tls = std::env::var("SMTP_DANGEROUS_TLS").unwrap_or_default() == "true";
        
        if skip_tls_verify || dangerous_tls {
            warn!("⚠️  TLS verification is disabled - only use this for development/corporate networks");
        }
        
        let transport = match (config.use_ssl, config.port) {
            // Port 465 - Implicit TLS (SMTPS)
            (true, 465) => {
                info!("Using implicit TLS for port 465");
                if dangerous_tls {
                    // For corporate networks that intercept TLS (like ZScaler)
                    let tls_parameters = TlsParameters::builder(config.host.clone())
                        .dangerous_accept_invalid_certs(true)
                        .dangerous_accept_invalid_hostnames(true)
                        .build()?;
                        
                    SmtpTransport::relay(&config.host)?
                        .credentials(credentials)
                        .port(config.port)
                        .tls(Tls::Wrapper(tls_parameters))
                        .timeout(Some(std::time::Duration::from_secs(30)))
                        .build()
                } else {
                    let tls_parameters = TlsParameters::builder(config.host.clone())
                        .dangerous_accept_invalid_certs(false)
                        .dangerous_accept_invalid_hostnames(false)
                        .build()?;
                        
                    SmtpTransport::relay(&config.host)?
                        .credentials(credentials)
                        .port(config.port)
                        .tls(Tls::Wrapper(tls_parameters))
                        .timeout(Some(std::time::Duration::from_secs(30)))
                        .build()
                }
            }
            
            // Port 587 or others with SSL - STARTTLS
            (true, _) => {
                info!("Using STARTTLS for port {}", config.port);
                if dangerous_tls {
                    // For corporate networks - create transport with relaxed TLS
                    let tls_parameters = TlsParameters::builder(config.host.clone())
                        .dangerous_accept_invalid_certs(true)
                        .dangerous_accept_invalid_hostnames(true)
                        .build()?;
                        
                    SmtpTransport::relay(&config.host)?
                        .credentials(credentials)
                        .port(config.port)
                        .tls(Tls::Required(tls_parameters))
                        .timeout(Some(std::time::Duration::from_secs(30)))
                        .build()
                } else {
                    SmtpTransport::starttls_relay(&config.host)?
                        .credentials(credentials)
                        .port(config.port)
                        .timeout(Some(std::time::Duration::from_secs(30)))
                        .build()
                }
            }
            
            // No SSL - Plain connection (not recommended)
            (false, _) => {
                warn!("Using unencrypted SMTP connection - not recommended for production");
                SmtpTransport::builder_dangerous(&config.host)
                    .credentials(credentials)
                    .port(config.port)
                    .timeout(Some(std::time::Duration::from_secs(30)))
                    .build()
            }
        };

        info!("SMTP transport configured successfully");
        Ok(EmailService { config, transport })
    }

    pub async fn send_verification_code(&self, email: &str, code: &str) -> Result<()> {
        info!("Sending verification code to {}", email);
        
        // Check if we should skip email sending for development
        if std::env::var("SKIP_EMAIL_SENDING").unwrap_or_default() == "true" {
            warn!("📧 DEVELOPMENT MODE: Skipping actual email sending");
            warn!("📧 Verification code for {}: {}", email, code);
            warn!("📧 Use this code to verify your account");
            return Ok(());
        }
        
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
                    
                    <p style="font-size: 12px; color: #999; margin-top: 20px;">
                        If you're having trouble, try entering the code: <strong>{}</strong>
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
            code, code
        );

        let email_message = Message::builder()
            .from(self.config.from_email.parse()?)
            .to(email.parse()?)
            .subject(subject)
            .header(ContentType::TEXT_HTML)
            .body(body)?;

        match self.transport.send(&email_message) {
            Ok(response) => {
                info!("✅ Verification email sent successfully to {} (Response: {:?})", email, response);
                Ok(())
            }
            Err(e) => {
                error!("❌ Failed to send verification email to {}: {}", email, e);
                error!("SMTP Error details: {:?}", e);
                
                // Provide more helpful error messages for common corporate network issues
                let error_msg = match e.to_string().as_str() {
                    s if s.contains("certificate") || s.contains("CN name") => {
                        "TLS certificate error - corporate firewall (ZScaler) is intercepting connections. Try setting SMTP_DANGEROUS_TLS=true"
                    },
                    s if s.contains("timeout") => {
                        "Connection timeout - corporate firewall may be blocking SMTP"
                    },
                    s if s.contains("authentication") => {
                        "SMTP authentication failed - check username/password"
                    },
                    s if s.contains("connection refused") => {
                        "Connection refused - check SMTP host and port"
                    },
                    _ => "Email sending failed"
                };
                
                warn!("💡 Suggested fix: Add SMTP_DANGEROUS_TLS=true to your .env file for corporate networks");
                Err(anyhow::anyhow!("{}: {}", error_msg, e))
            }
        }
    }

    pub async fn send_welcome_email(&self, email: &str, name: &str) -> Result<()> {
        info!("Sending welcome email to {}", email);
        
        // Skip if email sending is disabled
        if std::env::var("SKIP_EMAIL_SENDING").unwrap_or_default() == "true" {
            warn!("📧 DEVELOPMENT MODE: Skipping welcome email to {}", email);
            return Ok(());
        }
        
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
            Ok(response) => {
                info!("✅ Welcome email sent successfully to {} (Response: {:?})", email, response);
                Ok(())
            }
            Err(e) => {
                error!("❌ Failed to send welcome email to {}: {}", email, e);
                // Don't fail the registration process if welcome email fails
                warn!("Welcome email failed but user registration will continue");
                Ok(())
            }
        }
    }

    /// Test the email configuration
    pub async fn test_connection(&self) -> Result<()> {
        info!("🧪 Testing SMTP connection...");
        
        if std::env::var("SKIP_EMAIL_SENDING").unwrap_or_default() == "true" {
            warn!("📧 DEVELOPMENT MODE: Email sending is disabled");
            return Ok(());
        }
        
        // Try to send a simple test email to the from address
        let test_email = Message::builder()
            .from(self.config.from_email.parse()?)
            .to(self.config.from_email.parse()?)
            .subject("VOTP SMTP Test")
            .body("This is a test email to verify SMTP configuration.".to_string())?;

        match self.transport.send(&test_email) {
            Ok(_) => {
                info!("✅ SMTP connection test successful");
                Ok(())
            }
            Err(e) => {
                error!("❌ SMTP connection test failed: {}", e);
                Err(anyhow::anyhow!("SMTP test failed: {}", e))
            }
        }
    }
}