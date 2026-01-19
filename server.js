const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.get('/api/bookings', (req, res) => {
    db.getAllBookings((err, bookings) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(bookings);
    });
});

app.get('/api/available-slots/:day', (req, res) => {
    const { day } = req.params;
    const validDays = ['Monday', 'Wednesday', 'Friday'];
    if (!validDays.includes(day)) {
        return res.status(400).json({ error: 'Invalid day' });
    }
    db.getAvailableSlots(day, (err, slots) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ day, slots });
    });
});

app.post('/api/bookings', (req, res) => {
    const { student_name, meeting_type, day, time } = req.body;
    
    if (!student_name || !meeting_type || !day || !time) {
        return res.status(400).json({ error: 'All fields required' });
    }
    
    const validDays = ['Monday', 'Wednesday', 'Friday'];
    if (!validDays.includes(day)) {
        return res.status(400).json({ error: 'Invalid day' });
    }
    
    const validTypes = ['face-to-face', 'zoom'];
    if (!validTypes.includes(meeting_type)) {
        return res.status(400).json({ error: 'Invalid meeting type' });
    }
    
    const booking = { student_name, meeting_type, day, time };
    db.createBooking(booking, (err, newBooking) => {
        if (err) {
            if (err.message === 'Time slot already booked') {
                return res.status(409).json({ error: 'Time slot already booked' });
            }
            res.status(500).json({ error: err.message });
        } else {
            res.status(201).json(newBooking);
        }
    });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});