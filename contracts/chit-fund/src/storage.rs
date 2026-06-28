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
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoundSummary {
    pub deposit_count: u32,
    pub commit_count: u32,
    pub reveal_count: u32,
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
    NextFundId,
    Summary(u64),
    MemberRecord(u64, Address, u32), // (fund_id, member, round)
    DepositCount(u64, u32),          // (fund_id, round)
    CommitCount(u64, u32),           // (fund_id, round)
    RevealCount(u64, u32),           // (fund_id, round)
    Accumulator(u64),                // fund_id
}

pub fn get_next_fund_id(env: &Env) -> u64 {
    let key = DataKey::NextFundId;
    env.storage().persistent().get(&key).unwrap_or(1)
}

pub fn increment_next_fund_id(env: &Env) -> u64 {
    let key = DataKey::NextFundId;
    let current = get_next_fund_id(env);
    let next = current + 1;
    env.storage().persistent().set(&key, &next);
    env.storage().persistent().extend_ttl(&key, BUMP_AMOUNT, BUMP_AMOUNT);
    current
}

pub fn get_summary(env: &Env, fund_id: u64) -> FundSummary {
    env.storage().persistent().get(&DataKey::Summary(fund_id)).expect("fund summary not found")
}

pub fn set_summary(env: &Env, fund_id: u64, summary: &FundSummary) {
    let key = DataKey::Summary(fund_id);
    env.storage().persistent().set(&key, summary);
    env.storage().persistent().extend_ttl(&key, BUMP_AMOUNT, BUMP_AMOUNT);
}

pub fn get_member_record(env: &Env, fund_id: u64, member: Address, round: u32) -> MemberRecord {
    let key = DataKey::MemberRecord(fund_id, member, round);
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or(MemberRecord {
            has_deposited: false,
            commitment: None,
            reveal: None,
        })
}

pub fn set_member_record(env: &Env, fund_id: u64, member: Address, round: u32, record: &MemberRecord) {
    let key = DataKey::MemberRecord(fund_id, member, round);
    env.storage().persistent().set(&key, record);
    env.storage().persistent().extend_ttl(&key, BUMP_AMOUNT, BUMP_AMOUNT);
}

pub fn get_deposit_count(env: &Env, fund_id: u64, round: u32) -> u32 {
    let key = DataKey::DepositCount(fund_id, round);
    env.storage().persistent().get(&key).unwrap_or(0)
}

pub fn increment_deposit_count(env: &Env, fund_id: u64, round: u32) {
    let key = DataKey::DepositCount(fund_id, round);
    let count = get_deposit_count(env, fund_id, round) + 1;
    env.storage().persistent().set(&key, &count);
    env.storage().persistent().extend_ttl(&key, BUMP_AMOUNT, BUMP_AMOUNT);
}

pub fn get_commit_count(env: &Env, fund_id: u64, round: u32) -> u32 {
    let key = DataKey::CommitCount(fund_id, round);
    env.storage().persistent().get(&key).unwrap_or(0)
}

pub fn increment_commit_count(env: &Env, fund_id: u64, round: u32) {
    let key = DataKey::CommitCount(fund_id, round);
    let count = get_commit_count(env, fund_id, round) + 1;
    env.storage().persistent().set(&key, &count);
    env.storage().persistent().extend_ttl(&key, BUMP_AMOUNT, BUMP_AMOUNT);
}

pub fn get_reveal_count(env: &Env, fund_id: u64, round: u32) -> u32 {
    let key = DataKey::RevealCount(fund_id, round);
    env.storage().persistent().get(&key).unwrap_or(0)
}

pub fn increment_reveal_count(env: &Env, fund_id: u64, round: u32) {
    let key = DataKey::RevealCount(fund_id, round);
    let count = get_reveal_count(env, fund_id, round) + 1;
    env.storage().persistent().set(&key, &count);
    env.storage().persistent().extend_ttl(&key, BUMP_AMOUNT, BUMP_AMOUNT);
}

pub fn get_accumulator(env: &Env, fund_id: u64) -> BytesN<32> {
    let key = DataKey::Accumulator(fund_id);
    env.storage().persistent().get(&key).unwrap_or(BytesN::from_array(env, &[0; 32]))
}

pub fn xor_into_accumulator(env: &Env, fund_id: u64, value: BytesN<32>) {
    let key = DataKey::Accumulator(fund_id);
    let current = get_accumulator(env, fund_id);
    
    let mut current_arr = current.to_array();
    let val_arr = value.to_array();
    
    for i in 0..32 {
        current_arr[i] ^= val_arr[i];
    }
    
    let new_accumulator = BytesN::from_array(env, &current_arr);
    env.storage().persistent().set(&key, &new_accumulator);
    env.storage().persistent().extend_ttl(&key, BUMP_AMOUNT, BUMP_AMOUNT);
}

pub fn reset_accumulator(env: &Env, fund_id: u64) {
    let key = DataKey::Accumulator(fund_id);
    let zeros = BytesN::from_array(env, &[0; 32]);
    env.storage().persistent().set(&key, &zeros);
    env.storage().persistent().extend_ttl(&key, BUMP_AMOUNT, BUMP_AMOUNT);
}
