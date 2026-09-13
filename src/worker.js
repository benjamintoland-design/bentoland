import core from './index.js';
import {handleJournalRequest} from './journal.js';

export default {
  async fetch(request, env, ctx) {
    const journalResponse = await handleJournalRequest(request, env);
    if (journalResponse) return journalResponse;
    return core.fetch(request, env, ctx);
  }
};
