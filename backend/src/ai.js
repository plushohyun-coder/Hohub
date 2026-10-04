const express = require('express');

// Connects plus-erp-ai-client to this ERP. The AI client reads ERP data only
// through this server's own /api endpoints, so it sees exactly what the ERP serves.
const mountAiAssistant = (app, { port }) => {
  let aiClient;
  try {
    aiClient = require('plus-erp-ai-client');
  } catch (error) {
    console.warn('plus-erp-ai-client is not installed; AI assistant disabled');
    const router = express.Router();
    router.get('/status', (req, res) => res.json({ enabled: false, model: null }));
    router.post('/chat', (req, res) => res.status(503).json({ message: 'AI assistant is not installed' }));
    app.use('/api/ai', router);
    return;
  }

  const erpBaseUrl = process.env.ERP_API_BASE_URL || `http://127.0.0.1:${port}/api`;
  const { router, assistant } = aiClient.connectErp({ erpBaseUrl });
  app.use('/api/ai', router);
  console.log(assistant ? `AI assistant enabled (${assistant.model})` : 'AI assistant disabled: set ANTHROPIC_API_KEY to enable');
};

module.exports = { mountAiAssistant };
