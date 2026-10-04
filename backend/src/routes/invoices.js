const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    message: 'Invoices API',
    routes: ['/api/invoices', '/api/invoices/:id']
  });
});

module.exports = router;
