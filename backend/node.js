import express from "express";
import * as Cardano from "@emurgo/cardano-serialization-lib-nodejs";

const router = express.Router();

router.post("/build-transaction", async (req, res) => {
  try {
    const { changeAddress, utxos, meta } = req.body;

    const addr = Cardano.Address.from_bytes(Buffer.from(changeAddress, "hex"));

    const txBuilder = Cardano.TransactionBuilder.new(
      Cardano.LinearFee.new(
        Cardano.BigNum.from_str("44"),
        Cardano.BigNum.from_str("155381")
      ),
      Cardano.BigNum.from_str("1000000"),
      Cardano.BigNum.from_str("500000000"),
      Cardano.BigNum.from_str("2000000")
    );

    // Load UTXOs from wallet
    for (const u of utxos) {
      const utxo = Cardano.TransactionUnspentOutput.from_bytes(
        Buffer.from(u, "hex")
      );
      txBuilder.add_input(
        utxo.output().address(),
        utxo.input(),
        utxo.output().amount()
      );
    }

    // Output to yourself — minimal tx
    txBuilder.add_output(
      Cardano.TransactionOutput.new(
        addr,
        Cardano.Value.new(Cardano.BigNum.from_str("2000000"))
      )
    );

    // Add metadata (title + content)
    const auxMeta = Cardano.AuxiliaryData.new();
    const metadata = Cardano.GeneralTransactionMetadata.new();

    metadata.insert(
      Cardano.BigNum.from_str("674"),
      Cardano.encode_json_str_to_metadatum(JSON.stringify(meta), 0)
    );

    auxMeta.set_metadata(metadata);
    txBuilder.set_auxiliary_data(auxMeta);

    // Add change output
    txBuilder.add_change_if_needed(addr);

    // Build tx body
    const txBody = txBuilder.build();

    // Combine tx + metadata
    const tx = Cardano.Transaction.new(
      txBody,
      Cardano.TransactionWitnessSet.new(),
      auxMeta
    );

    const cborHex = Buffer.from(tx.to_bytes()).toString("hex");

    res.json({ cborHex });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.toString() });
  }
});

export default router;
