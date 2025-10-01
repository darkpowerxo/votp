use actix_cors::Cors;
use actix_web::{web, App, HttpServer, Result};
use async_graphql::http::{playground_source, GraphQLPlaygroundConfig};
use async_graphql::{EmptySubscription, Schema};
use async_graphql_actix_web::{GraphQLRequest, GraphQLResponse};
use tracing::info;

mod config;
mod database;
mod graphql;
mod models;
mod services;
mod utils;

use config::Config;
use graphql::{mutation::Mutation, query::Query, VotpSchema};

async fn graphql_handler(
    schema: web::Data<VotpSchema>,
    req: GraphQLRequest,
) -> GraphQLResponse {
    schema.execute(req.into_inner()).await.into()
}

async fn graphql_playground() -> Result<actix_web::HttpResponse> {
    let source = playground_source(GraphQLPlaygroundConfig::new("/api"));
    Ok(actix_web::HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(source))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Load configuration
    dotenvy::dotenv().ok();
    let config = Config::from_env().expect("Failed to load configuration");

    // Connect to database
    let pool = database::create_pool(&config.database_url)
        .await
        .expect("Failed to create database pool");

    // Run migrations
    database::run_migrations(&pool)
        .await
        .expect("Failed to run migrations");

    // Create GraphQL schema
    let schema = Schema::build(Query::default(), Mutation::default(), EmptySubscription)
        .data(pool.clone())
        .data(config.clone())
        .finish();

    info!("Starting server on {}:{}", config.host, config.port);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .app_data(web::Data::new(schema.clone()))
            .wrap(cors)
            .service(
                web::resource("/api")
                    .route(web::post().to(graphql_handler))
                    .route(web::get().to(graphql_handler)),
            )
            .service(web::resource("/playground").route(web::get().to(graphql_playground)))
    })
    .bind(format!("{}:{}", config.host, config.port))?
    .run()
    .await
}
