const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Sequelize } = require('sequelize');
const MaintenanceTeam = require('../models/maintenanceTeam');

// ========================= Login =========================
exports.login = async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;

    if (!emailOrPhone || !password) {
      return res.status(400).json({ message: 'Email/Phone and password are required' });
    }

    const user = await MaintenanceTeam.findOne({
      where: {
        [Sequelize.Op.or]: [
          { email: emailOrPhone },
          { phone: emailOrPhone }
        ]
      }
    });

    if (!user) return res.status(401).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Wrong credentials' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email || null,
        phone: user.phone || null,
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ========================= Add User =========================
exports.addUser = async (req, res) => {
  try {
    const { name, password, phone, role } = req.body;

    // تحقق من وجود كل البيانات المطلوبة
    if (!name || !password || !phone || !role) {
      return res.status(400).json({ message: 'Name, password, phone, and role are required' });
    }

    // تحقق من صحة role
    const validRoles = ['admin', 'technician', 'reviewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const hash = await bcrypt.hash(password, 10);
    const userData = { name, password: hash, phone, role };

    // إضافة المستخدم
    const user = await MaintenanceTeam.create(userData);

    res.json({ message: 'User added successfully', user });

  } catch (err) {
    console.error(err);

    // معالجة خطأ التكرار
    if (err.name === 'SequelizeUniqueConstraintError') {
      // تحديد الحقل اللي سبب الخطأ
      const field = err.errors[0].path;
      return res.status(400).json({ message: `${field} already exists` });
    }

    res.status(500).json({ message: 'Internal server error' });
  }
};

// ========================= Get All Users =========================
exports.getAllUsers = async (req, res) => {
  try {
    const users = await MaintenanceTeam.findAll({
      attributes: ['id', 'name', 'email', 'phone', 'role', 'created_at']
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
// ========================= Update User Info =========================
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone } = req.body;
    
    if (!name || !phone) {
      return res.status(400).json({ message: 'Name and phone are required' });
    }

    const user = await MaintenanceTeam.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if phone is being changed and if it already exists for another user
    if (phone !== user.phone) {
      const existingUser = await MaintenanceTeam.findOne({
        where: { phone }
      });
      if (existingUser && existingUser.id !== parseInt(id)) {
        return res.status(400).json({ message: 'Phone number already exists' });
      }
    }

    // Update user info (excluding role)
    await user.update({
      name,
      phone
    });

    res.json({ 
      message: 'User updated successfully',
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role
      }
    });

  } catch (err) {
    console.error(err);
    
    if (err.name === 'SequelizeUniqueConstraintError') {
      const field = err.errors[0].path;
      return res.status(400).json({ message: `${field} already exists` });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ========================= Change Password =========================
exports.changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    const user = await MaintenanceTeam.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hash = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await user.update({ password: hash });

    res.json({ message: 'Password changed successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ========================= Get Single User =========================
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await MaintenanceTeam.findByPk(id, {
      attributes: ['id', 'name', 'email', 'phone', 'role', 'created_at']
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
