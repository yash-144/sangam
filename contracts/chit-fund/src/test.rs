#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};
use crate::storage::{FundState, get_summary};

#[test]
fn test_fund_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ChitFundContract);
    let client = ChitFundContractClient::new(&env, &contract_id);

    let organizer = Address::generate(&env);
    let member2 = Address::generate(&env);
    let member3 = Address::generate(&env);
    
    let token = Address::generate(&env);
    let name = String::from_str(&env, "My Fund");
    let contribution = 1000;
    let member_count = 3;

    // 1. Create fund
    client.create_fund(&organizer, &token, &name, &contribution, &member_count);
    
    // Verify it's Pending
    env.as_contract(&contract_id, || {
        let summary = get_summary(&env);
        assert_eq!(summary.state, FundState::Pending);
        assert_eq!(summary.config.member_count, 3);
        assert_eq!(summary.members.len(), 0);
    });

    // 2. Join members
    client.join_fund(&organizer);
    client.join_fund(&member2);
    
    env.as_contract(&contract_id, || {
        let summary = get_summary(&env);
        assert_eq!(summary.members.len(), 2);
    });
    
    client.join_fund(&member3);

    env.as_contract(&contract_id, || {
        let summary = get_summary(&env);
        assert_eq!(summary.members.len(), 3);
    });

    // 3. Activate
    client.activate_fund(&organizer);
    
    env.as_contract(&contract_id, || {
        let summary = get_summary(&env);
        assert_eq!(summary.state, FundState::Active);
        assert_eq!(summary.current_round, 1);
    });
}

#[test]
#[should_panic(expected = "fund state is not Pending")]
fn test_join_after_activate_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ChitFundContract);
    let client = ChitFundContractClient::new(&env, &contract_id);

    let organizer = Address::generate(&env);
    let member2 = Address::generate(&env);
    let member3 = Address::generate(&env);
    
    let token = Address::generate(&env);
    let name = String::from_str(&env, "My Fund");
    
    client.create_fund(&organizer, &token, &name, &1000, &2);
    client.join_fund(&organizer);
    client.join_fund(&member2);
    
    // Activate
    client.activate_fund(&organizer);
    
    // Attempt to join after active
    client.join_fund(&member3);
}

#[test]
#[should_panic(expected = "already joined")]
fn test_join_twice_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ChitFundContract);
    let client = ChitFundContractClient::new(&env, &contract_id);

    let organizer = Address::generate(&env);
    let token = Address::generate(&env);
    let name = String::from_str(&env, "My Fund");
    
    client.create_fund(&organizer, &token, &name, &1000, &2);
    client.join_fund(&organizer);
    client.join_fund(&organizer);
}

#[test]
#[should_panic(expected = "slots are full")]
fn test_join_when_full_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ChitFundContract);
    let client = ChitFundContractClient::new(&env, &contract_id);

    let organizer = Address::generate(&env);
    let member2 = Address::generate(&env);
    let member3 = Address::generate(&env);
    
    let token = Address::generate(&env);
    let name = String::from_str(&env, "My Fund");
    
    client.create_fund(&organizer, &token, &name, &1000, &2);
    client.join_fund(&organizer);
    client.join_fund(&member2);
    client.join_fund(&member3);
}

#[test]
#[should_panic(expected = "slots are not full")]
fn test_activate_before_full_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ChitFundContract);
    let client = ChitFundContractClient::new(&env, &contract_id);

    let organizer = Address::generate(&env);
    let token = Address::generate(&env);
    let name = String::from_str(&env, "My Fund");
    
    client.create_fund(&organizer, &token, &name, &1000, &2);
    client.join_fund(&organizer);
    client.activate_fund(&organizer);
}

