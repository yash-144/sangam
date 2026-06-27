#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String};

mod storage;
mod chit_fund;

#[cfg(test)]
mod test;

#[contract]
pub struct ChitFundContract;

#[contractimpl]
impl ChitFundContract {
    pub fn create_fund(env: Env, organizer: Address, token: Address, name: String, contribution: i128, member_count: u32) {
        chit_fund::create_fund(&env, organizer, token, name, contribution, member_count);
    }

    pub fn join_fund(env: Env, member: Address) {
        chit_fund::join_fund(&env, member);
    }

    pub fn activate_fund(env: Env, organizer: Address) {
        chit_fund::activate_fund(&env, organizer);
    }

    pub fn get_fund_summary(env: Env) -> storage::FundSummary {
        chit_fund::get_fund_summary(&env)
    }
}