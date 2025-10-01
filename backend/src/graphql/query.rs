use crate::models::{Comment, User};
use crate::utils::normalize_url;
use async_graphql::{Context, Object, Result};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Default)]
pub struct Query;

#[Object]
impl Query {
    /// Get the current authenticated user
    async fn current_user(&self, ctx: &Context<'_>) -> Result<Option<User>> {
        // Extract user from context (set by JWT middleware)
        if let Some(user_id) = ctx.data_opt::<Uuid>() {
            let pool = ctx.data::<PgPool>()?;
            
            let user = sqlx::query_as::<_, User>(
                "SELECT * FROM users WHERE id = $1"
            )
            .bind(*user_id)
            .fetch_optional(pool)
            .await?;
            
            Ok(user)
        } else {
            Ok(None)
        }
    }

    /// Get user profile by ID
    async fn user_profile(&self, ctx: &Context<'_>, user_id: Uuid) -> Result<Option<User>> {
        let pool = ctx.data::<PgPool>()?;
        
        let user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE id = $1"
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await?;
        
        Ok(user)
    }

    /// Get comments for a specific URL
    async fn comments_for_url(&self, ctx: &Context<'_>, url: String) -> Result<Vec<Comment>> {
        let pool = ctx.data::<PgPool>()?;
        
        // Normalize the URL to ensure consistent grouping
        let (_normalized_url, url_hash) = normalize_url(&url)
            .map_err(|e| async_graphql::Error::new(format!("Invalid URL: {}", e)))?;

        let comments = sqlx::query_as::<_, Comment>(
            r#"
            SELECT c.* FROM comments c
            WHERE c.url_hash = $1
            ORDER BY c.created_at ASC
            "#
        )
        .bind(&url_hash)
        .fetch_all(pool)
        .await?;

        Ok(comments)
    }

    /// Get comments by user ID
    async fn user_comments(&self, ctx: &Context<'_>, user_id: Uuid, limit: Option<i32>) -> Result<Vec<Comment>> {
        let pool = ctx.data::<PgPool>()?;
        let limit = limit.unwrap_or(50).min(100); // Default to 50, max 100
        
        let comments = sqlx::query_as::<_, Comment>(
            r#"
            SELECT * FROM comments 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT $2
            "#
        )
        .bind(user_id)
        .bind(limit as i64)
        .fetch_all(pool)
        .await?;

        Ok(comments)
    }

    /// Get replies to a specific comment
    async fn comment_replies(&self, ctx: &Context<'_>, parent_id: Uuid) -> Result<Vec<Comment>> {
        let pool = ctx.data::<PgPool>()?;
        
        let replies = sqlx::query_as::<_, Comment>(
            r#"
            SELECT * FROM comments 
            WHERE parent_id = $1 
            ORDER BY created_at ASC
            "#
        )
        .bind(parent_id)
        .fetch_all(pool)
        .await?;

        Ok(replies)
    }

    /// Search comments by content
    async fn search_comments(
        &self, 
        ctx: &Context<'_>, 
        search_term: String,
        limit: Option<i32>
    ) -> Result<Vec<Comment>> {
        let pool = ctx.data::<PgPool>()?;
        let limit = limit.unwrap_or(20).min(50); // Default to 20, max 50
        
        let comments = sqlx::query_as::<_, Comment>(
            r#"
            SELECT * FROM comments 
            WHERE content ILIKE $1 
            ORDER BY created_at DESC 
            LIMIT $2
            "#
        )
        .bind(format!("%{}%", search_term))
        .bind(limit as i64)
        .fetch_all(pool)
        .await?;

        Ok(comments)
    }
}