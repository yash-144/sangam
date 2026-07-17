use crate::storage::{
    get_member_record, get_summary, increment_deposit_count, increment_next_fund_id,
    reset_accumulator, set_member_record, set_summary, FundConfig, FundState, FundSummary,
};
use soroban_sdk::{token, Address, Env, String, Vec};

pub fn create_fund(
    env: &Env,
    organizer: Address,
    token: Address,
    name: String,
    contribution: i128,
    member_count: u32,
) -> u64 {
    organizer.require_auth();

    if !(2..=10).contains(&member_count) {
        panic!("member count must be between 2 and 10");
    }
    if contribution <= 0 {
        panic!("contribution must be greater than 0");
    }

    let config = FundConfig {
        organizer: organizer.clone(),
        token,
        contribution,
        member_count,
        name,
    };

    let mut members = Vec::new(env);
    members.push_back(organizer.clone());

    let summary = FundSummary {
        config,
        state: FundState::Pending,
        current_round: 0,
        members,
        past_winners: Vec::new(env),
    };

    let fund_id = increment_next_fund_id(env);
    set_summary(env, fund_id, &summary);

    fund_id
}

pub fn join_fund(env: &Env, fund_id: u64, member: Address) {
    member.require_auth();

    let mut summary = get_summary(env, fund_id);

    if summary.state != FundState::Pending {
        panic!("fund state is not Pending");
    }
    if summary.members.contains(&member) {
        panic!("already joined");
    }
    if summary.members.len() >= summary.config.member_count {
        panic!("slots are full");
    }

    summary.members.push_back(member);
    set_summary(env, fund_id, &summary);
}

pub fn activate_fund(env: &Env, fund_id: u64, organizer: Address) {
    organizer.require_auth();

    let mut summary = get_summary(env, fund_id);

    if summary.config.organizer != organizer {
        panic!("only organizer can activate");
    }
    if summary.state != FundState::Pending {
        panic!("fund state is not Pending");
    }
    if summary.members.len() != summary.config.member_count {
        panic!("slots are not full");
    }

    summary.state = FundState::Active;
    summary.current_round = 1;

    set_summary(env, fund_id, &summary);
}

pub fn get_fund_summary(env: &Env, fund_id: u64) -> FundSummary {
    get_summary(env, fund_id)
}

pub fn get_round_summary(env: &Env, fund_id: u64, round: u32) -> crate::storage::RoundSummary {
    crate::storage::RoundSummary {
        deposit_count: crate::storage::get_deposit_count(env, fund_id, round),
        commit_count: crate::storage::get_commit_count(env, fund_id, round),
        reveal_count: crate::storage::get_reveal_count(env, fund_id, round),
    }
}

pub fn deposit(env: &Env, fund_id: u64, member: Address, amount: i128) {
    member.require_auth();

    let summary = get_summary(env, fund_id);
    if summary.state != FundState::Active {
        panic!("fund is not active");
    }

    if amount != summary.config.contribution {
        panic!("incorrect deposit amount");
    }

    if !summary.members.contains(&member) {
        panic!("caller is not a member");
    }

    let round = summary.current_round;
    let mut record = get_member_record(env, fund_id, member.clone(), round);

    if record.has_deposited {
        panic!("already deposited this round");
    }

    // Cross-contract call to token
    let client = token::Client::new(env, &summary.config.token);
    client.transfer(&member, &env.current_contract_address(), &amount);

    record.has_deposited = true;
    set_member_record(env, fund_id, member, round, &record);

    increment_deposit_count(env, fund_id, round);
}

pub fn claim_pot(env: &Env, fund_id: u64, winner: Address) {
    winner.require_auth();

    let mut summary = get_summary(env, fund_id);
    if summary.state != FundState::Active {
        panic!("fund is not active");
    }

    let round = summary.current_round;
    if summary.past_winners.len() < round {
        panic!("winner not chosen yet");
    }

    let actual_winner = summary.past_winners.get(round - 1).unwrap();
    if actual_winner != winner {
        panic!("not the winner");
    }

    let client = token::Client::new(env, &summary.config.token);
    let pot = client.balance(&env.current_contract_address());
    client.transfer(&env.current_contract_address(), &winner, &pot);

    if round < summary.config.member_count {
        summary.current_round += 1;
        reset_accumulator(env, fund_id);
    } else {
        summary.state = FundState::Completed;
    }

    set_summary(env, fund_id, &summary);
}
