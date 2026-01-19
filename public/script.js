class BookingSystem {
    constructor() {
        this.baseUrl = window.location.origin;
        
        this.currentStep = 'step-name';
        this.bookingData = {
            studentName: '',
            meetingType: '',
            day: '',
            time: ''
        };
        
        console.log('📡 Using API URL:', this.baseUrl);
        this.init();
    }

    init() {
        this.bindEvents();
        this.showStep('step-name');
        this.checkBackendHealth();
    }

    bindEvents() {
        // Name step
        document.getElementById('next-name').addEventListener('click', () => this.validateName());
        document.getElementById('studentName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.validateName();
        });

        // Type step
        document.querySelectorAll('.type-option').forEach(option => {
            option.addEventListener('click', (e) => this.selectMeetingType(e));
        });
        document.getElementById('back-type').addEventListener('click', () => this.showStep('step-name'));

        // Day step
        document.querySelectorAll('.day-option:not(.disabled)').forEach(option => {
            option.addEventListener('click', (e) => this.selectDay(e));
        });
        document.getElementById('back-day').addEventListener('click', () => this.showStep('step-type'));

        // Time step
        document.getElementById('back-time').addEventListener('click', () => this.showStep('step-day'));

        // Confirmation step
        document.getElementById('back-confirm').addEventListener('click', () => this.showStep('step-time'));
        document.getElementById('confirm-booking').addEventListener('click', () => this.submitBooking());

        // Success step
        document.getElementById('new-booking').addEventListener('click', () => this.resetForm());
    }

    async checkBackendHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/api/health`);
            const data = await response.json();
            console.log('✅ Backend health check:', data);
        } catch (error) {
            console.warn('⚠️ Backend health check failed:', error.message);
        }
    }

    showStep(stepId) {
        // Hide all steps
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('active');
        });

        // Show requested step
        document.getElementById(stepId).classList.add('active');
        this.currentStep = stepId;

        // Update step content if needed
        if (stepId === 'step-confirm') {
            this.updateConfirmation();
        }
        
        // Focus on input if it's the name step
        if (stepId === 'step-name') {
            setTimeout(() => {
                document.getElementById('studentName').focus();
            }, 100);
        }
    }

    validateName() {
        const nameInput = document.getElementById('studentName');
        const errorElement = document.getElementById('name-error');
        const name = nameInput.value.trim();

        // Reset error
        errorElement.classList.remove('show');

        if (name.length < 2) {
            errorElement.textContent = 'Please enter your full name (minimum 2 characters)';
            errorElement.classList.add('show');
            nameInput.focus();
            return;
        }

        if (!/^[a-zA-Z\s]{2,50}$/.test(name)) {
            errorElement.textContent = 'Please enter a valid name (letters and spaces only)';
            errorElement.classList.add('show');
            nameInput.focus();
            return;
        }

        // Valid name
        this.bookingData.studentName = name;
        this.showStep('step-type');
    }

    selectMeetingType(event) {
        const type = event.currentTarget.dataset.type;
        
        // Remove selection from all type options
        document.querySelectorAll('.type-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Add selection to clicked option
        event.currentTarget.classList.add('selected');
        this.bookingData.meetingType = type;
        
        // Show day selection after a brief delay for visual feedback
        setTimeout(() => {
            this.showStep('step-day');
        }, 300);
    }

    selectDay(event) {
        const day = event.currentTarget.dataset.day;
        
        // Remove selection from all day options
        document.querySelectorAll('.day-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Add selection to clicked option
        event.currentTarget.classList.add('selected');
        this.bookingData.day = day;
        
        // Update time slot display
        document.getElementById('selected-day-time').textContent = 
            `Loading available time slots for ${day}...`;
        
        this.showStep('step-time');
        this.loadTimeSlots(day);
    }

    async loadTimeSlots(day) {
        const timeSlotsContainer = document.getElementById('time-slots');
        
        // Show loading state
        timeSlotsContainer.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading available slots...</p>
                <p class="small-note">(Please wait, this might take a moment)</p>
            </div>
        `;

        try {
            // Add timeout for slow waking backend
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
            
            const response = await fetch(`${this.baseUrl}/api/available-slots/${day}`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            this.displayTimeSlots(data.slots);
            
            const slotCount = data.slots.length;
            document.getElementById('selected-day-time').textContent = 
                `Available slots for ${day} (${slotCount} slot${slotCount !== 1 ? 's' : ''} available)`;
                
        } catch (error) {
            console.error('Error loading time slots:', error);
            
            if (error.name === 'AbortError') {
                timeSlotsContainer.innerHTML = `
                    <div class="error">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Backend is taking too long to respond.</p>
                        <p>Render.com free tier sleeps after 15 minutes of inactivity.</p>
                        <p>Please wait 30-60 seconds and try again.</p>
                        <button onclick="bookingSystem.loadTimeSlots('${day}')" class="btn-secondary">
                            <i class="fas fa-redo"></i> Try Again
                        </button>
                    </div>
                `;
            } else {
                timeSlotsContainer.innerHTML = `
                    <div class="error">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Failed to load time slots: ${error.message}</p>
                        <p>Please check your internet connection or try again later.</p>
                        <button onclick="bookingSystem.loadTimeSlots('${day}')" class="btn-secondary">
                            <i class="fas fa-redo"></i> Retry
                        </button>
                    </div>
                `;
            }
        }
    }

    displayTimeSlots(slots) {
        const timeSlotsContainer = document.getElementById('time-slots');
        timeSlotsContainer.innerHTML = '';

        if (!slots || slots.length === 0) {
            timeSlotsContainer.innerHTML = `
                <div class="no-slots">
                    <i class="fas fa-calendar-times"></i>
                    <p>No available slots for this day.</p>
                    <p>All time slots (5:00 AM - 7:30 AM) are already booked.</p>
                    <p>Please select another day.</p>
                </div>
            `;
            return;
        }

        // Sort slots chronologically
        const sortedSlots = slots.sort((a, b) => {
            const timeA = this.timeToMinutes(a);
            const timeB = this.timeToMinutes(b);
            return timeA - timeB;
        });

        sortedSlots.forEach(slot => {
            const slotElement = document.createElement('button');
            slotElement.className = 'time-slot';
            slotElement.textContent = this.formatTimeForDisplay(slot);
            slotElement.dataset.time = slot;
            slotElement.title = `Book ${this.formatTimeForDisplay(slot)} slot`;
            
            slotElement.addEventListener('click', () => this.selectTimeSlot(slot));
            
            timeSlotsContainer.appendChild(slotElement);
        });
    }

    timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    selectTimeSlot(time) {
        // Remove selection from all time slots
        document.querySelectorAll('.time-slot').forEach(slot => {
            slot.classList.remove('selected');
        });

        // Add selection to clicked slot
        const selectedSlot = document.querySelector(`[data-time="${time}"]`);
        if (selectedSlot) {
            selectedSlot.classList.add('selected');
        }

        this.bookingData.time = time;
        
        // Show confirmation after a brief delay
        setTimeout(() => {
            this.showStep('step-confirm');
        }, 300);
    }

    updateConfirmation() {
        document.getElementById('confirm-name').textContent = this.bookingData.studentName;
        document.getElementById('confirm-type').textContent = 
            this.bookingData.meetingType === 'face-to-face' ? 'Face-to-Face Meeting' : 'Zoom Meeting';
        document.getElementById('confirm-day').textContent = this.bookingData.day;
        document.getElementById('confirm-time').textContent = this.formatTimeForDisplay(this.bookingData.time);
    }

    async submitBooking() {
        const confirmBtn = document.getElementById('confirm-booking');
        const originalText = confirmBtn.innerHTML;
        const originalDisabled = confirmBtn.disabled;
        
        // Show loading state
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing Booking...';
        confirmBtn.disabled = true;

        try {
            const response = await fetch(`${this.baseUrl}/api/bookings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    student_name: this.bookingData.studentName,
                    meeting_type: this.bookingData.meetingType,
                    day: this.bookingData.day,
                    time: this.bookingData.time
                })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 409) {
                    throw new Error('This time slot was just booked by someone else. Please select another slot.');
                }
                throw new Error(data.error || `Booking failed (HTTP ${response.status})`);
            }

            // Show success message
            this.showSuccess(data);
            
        } catch (error) {
            // Show error message to user
            alert(`❌ Booking Failed\n\n${error.message}`);
            console.error('Booking error:', error);
            
            // If it's a slot conflict, go back to time selection
            if (error.message.includes('time slot') || error.message.includes('already booked')) {
                this.showStep('step-time');
                this.loadTimeSlots(this.bookingData.day);
            }
            
        } finally {
            // Restore button state
            confirmBtn.innerHTML = originalText;
            confirmBtn.disabled = originalDisabled;
        }
    }

    showSuccess(bookingData) {
        // Update success details
        document.getElementById('success-name').textContent = bookingData.student_name;
        document.getElementById('success-type').textContent = 
            bookingData.meeting_type === 'face-to-face' ? 'Face-to-Face Meeting' : 'Zoom Meeting';
        document.getElementById('success-day').textContent = bookingData.day;
        document.getElementById('success-time').textContent = this.formatTimeForDisplay(bookingData.time);
        
        // Show success step
        this.showStep('success-message');
        
        // Log success
        console.log('✅ Booking successful:', bookingData);
    }

    resetForm() {
        // Reset booking data
        this.bookingData = {
            studentName: '',
            meetingType: '',
            day: '',
            time: ''
        };

        // Reset form elements
        const nameInput = document.getElementById('studentName');
        nameInput.value = '';
        
        // Clear selections
        document.querySelectorAll('.type-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        document.querySelectorAll('.day-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        document.querySelectorAll('.time-slot').forEach(slot => {
            slot.classList.remove('selected');
        });

        // Clear time slots display
        document.getElementById('time-slots').innerHTML = '';
        document.getElementById('selected-day-time').textContent = '';

        // Show first step
        this.showStep('step-name');
        
        // Focus on name input
        setTimeout(() => {
            nameInput.focus();
        }, 100);
    }

    formatTimeForDisplay(time) {
        if (!time) return '';
        
        const [hours, minutes] = time.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours % 12 || 12;
        return `${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }
}

// Initialize the booking system when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.bookingSystem = new BookingSystem();
});