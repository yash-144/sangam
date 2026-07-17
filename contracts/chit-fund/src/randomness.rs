use crate::storage::{
    get_accumulator, get_deposit_count, get_member_record, get_reveal_count, get_summary,
    increment_commit_count, increment_reveal_count, set_member_record, set_summary,
    xor_into_accumulator, FundState,
};
use soroban_sdk::{Address, BytesN, Env};

pub fn commit_hash(env: &Env, fund_id: u64, member: Address, hash: BytesN<32>) {
    member.require_auth();

    let summary = get_summary(env, fund_id);
    if summary.state != FundState::Active {
        panic!("fund is not active");
    }

    let round = summary.current_round;
    let deposits = get_deposit_count(env, fund_id, round);
    if deposits < summary.config.member_count {
        panic!("deposit phase not complete");
    }

    let mut record = get_member_record(env, fund_id, member.clone(), round);
    if record.commitment.is_some() {
        panic!("already committed");
    }

    record.commitment = Some(hash);
    set_member_record(env, fund_id, member, round, &record);

    increment_commit_count(env, fund_id, round);
}

pub fn reveal_hash(env: &Env, fund_id: u64, member: Address, secret: BytesN<32>) {
    member.require_auth();

    let mut summary = get_summary(env, fund_id);
    if summary.state != FundState::Active {
        panic!("fund is not active");
    }

    let round = summary.current_round;

    let mut record = get_member_record(env, fund_id, member.clone(), round);
    let commitment = record.commitment.clone().expect("no commitment found");

    if record.reveal.is_some() {
        panic!("already revealed");
    }

    let secret_bytes = secret.clone().into();
    let expected_hash: BytesN<32> = env.crypto().sha256(&secret_bytes).into();

    if expected_hash != commitment {
        panic!("hash mismatch");
    }

    record.reveal = Some(secret.clone());
    set_member_record(env, fund_id, member.clone(), round, &record);

    xor_into_accumulator(env, fund_id, secret);
    increment_reveal_count(env, fund_id, round);

    // Select winner once all reveals are in
    let eligible_count = summary.config.member_count - summary.past_winners.len();
    let reveals = get_reveal_count(env, fund_id, round);
    if reveals >= summary.config.member_count {
        let accumulator = get_accumulator(env, fund_id);
        let mut buf = [0u8; 8];
        buf.copy_from_slice(&accumulator.to_array()[0..8]);
        let rand_num = u64::from_be_bytes(buf);

        let mut eligible_members = soroban_sdk::Vec::new(env);
        for m in summary.members.clone() {
            if !summary.past_winners.contains(&m) {
                eligible_members.push_back(m);
            }
        }

        if !eligible_members.is_empty() {
            let winner_index = (rand_num % (eligible_count as u64)) as u32;
            let winner = eligible_members
                .get(winner_index % eligible_members.len())
                .unwrap();
            summary.past_winners.push_back(winner);
            set_summary(env, fund_id, &summary);
        }
    }
}
