import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import * as Cardano from "@emurgo/cardano-serialization-lib-nodejs";

// IMPORT OUR CUSTOM MODULES
// Note: In ES Modules, you MUST include the .js extension
import db from './database.js';
import cardanoService from './cardanoService.js';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

// --- START WORKER ---
cardanoService.startBackgroundWorker(db);

// --- NOTE ROUTES ---

app.get("/api/notes", (req, res) => {
  res.json(db.getAll());
});

app.post("/api/notes", (req, res) => {
  const newNote = {
    id: Date.now(),
    ...req.body,
    status: 'pending',
    created_at: new Date().toISOString()
  };
  db.add(newNote);
  res.json(newNote);
});

app.put("/api/notes/:id", (req, res) => {
  const updated = db.update(req.params.id, req.body);
  if (updated) res.json(updated);
  else res.status(404).json({ error: "Note not found" });
});

app.delete("/api/notes/:id", (req, res) => {
  db.delete(req.params.id);
  res.json({ success: true });
});

// --- BLOCKCHAIN ENDPOINTS ---

app.post("/api/build-transaction", async (req, res) => {
  try {
    const { changeAddress, utxos, meta } = req.body;

    const txBuilderConfig = Cardano.TransactionBuilderConfigBuilder.new()
      .fee_algo(Cardano.LinearFee.new(Cardano.BigNum.from_str("44"), Cardano.BigNum.from_str("155381")))
      .pool_deposit(Cardano.BigNum.from_str("500000000"))
      .key_deposit(Cardano.BigNum.from_str("2000000"))
      .max_value_size(5000)
      .max_tx_size(16384)
      .coins_per_utxo_byte(Cardano.BigNum.from_str("4310"))
      .build();

    const txBuilder = Cardano.TransactionBuilder.new(txBuilderConfig);
    const txUnspentOutputs = Cardano.TransactionUnspentOutputs.new();
    utxos.forEach((utxoHex) => txUnspentOutputs.add(Cardano.TransactionUnspentOutput.from_bytes(Buffer.from(utxoHex, "hex"))));
    txBuilder.add_inputs_from(txUnspentOutputs, 1);

    const metadata = Cardano.GeneralTransactionMetadata.new();
    const notePayload = {
      app: "NoteBuddy",
      op: meta.action,
      title: meta.title ? meta.title.substring(0, 50) : "No Title",
    };
    metadata.insert(
      Cardano.BigNum.from_str("674"),
      Cardano.encode_json_str_to_metadatum(JSON.stringify(notePayload), 0)
    );
    txBuilder.set_metadata(metadata);

    const changeAddr = Cardano.Address.from_bytes(Buffer.from(changeAddress, "hex"));
    txBuilder.add_change_if_needed(changeAddr);

    const tx = txBuilder.build_tx(); 
    res.json({ cborHex: Buffer.from(tx.to_bytes()).toString("hex") });

  } catch (err) {
    console.error("Tx Build Error:", err);
    res.status(500).json({ error: err.toString() });
  }
});

app.post("/api/assemble-transaction", async (req, res) => {
  try {
    const { txCbor, witnessCbor } = req.body;
    const tx = Cardano.Transaction.from_bytes(Buffer.from(txCbor, "hex"));
    const witnessSet = Cardano.TransactionWitnessSet.from_bytes(Buffer.from(witnessCbor, "hex"));
    const signedTx = Cardano.Transaction.new(tx.body(), witnessSet, tx.auxiliary_data());
    res.json({ signedTxHex: Buffer.from(signedTx.to_bytes()).toString("hex") });
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});