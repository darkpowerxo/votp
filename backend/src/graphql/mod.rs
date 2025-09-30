pub mod mutation;
pub mod query;

use async_graphql::Schema;
use mutation::Mutation;
use query::Query;

pub type VotpSchema = Schema<Query, Mutation, async_graphql::EmptySubscription>;