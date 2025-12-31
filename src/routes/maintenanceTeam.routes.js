const express = require('express');
const router = express.Router();
const maintenanceTeamController = require('../controllers/maintenanceTeam.controller');

// Authentication routes
router.post('/login', maintenanceTeamController.login);

// User management routes
router.post('/add', maintenanceTeamController.addUser);
router.get('/', maintenanceTeamController.getAllUsers);
router.get('/:id', maintenanceTeamController.getUserById);
router.put('/:id', maintenanceTeamController.updateUser);
router.put('/:id/change-password', maintenanceTeamController.changePassword);

module.exports = router;