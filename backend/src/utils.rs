use regex::Regex;
use sha2::{Digest, Sha256};
use url::Url;

/// Normalizes a URL to create a canonical form for comment grouping
pub fn normalize_url(input_url: &str) -> Result<(String, String), Box<dyn std::error::Error>> {
    // Parse the URL
    let mut url = Url::parse(input_url)?;
    
    // Convert to lowercase
    url.set_scheme(&url.scheme().to_lowercase())?;
    
    // Handle host normalization
    if let Some(host) = url.host_str() {
        let normalized_host = normalize_host(host);
        url.set_host(Some(&normalized_host))?;
    }
    
    // Normalize path - remove trailing slash unless it's the root
    let path = url.path();
    let normalized_path = if path.len() > 1 && path.ends_with('/') {
        &path[..path.len()-1]
    } else {
        path
    };
    url.set_path(normalized_path);
    
    // Remove common tracking parameters
    let mut query_pairs: Vec<(String, String)> = url.query_pairs()
        .filter(|(key, _)| !is_tracking_parameter(key))
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect();
    
    // Sort query parameters for consistency
    query_pairs.sort_by(|a, b| a.0.cmp(&b.0));
    
    // Rebuild query string
    if query_pairs.is_empty() {
        url.set_query(None);
    } else {
        let query_string = query_pairs
            .iter()
            .map(|(k, v)| format!("{}={}", k, v))
            .collect::<Vec<_>>()
            .join("&");
        url.set_query(Some(&query_string));
    }
    
    // Remove fragment
    url.set_fragment(None);
    
    let normalized_url = url.to_string();
    let url_hash = create_url_hash(&normalized_url);
    
    Ok((normalized_url, url_hash))
}

fn normalize_host(host: &str) -> String {
    let host = host.to_lowercase();
    
    // Remove www. prefix
    let host = if host.starts_with("www.") {
        &host[4..]
    } else {
        &host
    };
    
    // Handle language subdomains (en., es., de., fr., etc.)
    let lang_pattern = Regex::new(r"^[a-z]{2}\.").unwrap();
    if lang_pattern.is_match(host) {
        // Remove language subdomain
        &host[3..]
    } else {
        host
    }.to_string()
}

fn is_tracking_parameter(key: &str) -> bool {
    const TRACKING_PARAMS: &[&str] = &[
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
        "fbclid", "gclid", "msclkid", "ref", "referrer", "_ga", "_gl",
        "mc_cid", "mc_eid", "campaign", "source", "medium",
    ];
    
    TRACKING_PARAMS.contains(&key)
}

fn create_url_hash(url: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(url.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn generate_verification_code() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    format!("{:06}", rng.gen_range(100000..=999999))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_url_normalization() {
        let test_cases = vec![
            ("http://example.com/article1", "http://example.com/article1"),
            ("http://example.com/article1/", "http://example.com/article1"),
            ("http://en.example.com/article1/", "http://example.com/article1"),
            ("http://www.example.com/article1", "http://example.com/article1"),
            ("https://en.example.com/article1?utm_source=google", "https://example.com/article1"),
        ];
        
        for (input, expected) in test_cases {
            let (normalized, _) = normalize_url(input).unwrap();
            assert_eq!(normalized, expected, "Failed for input: {}", input);
        }
    }
    
    #[test]
    fn test_same_urls_produce_same_hash() {
        let url1 = "http://example.com/article1";
        let url2 = "http://example.com/article1/";
        let url3 = "http://en.example.com/article1/";
        
        let (_, hash1) = normalize_url(url1).unwrap();
        let (_, hash2) = normalize_url(url2).unwrap();
        let (_, hash3) = normalize_url(url3).unwrap();
        
        assert_eq!(hash1, hash2);
        assert_eq!(hash2, hash3);
    }
}