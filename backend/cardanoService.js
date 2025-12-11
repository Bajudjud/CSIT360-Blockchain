import { BlockFrostAPI } from '@blockfrost/blockfrost-js';

class CardanoService {
  constructor() {
    this.API = new BlockFrostAPI({
      projectId: 'previewooSWJR3mIJrNH5oQgMERTwz5uYGa90fu', 
    });
    
    console.log("✅ Cardano Service Initialized");
  }

  startBackgroundWorker(db) {
    console.log("👷 Background Worker Started");

    setInterval(async () => {
      try {
        const pendingNotes = db.getPending();
        if (pendingNotes.length === 0) return;

        console.log(`🔍 Checking ${pendingNotes.length} pending transactions...`);

        for (const note of pendingNotes) {
          if (note.blockchain && note.blockchain.txHash) {
             await this.checkTransaction(note.blockchain.txHash, db);
          }
        }
      } catch (error) {
        console.error("Worker Error:", error.message);
      }
    }, 20000); 
  }

  async checkTransaction(txHash, db) {
    try {
      const tx = await this.API.txs(txHash);
      if (tx && tx.hash) {
        console.log(`🎉 Transaction Confirmed: ${txHash}`);
        db.updateStatus(txHash, 'confirmed');
      }
    } catch (error) {
      if (error.statusCode !== 404) {
        console.error(`Error checking ${txHash}:`, error.message);
      }
    }
  }
}

export default new CardanoService();