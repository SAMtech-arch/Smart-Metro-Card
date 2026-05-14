const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');

// Helper function for fare calculation
function calculateFare(entryStation, exitStation) {
  const stationDistances = {
    'MG Road': 0,
    'Jayanagar': 15,
    'Indiranagar': 4,
    'Koramangala': 7,
    'Whitefield': 20
  };

  const entryDistance = stationDistances[entryStation] || 0;
  const exitDistance = stationDistances[exitStation] || 0;
  const distance = Math.abs(exitDistance - entryDistance);
  
  // Base fare + distance fare (₹10 base + ₹2 per km)
  return 10 + (distance * 2);
}

// Login Route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Remove sensitive data before sending response
    const userData = user.toObject();
    delete userData.password;
    delete userData.__v;

    res.json({ 
      message: 'Login successful',
      user: userData
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Signup Route
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password, name } = req.body;
    
    if (!username?.trim()) {
      return res.status(400).json({ message: 'Username is required' });
    }
    if (!email?.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(409).json({ 
        message: existingUser.email === email 
          ? 'Email already in use' 
          : 'Username already taken'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      name: name?.trim() || ''
    });

    await newUser.save();
    
    const userData = newUser.toObject();
    delete userData.password;
    delete userData.__v;

    res.status(201).json({ 
      message: 'User created successfully',
      user: userData
    });
  } catch (error) {
    console.error('Signup error:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: 'Validation failed', errors });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user data
router.get('/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const userData = user.toObject();
    delete userData.password;
    delete userData.__v;

    res.json(userData);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Recharge balance
router.post('/recharge', async (req, res) => {
  try {
    const { email, amount } = req.body;
    if (!email || !amount) {
      return res.status(400).json({ error: 'Email and amount are required' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    user.balance += amount;
    user.transactions.push({
      type: 'recharge',
      amount: amount,
      description: `Wallet recharge of ₹${amount}`
    });

    await user.save();
    
    res.json({ 
      message: 'Recharged successfully', 
      balance: user.balance 
    });
  } catch (error) {
    console.error('Recharge error:', error);
    res.status(500).json({ error: 'Recharge failed' });
  }
});

// Entry station
router.post('/entry', async (req, res) => {
  try {
    const { email, station } = req.body;
    if (!email || !station) {
      return res.status(400).json({ error: 'Email and station are required' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.entryStation = station;
    await user.save();
    
    res.json({ 
      message: 'Entry station recorded',
      entryStation: station
    });
  } catch (error) {
    console.error('Entry error:', error);
    res.status(500).json({ error: 'Entry failed' });
  }
});

// Exit station
router.post('/exit', async (req, res) => {
  try {
    const { email, station, entryStation } = req.body;
    if (!email || !station || !entryStation) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.entryStation !== entryStation) {
      return res.status(400).json({ 
        error: 'Entry station mismatch',
        recordedEntry: user.entryStation,
        receivedEntry: entryStation
      });
    }

    const fare = calculateFare(entryStation, station);
    if (user.balance < fare) {
      return res.status(400).json({ 
        error: 'Insufficient balance',
        currentBalance: user.balance,
        requiredFare: fare
      });
    }

    user.balance -= fare;
    user.transactions.push({
      type: 'fare',
      amount: -fare,
      description: `Fare from ${entryStation} to ${station}`
    });
    user.entryStation = null;

    await user.save();
    
    res.json({ 
      message: 'Exit recorded successfully',
      fare: fare,
      balance: user.balance
    });
  } catch (error) {
    console.error('Exit error:', error);
    res.status(500).json({ error: 'Exit failed' });
  }
});

// Get transactions
router.get('/:email/transactions', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(user.transactions || []);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;