import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import CardanoWasm from "@emurgo/cardano-serialization-lib-nodejs";
import dotenv from "dotenv";
dotenv.config();

const BLOCKFROST_PROJECT_ID = process.env.BLOCKFROST_PROJECT_ID;
const BLOCKFROST_BASE_URL = process.env.BLOCKFROST_BASE_URL || "https://cardano-preview.blockfrost.io/api/v0";

const blockfrost = new BlockFrostAPI({
  projectId: BLOCKFROST_PROJECT_ID,
  baseUrl: BLOCKFROST_BASE_URL,
});

export async function getProtocolParameters() {
  const latest = await blockfrost.epochsLatest();
  const params = await blockfrost.epochsParameters(latest.epoch);

  return {
    coinsPerUtxoByte: params.coins_per_utxo_size,
    priceMem: params.price_mem,
    priceStep: params.price_step,
    maxTxSize: params.max_tx_size,
    maxValSize: params.max_val_size,
    keyDeposit: params.key_deposit,
    poolDeposit: params.pool_deposit,
    collateralPercent: params.collateral_percent,
    maxCollateralInputs: params.max_collateral_inputs,
    minFeeA: params.min_fee_a,
    minFeeB: params.min_fee_b,
  };
}

export async function submitSignedTx(signedTxHex) {
  try {
    const txHash = await blockfrost.txSubmit(signedTxHex);
    return txHash;
  } catch (error) {
    console.error("❌ Blockfrost submit error:", error);
    const msg = error?.response?.data?.message || error?.message || JSON.stringify(error);
    throw new Error(msg);
  }
}

export async function buildUnsignedTxMetadata(senderAddressBech32, metadataObj) {
  // 1) Fetch UTxOs for the sender
  const utxos = await blockfrost.addressesUtxos(senderAddressBech32);
  if (!utxos || utxos.length === 0) {
    throw new Error("⚠️ No UTxOs found! Fund your preview wallet before building a transaction.");
  }

  // choose first UTxO with lovelace
  let chosen = null;
  for (const u of utxos) {
    const lovelace = u.amount.find(a => a.unit === "lovelace");
    if (lovelace && BigInt(lovelace.quantity) > 0n) {
      chosen = { tx_hash: u.tx_hash, tx_index: u.tx_index, amount: BigInt(lovelace.quantity) };
      break;
    }
  }
  if (!chosen) throw new Error("⚠️ No suitable UTxO found for this address.");

  const pp = await getProtocolParameters();

  const linearFee = CardanoWasm.LinearFee.new(
    CardanoWasm.BigNum.from_str(String(pp.minFeeA || 44)),
    CardanoWasm.BigNum.from_str(String(pp.minFeeB || 155381))
  );
  const coinsPerUtxoByte = CardanoWasm.BigNum.from_str(String(pp.coinsPerUtxoByte || 34482));
  const poolDeposit = CardanoWasm.BigNum.from_str(String(pp.poolDeposit || 0));
  const keyDeposit = CardanoWasm.BigNum.from_str(String(pp.keyDeposit || 0));
  const maxValueSize = pp.maxValSize || 5000;
  const maxTxSize = pp.maxTxSize || 16384;

  const txBuilderCfg = CardanoWasm.TransactionBuilderConfigBuilder.new()
    .fee_algo(linearFee)
    .pool_deposit(poolDeposit)
    .key_deposit(keyDeposit)
    .coins_per_utxo_byte(coinsPerUtxoByte)
    .max_value_size(maxValueSize)
    .max_tx_size(maxTxSize)
    .build();

  const txBuilder = CardanoWasm.TransactionBuilder.new(txBuilderCfg);

  // 2) Add input
  const inputTxHash = CardanoWasm.TransactionHash.from_bytes(Buffer.from(chosen.tx_hash, "hex"));
  txBuilder.add_input(
    CardanoWasm.Address.from_bech32(senderAddressBech32),
    CardanoWasm.TransactionInput.new(inputTxHash, chosen.tx_index),
    CardanoWasm.Value.new(CardanoWasm.BigNum.from_str(String(chosen.amount)))
  );

  // 3) Add minimal output (back to sender)
  const minUtxo = BigInt(pp.coinsPerUtxoByte || 34482) * 100n + 1000000n;
  const outputValue = CardanoWasm.Value.new(CardanoWasm.BigNum.from_str(String(minUtxo)));
  txBuilder.add_output(CardanoWasm.TransactionOutput.new(
    CardanoWasm.Address.from_bech32(senderAddressBech32),
    outputValue
  ));

  // 4) Add metadata
  const metadata = CardanoWasm.GeneralTransactionMetadata.new();
  const metaLabel = 674;
  const metadatum = CardanoWasm.encode_json_str_to_metadatum(JSON.stringify(metadataObj), CardanoWasm.MetadataJsonSchema.NoConversions);
  metadata.insert(CardanoWasm.BigNum.from_str(String(metaLabel)), metadatum);

  const auxiliaryData = CardanoWasm.AuxiliaryData.new();
  auxiliaryData.set_metadata(metadata);
  txBuilder.set_auxiliary_data(auxiliaryData);

  // 5) TTL
  const latestBlock = await blockfrost.blocksLatest();
  txBuilder.set_ttl((latestBlock.slot || 0) + 2000);

  // 6) Add change
  txBuilder.add_change_if_needed(CardanoWasm.Address.from_bech32(senderAddressBech32));

  // 7) Build unsigned tx
  const unsignedTx = txBuilder.build_tx();
  const txBodyHex = Buffer.from(unsignedTx.body().to_bytes()).toString("hex");

  return txBodyHex;
}
