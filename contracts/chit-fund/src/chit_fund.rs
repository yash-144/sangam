use soroban_sdk::{token, Address, Env, String, Vec};
use crate::storage::{
    get_summary, set_summary, FundConfig, FundState, FundSummary,
    get_member_record, set_member_record, get_deposit_count, increment_deposit_count
};

pub fn create_fund(
    env: &Env,
    organizer: Address,
    token: Address,
    name: String,
    contribution: i128,
    member_count: u32,
) {
    organizer.require_auth();

    if member_count < 2 || member_count > 10 {
        panic!("member count must be between 2 and 10");
    }
    if contribution <= 0 {
        panic!("contribution must be greater than 0");
    }

    let config = FundConfig {
        organizer,
        token,
        contribution,
        member_count,
        name,
    };

    let summary = FundSummary {
        config,
        state: FundState::Pending,
        current_round: 0,
        members: Vec::new(env),
        past_winners: Vec::new(env),
    };

    set_summary(env, &summary);
}

pub fn join_fund(env: &Env, member: Address) {
    member.require_auth();

    let mut summary = get_summary(env);

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
    set_summary(env, &summary);
}

pub fn activate_fund(env: &Env, organizer: Address) {
    organizer.require_auth();

    let mut summary = get_summary(env);

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

    set_summary(env, &summary);
}

pub fn get_fund_summary(env: &Env) -> FundSummary {
    get_summary(env)
}

pub fn deposit(env: &Env, member: Address, amount: i128) {
    member.require_auth();

    let summary = get_summary(env);
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
    let mut record = get_member_record(env, member.clone(), round);

    if record.has_deposited {
        panic!("already deposited this round");
    }

    // Cross-contract call to token
    let client = token::Client::new(env, &summary.config.token);
    client.transfer(&member, &env.current_contract_address(), &amount);

    record.has_deposited = true;
    set_member_record(env, member, round, &record);

    increment_deposit_count(env, round);
}
