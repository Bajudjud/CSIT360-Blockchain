import axios from "axios";

const BACKEND = process.env.REACT_APP_API_URL || "http://localhost:5000";

/**
 * Enable Lace Wallet
 */
export async function enableLace() {
  if (!window.cardano || !window.cardano.lace) {
    throw new Error("Lace Wallet not found. Install Lace and enable Preview mode.");
  }
  const api = await window.cardano.lace.enable();
  return api;
}

/**
 * Build unsigned tx -> sign -> submit -> return {txHash}
 */
export async function buildSignSubmitNoteHash(api, noteId, noteHash, walletAddress) {
  if (!api) throw new Error("Wallet API required");

  // 1) ask backend to build unsigned tx
  const buildResp = await axios.post(`${BACKEND}/buildUnsignedTx`, { noteId, hash: noteHash, walletAddress });
  const unsignedTxHex = buildResp.data.unsignedTxHex;
  if (!unsignedTxHex) throw new Error("Backend did not return unsignedTxHex");

  // 2) ask Lace to sign
  let signedTxHex;
  try {
    if (!api.signTx) throw new Error("Wallet does not expose signTx");
    signedTxHex = await api.signTx(unsignedTxHex, true);

    if (typeof signedTxHex !== "string") {
      if (signedTxHex instanceof Uint8Array || (signedTxHex && signedTxHex.data)) {
        signedTxHex = Buffer.from(signedTxHex).toString("hex");
      } else if (signedTxHex?.toString) {
        signedTxHex = signedTxHex.toString();
      } else {
        throw new Error("Unexpected signTx result shape");
      }
    }
  } catch (err) {
    console.error("Error signing tx with wallet:", err);
    throw err;
  }

  // 3) submit signed tx to backend
  const submitResp = await axios.post(`${BACKEND}/submitTx`, { signedTxHex, noteId });
  return submitResp.data; // { success: true, txHash }
}
