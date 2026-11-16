const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/login', authController.getLoginPage);
router.post('/login', authController.postLogin);
router.post('/register', authController.postRegister);
router.get('/demo-login/:role', authController.getDemoLogin);
router.get('/logout', authController.getLogout);

module.exports = router;
