const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    message: 'Accounts API',
    routes: ['/api/accounts', '/api/accounts/:id']
  });
});

module.exports = router;
