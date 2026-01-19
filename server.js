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
// Admin route to view/delete bookings
app.get('/admin', (req, res) => {
    const adminKey = process.env.ADMIN_KEY || 'admin123'; // Change this!
    const { key } = req.query;
    
    if (key !== adminKey) {
        return res.status(403).send('Access denied');
    }
    
    db.getAllBookings((err, bookings) => {
        if (err) {
            return res.status(500).send('Database error');
        }
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin - Booking System</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .delete-btn { color: red; cursor: pointer; }
            </style>
        </head>
        <body>
            <h1>Booking System Admin</h1>
            <p>Total bookings: ${bookings.length}</p>
            <table>
                <tr>
                    <th>ID</th>
                    <th>Student Name</th>
                    <th>Type</th>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Created At</th>
                    <th>Actions</th>
                </tr>
                ${bookings.map(booking => `
                <tr>
                    <td>${booking.id}</td>
                    <td>${booking.student_name}</td>
                    <td>${booking.meeting_type}</td>
                    <td>${booking.day}</td>
                    <td>${booking.time}</td>
                    <td>${new Date(booking.created_at).toLocaleString()}</td>
                    <td>
                        <span class="delete-btn" onclick="deleteBooking(${booking.id})">Delete</span>
                    </td>
                </tr>
                `).join('')}
            </table>
            <script>
                async function deleteBooking(id) {
                    if (confirm('Delete this booking?')) {
                        const response = await fetch('/api/bookings/' + id, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' }
                        });
                        if (response.ok) {
                            location.reload();
                        } else {
                            alert('Delete failed');
                        }
                    }
                }
            </script>
        </body>
        </html>
        `;
        
        res.send(html);
    });
});

// Add DELETE endpoint
app.delete('/api/bookings/:id', (req, res) => {
    const { id } = req.params;
    
    // Simple auth check (in production, use proper auth)
    const adminKey = process.env.ADMIN_KEY || 'admin123';
    const { key } = req.query;
    
    if (key !== adminKey) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    db.getDb().run('DELETE FROM bookings WHERE id = ?', [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ success: true, deletedId: id });
        }
    });
});