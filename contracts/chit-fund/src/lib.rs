#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String, BytesN};

mod storage;
mod chit_fund;
mod randomness;

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

    pub fn get_round_summary(env: Env, round: u32) -> storage::RoundSummary {
        chit_fund::get_round_summary(&env, round)
    }

    pub fn deposit(env: Env, member: Address, amount: i128) {
        chit_fund::deposit(&env, member, amount);
    }

    pub fn commit_hash(env: Env, member: Address, hash: BytesN<32>) {
        randomness::commit_hash(&env, member, hash);
    }

    pub fn reveal_hash(env: Env, member: Address, secret: BytesN<32>) {
        randomness::reveal_hash(&env, member, secret);
    }

    pub fn claim_pot(env: Env, winner: Address) {
        chit_fund::claim_pot(&env, winner);
    }

    pub fn force_complete_round(env: Env, organizer: Address) {
        chit_fund::force_complete_round(&env, organizer);
    }
}