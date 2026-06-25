#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Symbol, symbol_short};

mod storage;

#[contract]
pub struct ChitFundContract;

#[contractimpl]
impl ChitFundContract {
    pub fn hello(_env: Env) -> Symbol {
        symbol_short!("world")
    }
}