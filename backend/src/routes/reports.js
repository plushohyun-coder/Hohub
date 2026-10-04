const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    message: 'Reports API',
    routes: ['/api/reports/summary', '/api/reports/trial-balance']
  });
});

module.exports = router;
