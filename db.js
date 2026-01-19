const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
    constructor() {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        const dbPath = path.join(dataDir, 'bookings.db');
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) console.error('Database error:', err.message);
            else this.initializeDatabase();
        });
    }

    initializeDatabase() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_name TEXT NOT NULL,
                meeting_type TEXT NOT NULL CHECK(meeting_type IN ('face-to-face', 'zoom')),
                day TEXT NOT NULL,
                time TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(day, time)
            )
        `);
    }

    getAllBookings(callback) {
        this.db.all('SELECT * FROM bookings ORDER BY day, time', callback);
    }

    getBookingsByDay(day, callback) {
        this.db.all('SELECT * FROM bookings WHERE day = ? ORDER BY time', [day], callback);
    }

    isSlotAvailable(day, time, callback) {
        this.db.get(
            'SELECT COUNT(*) as count FROM bookings WHERE day = ? AND time = ?',
            [day, time],
            (err, row) => callback(err, row ? row.count === 0 : true)
        );
    }

    createBooking(booking, callback) {
        const { student_name, meeting_type, day, time } = booking;
        this.isSlotAvailable(day, time, (err, isAvailable) => {
            if (err) return callback(err);
            if (!isAvailable) return callback(new Error('Time slot already booked'));
            
            this.db.run(
                'INSERT INTO bookings (student_name, meeting_type, day, time) VALUES (?, ?, ?, ?)',
                [student_name, meeting_type, day, time],
                function(err) {
                    if (err) callback(err);
                    else callback(null, { id: this.lastID, ...booking });
                }
            );
        });
    }

    getAvailableSlots(day, callback) {
        const startTime = 5 * 60;
        const endTime = 7.5 * 60;
        const slotDuration = 15;
        
        this.getBookingsByDay(day, (err, bookings) => {
            if (err) return callback(err);
            
            const bookedTimes = new Set(bookings.map(b => b.time));
            const availableSlots = [];
            
            for (let time = startTime; time < endTime; time += slotDuration) {
                const hours = Math.floor(time / 60);
                const minutes = time % 60;
                const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                if (!bookedTimes.has(timeStr)) availableSlots.push(timeStr);
            }
            
            callback(null, availableSlots);
        });
    }
}

Database.prototype.getDb = function() {
    return this.db;
};

module.exports = new Database();