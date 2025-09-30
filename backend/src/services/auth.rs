use crate::models::{Claims, User};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::{rand_core::OsRng, SaltString};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use anyhow::Result;
use uuid::Uuid;

pub struct AuthService {
    jwt_secret: String,
}

impl AuthService {
    pub fn new(jwt_secret: String) -> Self {
        Self { jwt_secret }
    }

    pub fn hash_password(&self, password: &str) -> Result<String> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        
        let password_hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| anyhow::anyhow!("Failed to hash password: {}", e))?;

        Ok(password_hash.to_string())
    }

    pub fn verify_password(&self, password: &str, hash: &str) -> Result<bool> {
        let parsed_hash = PasswordHash::new(hash)
            .map_err(|e| anyhow::anyhow!("Failed to parse password hash: {}", e))?;
        
        let argon2 = Argon2::default();
        
        match argon2.verify_password(password.as_bytes(), &parsed_hash) {
            Ok(()) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    pub fn generate_jwt_token(&self, user: &User) -> Result<String> {
        let now = Utc::now();
        let expiry = now + Duration::hours(24); // 24 hour expiry

        let claims = Claims {
            sub: user.id.to_string(),
            email: user.email.clone(),
            exp: expiry.timestamp() as usize,
            iat: now.timestamp() as usize,
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.jwt_secret.as_ref()),
        )
        .map_err(|e| anyhow::anyhow!("Failed to generate JWT token: {}", e))?;

        Ok(token)
    }

    pub fn verify_jwt_token(&self, token: &str) -> Result<Claims> {
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_ref()),
            &Validation::default(),
        )
        .map_err(|e| anyhow::anyhow!("Failed to verify JWT token: {}", e))?;

        Ok(token_data.claims)
    }

    pub fn extract_user_id_from_token(&self, token: &str) -> Result<Uuid> {
        let claims = self.verify_jwt_token(token)?;
        let user_id = Uuid::parse_str(&claims.sub)
            .map_err(|e| anyhow::anyhow!("Invalid user ID in token: {}", e))?;
        Ok(user_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::User;
    use chrono::Utc;
    use uuid::Uuid;

    fn create_test_user() -> User {
        User {
            id: Uuid::new_v4(),
            name: "Test User".to_string(),
            email: "test@example.com".to_string(),
            phone_number: None,
            bio: None,
            password_hash: "hashed_password".to_string(),
            email_verified: true,
            verification_code: None,
            verification_code_expires_at: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn test_password_hashing_and_verification() {
        let auth_service = AuthService::new("test_secret".to_string());
        let password = "test_password_123";

        let hash = auth_service.hash_password(password).unwrap();
        assert!(auth_service.verify_password(password, &hash).unwrap());
        assert!(!auth_service.verify_password("wrong_password", &hash).unwrap());
    }

    #[test]
    fn test_jwt_token_generation_and_verification() {
        let auth_service = AuthService::new("test_secret".to_string());
        let user = create_test_user();

        let token = auth_service.generate_jwt_token(&user).unwrap();
        let claims = auth_service.verify_jwt_token(&token).unwrap();

        assert_eq!(claims.sub, user.id.to_string());
        assert_eq!(claims.email, user.email);
    }

    #[test]
    fn test_extract_user_id_from_token() {
        let auth_service = AuthService::new("test_secret".to_string());
        let user = create_test_user();

        let token = auth_service.generate_jwt_token(&user).unwrap();
        let extracted_id = auth_service.extract_user_id_from_token(&token).unwrap();

        assert_eq!(extracted_id, user.id);
    }
}