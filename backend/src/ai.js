const express = require('express');

// Connects plus-erp-ai-client to this ERP. The AI client reads ERP data only through the
// read-only internal API at erpBaseUrl, so it sees exactly what the ERP serves.
// The returned router is mounted behind login by app.js.
const createAiRouter = ({ erpBaseUrl }) => {
  let aiClient;
  try {
    aiClient = require('plus-erp-ai-client');
  } catch (error) {
    console.warn('plus-erp-ai-client is not installed; AI assistant disabled');
    const router = express.Router();
    router.get('/status', (req, res) => res.json({ enabled: false, model: null }));
    router.post('/chat', (req, res) => res.status(503).json({ message: 'AI assistant is not installed' }));
    return router;
  }

  const { router, assistant } = aiClient.connectErp({ erpBaseUrl });
  console.log(assistant ? `AI assistant enabled (${assistant.model})` : 'AI assistant disabled: set ANTHROPIC_API_KEY to enable');
  return router;
};

module.exports = { createAiRouter };
