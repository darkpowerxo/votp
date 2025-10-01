use async_graphql::{SimpleObject, InputObject, Object};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub phone_number: Option<String>,
    pub bio: Option<String>,
    pub password_hash: String,
    pub email_verified: bool,
    pub verification_code: Option<String>,
    pub verification_code_expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[Object]
impl User {
    async fn id(&self) -> &Uuid { &self.id }
    async fn name(&self) -> &String { &self.name }
    async fn email(&self) -> &String { &self.email }
    async fn phone_number(&self) -> &Option<String> { &self.phone_number }
    async fn bio(&self) -> &Option<String> { &self.bio }
    async fn created_at(&self) -> &DateTime<Utc> { &self.created_at }
    async fn updated_at(&self) -> &DateTime<Utc> { &self.updated_at }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Comment {
    pub id: Uuid,
    pub content: String,
    pub url: String,
    pub normalized_url: String,
    pub url_hash: String,
    pub user_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[Object]
impl Comment {
    async fn id(&self) -> &Uuid { &self.id }
    async fn content(&self) -> &String { &self.content }
    async fn url(&self) -> &String { &self.url }
    async fn normalized_url(&self) -> &String { &self.normalized_url }
    async fn user_id(&self) -> &Uuid { &self.user_id }
    async fn parent_id(&self) -> &Option<Uuid> { &self.parent_id }
    async fn created_at(&self) -> &DateTime<Utc> { &self.created_at }
    async fn updated_at(&self) -> &DateTime<Utc> { &self.updated_at }
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