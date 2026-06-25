use soroban_sdk::{contracttype, Address, BytesN, Env, String, Vec};

const BUMP_AMOUNT: u32 = 100_000;

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct FundConfig {
    pub organizer: Address,
    pub token: Address,
    pub contribution: i128,
    pub member_count: u32,
    pub name: String,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum FundState {
    Pending,
    Active,
    Completed,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct FundSummary {
    pub config: FundConfig,
    pub state: FundState,
    pub current_round: u32,
    pub members: Vec<Address>,
    pub past_winners: Vec<Address>,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct MemberRecord {
    pub has_deposited: bool,
    pub commitment: Option<BytesN<32>>,
    pub reveal: Option<BytesN<32>>,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Summary,
    MemberRecord(Address, u32), // (member, round)
    DepositCount(u32),          // round
    CommitCount(u32),           // round
    RevealCount(u32),           // round
    Accumulator,
}

pub fn get_summary(env: &Env) -> FundSummary {
    env.storage().persistent().get(&DataKey::Summary).expect("fund summary not found")
}

pub fn set_summary(env: &Env, summary: &FundSummary) {
    env.storage().persistent().set(&DataKey::Summary, summary);
    env.storage().persistent().extend_ttl(&DataKey::Summary, BUMP_AMOUNT, BUMP_AMOUNT);
}

pub fn get_member_record(env: &Env, member: Address, round: u32) -> MemberRecord {
    let key = DataKey::MemberRecord(member, round);
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or(MemberRecord {
            has_deposited: false,
            commitment: None,
            reveal: None,
        })
}

pub fn set_member_record(env: &Env, member: Address, round: u32, record: &MemberRecord) {
    let key = DataKey::MemberRecord(member, round);
    env.storage().persistent().set(&key, record);
    env.storage().persistent().extend_ttl(&key, BUMP_AMOUNT, BUMP_AMOUNT);
}

pub fn get_deposit_count(env: &Env, round: u32) -> u32 {
    let key = DataKey::DepositCount(round);
    env.storage().persistent().get(&key).unwrap_or(0)
}

pub fn increment_deposit_count(env: &Env, round: u32) {
    let key = DataKey::DepositCount(round);
    let count = get_deposit_count(env, round) + 1;
    env.storage().persistent().set(&key, &count);
    env.storage().persistent().extend_ttl(&key, BUMP_AMOUNT, BUMP_AMOUNT);
}

pub fn get_commit_count(env: &Env, round: u32) -> u32 {
    let key = DataKey::CommitCount(round);
    env.storage().persistent().get(&key).unwrap_or(0)
}

pub fn increment_commit_count(env: &Env, round: u32) {
    let key = DataKey::CommitCount(round);
    let count = get_commit_count(env, round) + 1;
    env.storage().persistent().set(&key, &count);
    env.storage().persistent().extend_ttl(&key, BUMP_AMOUNT, BUMP_AMOUNT);
}

pub fn get_reveal_count(env: &Env, round: u32) -> u32 {
    let key = DataKey::RevealCount(round);
    env.storage().persistent().get(&key).unwrap_or(0)
}

pub fn increment_reveal_count(env: &Env, round: u32) {
    let key = DataKey::RevealCount(round);
    let count = get_reveal_count(env, round) + 1;
    env.storage().persistent().set(&key, &count);
    env.storage().persistent().extend_ttl(&key, BUMP_AMOUNT, BUMP_AMOUNT);
}

pub fn get_accumulator(env: &Env) -> BytesN<32> {
    let key = DataKey::Accumulator;
    env.storage().persistent().get(&key).unwrap_or(BytesN::from_array(env, &[0; 32]))
}

pub fn xor_into_accumulator(env: &Env, value: BytesN<32>) {
    let key = DataKey::Accumulator;
    let current = get_accumulator(env);
    
    let mut current_arr = current.to_array();
    let val_arr = value.to_array();
    
    for i in 0..32 {
        current_arr[i] ^= val_arr[i];
    }
    
    let new_accumulator = BytesN::from_array(env, &current_arr);
    env.storage().persistent().set(&key, &new_accumulator);
    env.storage().persistent().extend_ttl(&key, BUMP_AMOUNT, BUMP_AMOUNT);
}

pub fn reset_accumulator(env: &Env) {
    let key = DataKey::Accumulator;
    let zeros = BytesN::from_array(env, &[0; 32]);
    env.storage().persistent().set(&key, &zeros);
    env.storage().persistent().extend_ttl(&key, BUMP_AMOUNT, BUMP_AMOUNT);
}
