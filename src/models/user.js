const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  name: {
    type: DataTypes.STRING,
    allowNull: false
  },

  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },

  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },

  authProvider: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'local',
    validate: {
      isIn: [['local', 'google']]
    }
  },

  password: {
    type: DataTypes.STRING,
    allowNull: true
  },

  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }

}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = User;
