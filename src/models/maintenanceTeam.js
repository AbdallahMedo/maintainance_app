const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const MaintenanceTeam = sequelize.define('MaintenanceTeam', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // كل يوزر لازم رقم موبايل فريد
  },
  role: {
    type: DataTypes.ENUM('admin', 'technician', 'reviewer'),
    allowNull: false,
  },
}, {
  tableName: 'maintenanceTeam',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = MaintenanceTeam;
