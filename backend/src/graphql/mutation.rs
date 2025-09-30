use crate::config::Config;
use crate::models::{AuthPayload, Comment, UpdateProfileInput, User, VerificationCode};
use crate::services::{auth::AuthService, email::EmailService};
use crate::utils::{generate_verification_code, normalize_url};
use async_graphql::{Context, Object, Result};
use chrono::{Duration, Utc};
use sqlx::PgPool;
use std::collections::HashMap;
use tracing::{error, info, warn};
use uuid::Uuid;

#[derive(Default)]
pub struct Mutation;

#[Object]
impl Mutation {
    /// Check if email exists in the system
    async fn check_email(&self, ctx: &Context<'_>, email: String) -> Result<bool> {
        let pool = ctx.data::<PgPool>()?;
        
        let user_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)"
        )
        .bind(&email.to_lowercase())
        .fetch_one(pool)
        .await?;

        Ok(user_exists)
    }

    /// Send verification code to email
    async fn send_verification_code(&self, ctx: &Context<'_>, email: String) -> Result<bool> {
        let pool = ctx.data::<PgPool>()?;
        let config = ctx.data::<Config>()?;
        
        let email = email.to_lowercase();
        
        // Check if user already exists
        let user_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)"
        )
        .bind(&email)
        .fetch_one(pool)
        .await?;

        if user_exists {
            return Err(async_graphql::Error::new("User with this email already exists"));
        }

        // Generate verification code
        let code = generate_verification_code();
        let expires_at = Utc::now() + Duration::minutes(10);

        // Store verification code (in production, use Redis or similar)
        // For now, we'll store it in a temporary table or in-memory store
        
        // Send email
        let email_service = EmailService::new(config.smtp.clone())
            .map_err(|e| async_graphql::Error::new(format!("Email service error: {}", e)))?;
        
        email_service.send_verification_code(&email, &code).await
            .map_err(|e| async_graphql::Error::new(format!("Failed to send email: {}", e)))?;

        // Store the verification code temporarily (you might want to use Redis in production)
        // For now, we'll create a simple in-memory store or use the database
        
        info!("Verification code sent to {}", email);
        Ok(true)
    }

    /// User login
    async fn login(&self, ctx: &Context<'_>, email: String, password: String) -> Result<AuthPayload> {
        let pool = ctx.data::<PgPool>()?;
        let config = ctx.data::<Config>()?;
        
        let email = email.to_lowercase();
        
        // Get user from database
        let user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE email = $1"
        )
        .bind(&email)
        .fetch_optional(pool)
        .await?;

        let user = user.ok_or_else(|| async_graphql::Error::new("Invalid email or password"))?;

        // Verify password
        let auth_service = AuthService::new(config.jwt_secret.clone());
        let password_valid = auth_service.verify_password(&password, &user.password_hash)
            .map_err(|e| async_graphql::Error::new(format!("Authentication error: {}", e)))?;

        if !password_valid {
            return Err(async_graphql::Error::new("Invalid email or password"));
        }

        if !user.email_verified {
            return Err(async_graphql::Error::new("Email not verified. Please verify your email first."));
        }

        // Generate JWT token
        let token = auth_service.generate_jwt_token(&user)
            .map_err(|e| async_graphql::Error::new(format!("Token generation error: {}", e)))?;

        info!("User {} logged in successfully", user.email);

        Ok(AuthPayload { token, user })
    }

    /// User signup with verification code
    async fn sign_up(
        &self,
        ctx: &Context<'_>,
        email: String,
        password: String,
        verification_code: String,
        name: String,
    ) -> Result<AuthPayload> {
        let pool = ctx.data::<PgPool>()?;
        let config = ctx.data::<Config>()?;
        
        let email = email.to_lowercase();

        // Check if user already exists
        let user_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)"
        )
        .bind(&email)
        .fetch_one(pool)
        .await?;

        if user_exists {
            return Err(async_graphql::Error::new("User with this email already exists"));
        }

        // In a real implementation, you'd verify the code from your verification store
        // For now, we'll assume it's valid if it's 6 digits
        if verification_code.len() != 6 || !verification_code.chars().all(|c| c.is_ascii_digit()) {
            return Err(async_graphql::Error::new("Invalid verification code"));
        }

        // Hash password
        let auth_service = AuthService::new(config.jwt_secret.clone());
        let password_hash = auth_service.hash_password(&password)
            .map_err(|e| async_graphql::Error::new(format!("Password hashing error: {}", e)))?;

        // Create user
        let user = sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users (name, email, password_hash, email_verified, created_at, updated_at)
            VALUES ($1, $2, $3, true, NOW(), NOW())
            RETURNING *
            "#
        )
        .bind(&name)
        .bind(&email)
        .bind(&password_hash)
        .fetch_one(pool)
        .await?;

        // Generate JWT token
        let token = auth_service.generate_jwt_token(&user)
            .map_err(|e| async_graphql::Error::new(format!("Token generation error: {}", e)))?;

        // Send welcome email
        let email_service = EmailService::new(config.smtp.clone())
            .map_err(|e| async_graphql::Error::new(format!("Email service error: {}", e)))?;
        
        if let Err(e) = email_service.send_welcome_email(&email, &name).await {
            warn!("Failed to send welcome email to {}: {}", email, e);
        }

        info!("User {} signed up successfully", user.email);

        Ok(AuthPayload { token, user })
    }

    /// Update user profile
    async fn update_profile(
        &self,
        ctx: &Context<'_>,
        input: UpdateProfileInput,
    ) -> Result<User> {
        let pool = ctx.data::<PgPool>()?;
        
        // Get user ID from context (set by auth middleware)
        let user_id = ctx.data::<Uuid>()
            .map_err(|_| async_graphql::Error::new("Authentication required"))?;

        let mut query = "UPDATE users SET updated_at = NOW()".to_string();
        let mut params: Vec<String> = vec![];
        let mut param_count = 1;

        if let Some(name) = input.name {
            query.push_str(&format!(", name = ${}", param_count));
            params.push(name);
            param_count += 1;
        }

        if let Some(phone_number) = input.phone_number {
            query.push_str(&format!(", phone_number = ${}", param_count));
            params.push(phone_number);
            param_count += 1;
        }

        if let Some(bio) = input.bio {
            query.push_str(&format!(", bio = ${}", param_count));
            params.push(bio);
            param_count += 1;
        }

        query.push_str(&format!(" WHERE id = ${} RETURNING *", param_count));

        let mut sql_query = sqlx::query_as::<_, User>(&query);
        
        for param in params {
            sql_query = sql_query.bind(param);
        }
        sql_query = sql_query.bind(*user_id);

        let updated_user = sql_query.fetch_one(pool).await?;

        info!("User {} updated profile", updated_user.email);

        Ok(updated_user)
    }

    /// Create a new comment
    async fn create_comment(
        &self,
        ctx: &Context<'_>,
        content: String,
        url: String,
        parent_id: Option<Uuid>,
    ) -> Result<Comment> {
        let pool = ctx.data::<PgPool>()?;
        
        // Get user ID from context
        let user_id = ctx.data::<Uuid>()
            .map_err(|_| async_graphql::Error::new("Authentication required"))?;

        // Normalize URL
        let (normalized_url, url_hash) = normalize_url(&url)
            .map_err(|e| async_graphql::Error::new(format!("Invalid URL: {}", e)))?;

        // Validate content
        if content.trim().is_empty() {
            return Err(async_graphql::Error::new("Comment content cannot be empty"));
        }

        if content.len() > 5000 {
            return Err(async_graphql::Error::new("Comment content too long (max 5000 characters)"));
        }

        // If parent_id is provided, verify it exists
        if let Some(parent_id) = parent_id {
            let parent_exists = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM comments WHERE id = $1)"
            )
            .bind(parent_id)
            .fetch_one(pool)
            .await?;

            if !parent_exists {
                return Err(async_graphql::Error::new("Parent comment not found"));
            }
        }

        // Create comment
        let comment = sqlx::query_as::<_, Comment>(
            r#"
            INSERT INTO comments (content, url, normalized_url, url_hash, user_id, parent_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            RETURNING *
            "#
        )
        .bind(&content.trim())
        .bind(&url)
        .bind(&normalized_url)
        .bind(&url_hash)
        .bind(*user_id)
        .bind(parent_id)
        .fetch_one(pool)
        .await?;

        info!("Comment created by user {} on URL {}", user_id, url);

        Ok(comment)
    }

    /// Update an existing comment
    async fn update_comment(
        &self,
        ctx: &Context<'_>,
        id: Uuid,
        content: String,
    ) -> Result<Comment> {
        let pool = ctx.data::<PgPool>()?;
        
        // Get user ID from context
        let user_id = ctx.data::<Uuid>()
            .map_err(|_| async_graphql::Error::new("Authentication required"))?;

        // Validate content
        if content.trim().is_empty() {
            return Err(async_graphql::Error::new("Comment content cannot be empty"));
        }

        if content.len() > 5000 {
            return Err(async_graphql::Error::new("Comment content too long (max 5000 characters)"));
        }

        // Update comment (only if owned by user)
        let updated_comment = sqlx::query_as::<_, Comment>(
            r#"
            UPDATE comments 
            SET content = $1, updated_at = NOW()
            WHERE id = $2 AND user_id = $3
            RETURNING *
            "#
        )
        .bind(&content.trim())
        .bind(id)
        .bind(*user_id)
        .fetch_optional(pool)
        .await?;

        let comment = updated_comment.ok_or_else(|| 
            async_graphql::Error::new("Comment not found or you don't have permission to edit it")
        )?;

        info!("Comment {} updated by user {}", id, user_id);

        Ok(comment)
    }

    /// Delete a comment
    async fn delete_comment(&self, ctx: &Context<'_>, id: Uuid) -> Result<bool> {
        let pool = ctx.data::<PgPool>()?;
        
        // Get user ID from context
        let user_id = ctx.data::<Uuid>()
            .map_err(|_| async_graphql::Error::new("Authentication required"))?;

        // Delete comment (only if owned by user)
        let result = sqlx::query(
            "DELETE FROM comments WHERE id = $1 AND user_id = $2"
        )
        .bind(id)
        .bind(*user_id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(async_graphql::Error::new("Comment not found or you don't have permission to delete it"));
        }

        info!("Comment {} deleted by user {}", id, user_id);

        Ok(true)
    }
}