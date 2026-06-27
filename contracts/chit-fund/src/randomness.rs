use soroban_sdk::{BytesN, Env, Address};
use crate::storage::{
    get_summary, set_summary, FundState, get_member_record, set_member_record,
    get_deposit_count, get_commit_count, increment_commit_count,
    get_reveal_count, increment_reveal_count, get_accumulator, xor_into_accumulator
};

pub fn commit_hash(env: &Env, member: Address, hash: BytesN<32>) {
    member.require_auth();

    let summary = get_summary(env);
    if summary.state != FundState::Active {
        panic!("fund is not active");
    }

    let round = summary.current_round;
    let deposits = get_deposit_count(env, round);
    if deposits < summary.config.member_count {
        panic!("deposit phase not complete");
    }

    if summary.past_winners.contains(&member) {
        panic!("already won");
    }

    let mut record = get_member_record(env, member.clone(), round);
    if record.commitment.is_some() {
        panic!("already committed");
    }

    record.commitment = Some(hash);
    set_member_record(env, member, round, &record);

    increment_commit_count(env, round);
}

pub fn reveal_hash(env: &Env, member: Address, secret: BytesN<32>) {
    member.require_auth();

    let mut summary = get_summary(env);
    if summary.state != FundState::Active {
        panic!("fund is not active");
    }

    let round = summary.current_round;
    let eligible_count = summary.config.member_count - summary.past_winners.len();
    let commits = get_commit_count(env, round);
    if commits < eligible_count {
        panic!("commit phase not complete");
    }

    let mut record = get_member_record(env, member.clone(), round);
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
    set_member_record(env, member.clone(), round, &record);
    
    xor_into_accumulator(env, secret);
    increment_reveal_count(env, round);

    // If all revealed, select winner
    let reveals = get_reveal_count(env, round);
    if reveals == eligible_count {
        let accumulator = get_accumulator(env);
        let mut buf = [0u8; 8];
        buf.copy_from_slice(&accumulator.to_array()[0..8]);
        let rand_num = u64::from_be_bytes(buf);

        let mut eligible_members = soroban_sdk::Vec::new(env);
        for m in summary.members.clone() {
            if !summary.past_winners.contains(&m) {
                eligible_members.push_back(m);
            }
        }

        let winner_index = (rand_num % (eligible_count as u64)) as u32;
        let winner = eligible_members.get(winner_index).unwrap();

        summary.past_winners.push_back(winner);
        set_summary(env, &summary);
    }
}
