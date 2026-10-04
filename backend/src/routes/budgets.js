const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    message: 'Budgets API',
    routes: ['/api/budgets', '/api/budgets/:id']
  });
});

module.exports = router;
