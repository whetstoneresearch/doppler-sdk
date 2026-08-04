#![allow(unexpected_cfgs)]

use anchor_lang::{prelude::*, solana_program::program::set_return_data};

declare_id!("Fg6PaFpoGXkYsidMpWxTWqkZL6W2BeZ7FEfcYkgMQhgB");

const LAST_SUPPORTED_ACTION: u8 = 5;
const HOOK_NO_CHANGE: u16 = 0xffff;
const HOOK_RESULT_LEN: usize = 32;

#[program]
pub mod solana_custom_hook {
    use super::*;

    pub fn hook(_program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> Result<()> {
        process_hook(accounts, data)
    }
}

fn process_hook(_accounts: &[AccountInfo], data: &[u8]) -> Result<()> {
    let (context, payload) = HookContextV1::deserialize_with_payload(data)?;
    let decision = evaluate_hook(&context, payload)?;
    set_return_data(&decision.to_return_data());

    Ok(())
}

fn evaluate_hook(context: &HookContextV1, _payload: &[u8]) -> Result<HookDecisionV1> {
    require!(
        context.action <= LAST_SUPPORTED_ACTION,
        CustomHookError::UnknownAction
    );

    Ok(HookDecisionV1::allow_no_change())
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct HookContextV1 {
    pub action: u8,
    pub trade_direction: u8,
    pub amount_in: u64,
    pub amount_out: u64,
    pub reserve0: u64,
    pub reserve1: u64,
    pub swap_fee_bps: u16,
    pub fee_split_bps: u16,
    pub trunc_price0_q64: u128,
    pub deviation0_q64: u128,
    pub trunc_price1_q64: u128,
    pub deviation1_q64: u128,
}

impl HookContextV1 {
    pub const SERIALIZED_LEN: usize = 102;

    pub fn deserialize_with_payload(data: &[u8]) -> Result<(Self, &[u8])> {
        let mut remaining = data;
        let context = Self::deserialize(&mut remaining)
            .map_err(|_| error!(CustomHookError::InvalidInstructionData))?;

        Ok((context, remaining))
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct HookDecisionV1 {
    allow: u8,
    swap_fee_bps: u16,
    fee_split_bps: u16,
}

impl HookDecisionV1 {
    const fn allow_no_change() -> Self {
        Self {
            allow: 1,
            swap_fee_bps: HOOK_NO_CHANGE,
            fee_split_bps: HOOK_NO_CHANGE,
        }
    }

    fn to_return_data(self) -> [u8; HOOK_RESULT_LEN] {
        let mut data = [0u8; HOOK_RESULT_LEN];
        data[0] = self.allow;
        data[2..4].copy_from_slice(&self.swap_fee_bps.to_le_bytes());
        data[4..6].copy_from_slice(&self.fee_split_bps.to_le_bytes());
        data
    }
}

#[error_code]
pub enum CustomHookError {
    #[msg("Hook instruction data is not a valid HookContextV1")]
    InvalidInstructionData,
    #[msg("Hook action is not supported")]
    UnknownAction,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn context() -> HookContextV1 {
        HookContextV1 {
            action: 0,
            trade_direction: 1,
            amount_in: 10,
            amount_out: 9,
            reserve0: 100,
            reserve1: 200,
            swap_fee_bps: 30,
            fee_split_bps: 5_000,
            trunc_price0_q64: 1,
            deviation0_q64: 2,
            trunc_price1_q64: 3,
            deviation1_q64: 4,
        }
    }

    #[test]
    fn context_has_expected_wire_length() {
        let encoded = context().try_to_vec().expect("context should serialize");

        assert_eq!(encoded.len(), HookContextV1::SERIALIZED_LEN);
    }

    #[test]
    fn deserializer_preserves_initializer_payload() {
        let expected_context = context();
        let expected_payload = [7, 8, 9];
        let mut encoded = expected_context
            .try_to_vec()
            .expect("context should serialize");
        encoded.extend_from_slice(&expected_payload);

        let (decoded_context, decoded_payload) =
            HookContextV1::deserialize_with_payload(&encoded).expect("context should deserialize");

        assert_eq!(decoded_context, expected_context);
        assert_eq!(decoded_payload, expected_payload);
    }

    #[test]
    fn allow_no_change_has_expected_return_layout() {
        let result = HookDecisionV1::allow_no_change().to_return_data();

        assert_eq!(result.len(), HOOK_RESULT_LEN);
        assert_eq!(result[0], 1);
        assert_eq!(&result[2..4], &HOOK_NO_CHANGE.to_le_bytes());
        assert_eq!(&result[4..6], &HOOK_NO_CHANGE.to_le_bytes());
        assert!(result[6..].iter().all(|byte| *byte == 0));
    }

    #[test]
    fn malformed_context_is_rejected() {
        let result = HookContextV1::deserialize_with_payload(&[0u8; 16]);

        assert!(result.is_err());
    }

    #[test]
    fn unknown_action_is_rejected() {
        let mut invalid_context = context();
        invalid_context.action = LAST_SUPPORTED_ACTION + 1;

        assert!(evaluate_hook(&invalid_context, &[]).is_err());
    }
}
