const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['recharge', 'fare'], 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  date: { 
    type: Date, 
    default: Date.now 
  }
}, { _id: false });

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  entryStation: {
    type: String,
    default: null
  },
  transactions: {
    type: [TransactionSchema],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);