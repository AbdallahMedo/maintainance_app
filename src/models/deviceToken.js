// models/deviceToken.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const DeviceToken = sequelize.define('DeviceToken', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id'
  },
  userType: {
    type: DataTypes.ENUM('client', 'technician', 'admin'),
    allowNull: false,
    field: 'user_type'
  },
  token: {
    type: DataTypes.STRING(500),
    allowNull: false,
    unique: true
  },
deviceInfo: {
  type: DataTypes.TEXT('nvarchar'), // أو STRING('MAX')
  allowNull: true,
  field: 'device_info',
  get() {
    const rawValue = this.getDataValue('deviceInfo');
    return rawValue ? JSON.parse(rawValue) : null;
  },
  set(value) {
    this.setDataValue(
      'deviceInfo',
      value ? JSON.stringify(value) : null
    );
  }
},
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  lastUsedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'last_used_at'
  }
}, {
  tableName: 'device_tokens',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['user_id', 'user_type']
    },
    {
      fields: ['token']
    }
  ]
});

module.exports = DeviceToken;