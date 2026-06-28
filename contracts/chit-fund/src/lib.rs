#![no_std]

use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String};
use crate::storage::FundSummary;

mod storage;
mod chit_fund;
mod randomness;

#[contract]
pub struct ChitFundContract;

#[contractimpl]
impl ChitFundContract {
    pub fn create_fund(
        env: Env,
        organizer: Address,
        token: Address,
        name: String,
        contribution: i128,
        member_count: u32,
    ) -> u64 {
        chit_fund::create_fund(&env, organizer, token, name, contribution, member_count)
    }

    pub fn join_fund(env: Env, fund_id: u64, member: Address) {
        chit_fund::join_fund(&env, fund_id, member)
    }

    pub fn activate_fund(env: Env, fund_id: u64, organizer: Address) {
        chit_fund::activate_fund(&env, fund_id, organizer)
    }

    pub fn deposit(env: Env, fund_id: u64, member: Address, amount: i128) {
        chit_fund::deposit(&env, fund_id, member, amount)
    }

    pub fn commit_hash(env: Env, fund_id: u64, member: Address, hash: BytesN<32>) {
        randomness::commit_hash(&env, fund_id, member, hash)
    }

    pub fn reveal_hash(env: Env, fund_id: u64, member: Address, secret: BytesN<32>) {
        randomness::reveal_hash(&env, fund_id, member, secret)
    }

    pub fn claim_pot(env: Env, fund_id: u64, winner: Address) {
        chit_fund::claim_pot(&env, fund_id, winner)
    }

    pub fn get_fund_summary(env: Env, fund_id: u64) -> FundSummary {
        chit_fund::get_fund_summary(&env, fund_id)
    }

    pub fn get_round_summary(env: Env, fund_id: u64, round: u32) -> storage::RoundSummary {
        chit_fund::get_round_summary(&env, fund_id, round)
    }
}