#[test]
#[should_panic(expected = "only organizer can activate")]
fn test_non_organizer_activate_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ChitFundContract);
    let client = ChitFundContractClient::new(&env, &contract_id);

    let organizer = Address::generate(&env);
    let member2 = Address::generate(&env);
    
    let token = Address::generate(&env);
    let name = String::from_str(&env, "My Fund");
    
    client.create_fund(&organizer, &token, &name, &1000, &2);
    client.join_fund(&organizer);
    client.join_fund(&member2);
    
    // member2 tries to activate
    client.activate_fund(&member2);
}

#[test]
fn test_deposit_success() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ChitFundContract);
    let client = ChitFundContractClient::new(&env, &contract_id);

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_client = soroban_sdk::token::Client::new(&env, &token_id);
    let token_admin_client = soroban_sdk::token::StellarAssetClient::new(&env, &token_id);

    let organizer = Address::generate(&env);
    let member2 = Address::generate(&env);
    
    // Mint tokens
    token_admin_client.mint(&organizer, &2000);
    token_admin_client.mint(&member2, &2000);

    let name = String::from_str(&env, "My Fund");
    let contribution = 1000;
    
    client.create_fund(&organizer, &token_id, &name, &contribution, &2);
    client.join_fund(&organizer);
    client.join_fund(&member2);
    client.activate_fund(&organizer);

    // Initial balances
    assert_eq!(token_client.balance(&organizer), 2000);
    assert_eq!(token_client.balance(&contract_id), 0);

    // First deposit
    client.deposit(&organizer, &1000);

    assert_eq!(token_client.balance(&organizer), 1000);
    assert_eq!(token_client.balance(&contract_id), 1000);

    env.as_contract(&contract_id, || {
        let count = crate::storage::get_deposit_count(&env, 1);
        assert_eq!(count, 1);
        
        let record = crate::storage::get_member_record(&env, organizer.clone(), 1);
        assert!(record.has_deposited);
    });

    // Second deposit
    client.deposit(&member2, &1000);

    assert_eq!(token_client.balance(&member2), 1000);
    assert_eq!(token_client.balance(&contract_id), 2000);

    env.as_contract(&contract_id, || {
        let count = crate::storage::get_deposit_count(&env, 1);
        assert_eq!(count, 2);
    });
}

#[test]
#[should_panic(expected = "already deposited this round")]
fn test_double_deposit_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ChitFundContract);
    let client = ChitFundContractClient::new(&env, &contract_id);

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_admin_client = soroban_sdk::token::StellarAssetClient::new(&env, &token_id);

    let organizer = Address::generate(&env);
    let member2 = Address::generate(&env);
    
    token_admin_client.mint(&organizer, &2000);
    
    client.create_fund(&organizer, &token_id, &String::from_str(&env, "Fund"), &1000, &2);
    client.join_fund(&organizer);
    client.join_fund(&member2);
    client.activate_fund(&organizer);

    client.deposit(&organizer, &1000);
    client.deposit(&organizer, &1000);
}

#[test]
#[should_panic(expected = "incorrect deposit amount")]
fn test_wrong_deposit_amount_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ChitFundContract);
    let client = ChitFundContractClient::new(&env, &contract_id);

    let token_id = Address::generate(&env);
    let organizer = Address::generate(&env);
    let member2 = Address::generate(&env);
    
    client.create_fund(&organizer, &token_id, &String::from_str(&env, "Fund"), &1000, &2);
    client.join_fund(&organizer);
    client.join_fund(&member2);
    client.activate_fund(&organizer);

    client.deposit(&organizer, &500); // Expects 1000
}

#[test]
#[should_panic(expected = "fund is not active")]
fn test_deposit_before_activate_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ChitFundContract);
    let client = ChitFundContractClient::new(&env, &contract_id);

    let token_id = Address::generate(&env);
    let organizer = Address::generate(&env);
    
    client.create_fund(&organizer, &token_id, &String::from_str(&env, "Fund"), &1000, &2);
    client.join_fund(&organizer);

    client.deposit(&organizer, &1000);
}
