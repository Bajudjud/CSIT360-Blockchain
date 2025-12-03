import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import * as Cardano from "@emurgo/cardano-serialization-lib-nodejs";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- DATABASE SETUP ---
const dbFile = path.join(__dirname, 'notes-data.json');

const loadDB = () => {
  if (!fs.existsSync(dbFile)) return [];
  try { return JSON.parse(fs.readFileSync(dbFile, 'utf8')); } 
  catch (e) { return []; }
};

const saveDB = (data) => {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
};

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

// --- ROUTES ---

app.get("/api/notes", (req, res) => {
  const notes = loadDB();
  res.json(notes.sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt)));
});

app.post("/api/notes", (req, res) => {
  const notes = loadDB();
  const newNote = {
    id: Date.now(),
    ...req.body,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  notes.unshift(newNote);
  saveDB(notes);
  res.json(newNote);
});

app.put("/api/notes/:id", (req, res) => {
  let notes = loadDB();
  const index = notes.findIndex(n => n.id == req.params.id);
  if (index !== -1) {
    notes[index] = { ...notes[index], ...req.body, updated_at: new Date().toISOString() };
    saveDB(notes);
    res.json(notes[index]);
  } else {
    res.status(404).json({ error: "Note not found" });
  }
});

app.delete("/api/notes/:id", (req, res) => {
  let notes = loadDB();
  notes = notes.filter(n => n.id != req.params.id);
  saveDB(notes);
  res.json({ success: true });
});

// --- CARDANO TRANSACTION ENDPOINTS ---

// 1. BUILD: Creates the transaction body
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
    utxos.forEach((utxoHex) => {
      txUnspentOutputs.add(Cardano.TransactionUnspentOutput.from_bytes(Buffer.from(utxoHex, "hex")));
    });

    txBuilder.add_inputs_from(txUnspentOutputs, 1);

    const metadata = Cardano.GeneralTransactionMetadata.new();
    const notePayload = {
      app: "NoteBuddy",
      op: meta.action,
      title: meta.title ? meta.title.substring(0, 50) : "No Title",
      content: meta.content ? meta.content.substring(0, 60) + "..." : "", 
    };
    
    metadata.insert(
      Cardano.BigNum.from_str("674"),
      Cardano.encode_json_str_to_metadatum(JSON.stringify(notePayload), 0)
    );
    txBuilder.set_metadata(metadata);

    const changeAddr = Cardano.Address.from_bytes(Buffer.from(changeAddress, "hex"));
    txBuilder.add_change_if_needed(changeAddr);

    const tx = txBuilder.build_tx(); 
    const cborHex = Buffer.from(tx.to_bytes()).toString("hex");

    res.json({ cborHex });
  } catch (err) {
    console.error("Tx Build Error:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// 2. ASSEMBLE: Combines the body + the signature you made in frontend
app.post("/api/assemble-transaction", async (req, res) => {
  try {
    const { txCbor, witnessCbor } = req.body;

    // Load the original transaction
    const tx = Cardano.Transaction.from_bytes(Buffer.from(txCbor, "hex"));
    
    // Load the witness set (signature) from frontend
    const witnessSet = Cardano.TransactionWitnessSet.from_bytes(Buffer.from(witnessCbor, "hex"));

    // Combine them into a new Signed Transaction
    const signedTx = Cardano.Transaction.new(
      tx.body(),
      witnessSet,
      tx.auxiliary_data() // Don't forget the metadata!
    );

    const signedTxHex = Buffer.from(signedTx.to_bytes()).toString("hex");
    res.json({ signedTxHex });
  } catch (err) {
    console.error("Tx Assemble Error:", err);
    res.status(500).json({ error: err.toString() });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});