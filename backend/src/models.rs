use async_graphql::{SimpleObject, InputObject};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, SimpleObject)]
#[graphql(complex)]
pub struct User {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub phone_number: Option<String>,
    pub bio: Option<String>,
    #[graphql(skip)]
    pub password_hash: String,
    #[graphql(skip)]
    pub email_verified: bool,
    #[graphql(skip)]
    pub verification_code: Option<String>,
    #[graphql(skip)]
    pub verification_code_expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, SimpleObject)]
#[graphql(complex)]
pub struct Comment {
    pub id: Uuid,
    pub content: String,
    pub url: String,
    pub normalized_url: String,
    #[graphql(skip)]
    pub url_hash: String,
    pub user_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct AuthPayload {
    pub token: String,
    pub user: User,
}

#[derive(Debug, Clone, InputObject)]
pub struct UpdateProfileInput {
    pub name: Option<String>,
    pub phone_number: Option<String>,
    pub bio: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // Subject (user id)
    pub exp: usize,  // Expiry time as UTC timestamp
    pub iat: usize,  // Issued at time as UTC timestamp
    pub email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationCode {
    pub email: String,
    pub code: String,
    pub expires_at: DateTime<Utc>,
}