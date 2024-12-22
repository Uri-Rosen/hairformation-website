// booking.js
document.addEventListener('DOMContentLoaded', function() {
  // ----------------------------------------------------
  // 1) Configure the base URL of your Node server
  // ----------------------------------------------------
  const SERVER_BASE_URL = 'https://hairformation-backend.onrender.com';

  // ----------------------------------------------------
  // 2) Get references to form elements
  // ----------------------------------------------------
  const haircutTypeSelect = document.getElementById('haircutType');
  const dateInput = document.getElementById('date');
  const timeSelect = document.getElementById('time');
  const bookingForm = document.getElementById('bookingForm');

  // ----------------------------------------------------
  // 3) Initialize the datepicker (Bootstrap Datepicker)
  // ----------------------------------------------------
  $('#date').datepicker({
    format: 'yyyy-mm-dd',
    language: 'he',
    orientation: 'bottom left',
    weekStart: 0, // Sunday
    daysOfWeekDisabled: [1,6], // Monday & Saturday closed
    autoclose: true,
    startDate: new Date(), // no past dates
    todayHighlight: true,
    rtl: true
  }).on('changeDate', function(e) {
    // User selected a date from the calendar
    const selectedDate = e.date; // a Date object
    const formattedDate = formatDate(selectedDate); // "YYYY-MM-DD"
    dateInput.value = formattedDate;

    // After picking a date, load the available times from the server
    loadAvailableTimes(formattedDate);
  });

  // Reset date/time when user changes service type
  haircutTypeSelect.addEventListener('change', function() {
    dateInput.value = ''; // clear date
    timeSelect.innerHTML = '<option value="">בחרו שעה</option>'; // clear time list
    removeValidationError(haircutTypeSelect);
  });

  // ----------------------------------------------------
  // 4) Load Available Times from Node server
  // ----------------------------------------------------
  async function loadAvailableTimes(dateStr) {
    // If no service chosen, do nothing
    const serviceType = haircutTypeSelect.value;
    if (!serviceType) {
      timeSelect.innerHTML = '<option value="">בחרו סוג שירות קודם</option>';
      return;
    }

    timeSelect.innerHTML = '<option value="">טוען...</option>';

    try {
      const response = await fetch(`${SERVER_BASE_URL}/get-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, serviceType })
      });

      const data = await response.json();
      if (data.error) {
        // If the server returned an error
        showValidationError(timeSelect, data.error);
        timeSelect.innerHTML = '<option value="">אין שעות פנויות</option>';
        return;
      }

      const slots = data.availableSlots || [];
      if (slots.length === 0) {
        timeSelect.innerHTML = '<option value="">אין שעות פנויות</option>';
      } else {
        timeSelect.innerHTML = '<option value="">בחרו שעה</option>';
        slots.forEach(time => {
          const option = document.createElement('option');
          option.value = time;   // e.g. "09:30"
          option.textContent = time;
          timeSelect.appendChild(option);
        });
      }
      removeValidationError(timeSelect);
    } catch (err) {
      console.error('Failed to load times', err);
      showValidationError(timeSelect, 'שגיאה בטעינת הזמנים');
      timeSelect.innerHTML = '<option value="">שגיאה בטעינת הזמנים</option>';
    }
  }

  // ----------------------------------------------------
  // 5) Handle Form Submission => Book Appointment
  // ----------------------------------------------------
  bookingForm.addEventListener('submit', async function(event) {
    event.preventDefault();

    // Perform comprehensive validation before submission
    const isValid = validateForm();

    if (!isValid) {
      // Scroll to the first error
      const firstError = document.querySelector('.is-invalid');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Gather all form fields
    const serviceType = haircutTypeSelect.value;
    const date = dateInput.value;
    const time = timeSelect.value;
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const phone = document.getElementById('phone').value.trim();

    // Send a POST request to book-appointment
    try {
      const response = await fetch(`${SERVER_BASE_URL}/book-appointment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType,
          date,
          time,
          firstName,
          lastName,
          phone
        })
      });
      const data = await response.json();

      if (data.error) {
        // Server says the slot is unavailable or outside working hours, etc.
        showValidationError(timeSelect, `לא ניתן לקבוע את התור: ${data.error}`);
      } else {
        // Success => redirect to confirmation page
        // Store details in localStorage so we can show them on confirmation.html
        const appointmentDetails = {
          firstName,
          lastName,
          date,
          time,
          haircutType: serviceType
        };
        localStorage.setItem('appointmentDetails', JSON.stringify(appointmentDetails));

        // Now go to the confirmation page
        window.location.href = 'confirmation.html';
      }
    } catch (err) {
      console.error('Booking failed', err);
      showValidationError(null, 'התרחשה שגיאה בקביעת התור. אנא נסו שוב מאוחר יותר.');
    }
  });

  // ----------------------------------------------------
  // 6) Helper Functions for Validation and Error Handling
  // ----------------------------------------------------

  // Updated Regex patterns
  const phonePattern = /^\d{10}$/; // Ensures exactly 10 digits
  const namePattern = /^[A-Za-zא-ת]+$/;

  /**
   * Validates the entire form before submission.
   * @returns {boolean} True if the form is valid, false otherwise.
   */
  function validateForm() {
    let valid = true;

    // Validate Service Type
    if (!haircutTypeSelect.value) {
      showValidationError(haircutTypeSelect, 'אנא בחרו סוג שירות.');
      valid = false;
    } else {
      removeValidationError(haircutTypeSelect);
    }

    // Validate Date
    if (!dateInput.value) {
      showValidationError(dateInput, 'אנא בחרו תאריך.');
      valid = false;
    } else {
      removeValidationError(dateInput);
    }

    // Validate Time
    if (!timeSelect.value) {
      showValidationError(timeSelect, 'אנא בחרו שעה.');
      valid = false;
    } else {
      removeValidationError(timeSelect);
    }

    // Validate First Name
    const firstNameInput = document.getElementById('firstName');
    const firstName = firstNameInput.value.trim();
    if (!firstName) {
      showValidationError(firstNameInput, 'אנא הזינו את השם הפרטי.');
      valid = false;
    } else if (!namePattern.test(firstName)) {
      showValidationError(firstNameInput, 'השם הפרטי יכול להכיל רק אותיות בעברית או באנגלית.');
      valid = false;
    } else {
      removeValidationError(firstNameInput);
    }

    // Validate Last Name
    const lastNameInput = document.getElementById('lastName');
    const lastName = lastNameInput.value.trim();
    if (!lastName) {
      showValidationError(lastNameInput, 'אנא הזינו את שם המשפחה.');
      valid = false;
    } else if (!namePattern.test(lastName)) {
      showValidationError(lastNameInput, 'שם המשפחה יכול להכיל רק אותיות בעברית או באנגלית.');
      valid = false;
    } else {
      removeValidationError(lastNameInput);
    }

    // Validate Phone
    const phoneInput = document.getElementById('phone');
    const phone = phoneInput.value.trim();
    if (!phone) {
      showValidationError(phoneInput, 'אנא הזינו את מספר הטלפון.');
      valid = false;
    } else if (!phonePattern.test(phone)) {
      showValidationError(phoneInput, 'מספר הטלפון חייב להכיל בדיוק 10 ספרות.');
      valid = false;
    } else {
      removeValidationError(phoneInput);
    }

    return valid;
  }

  /**
   * Displays a validation error message for a specific input.
   * @param {HTMLElement} inputElement - The input element to display the error for.
   * @param {string} message - The error message to display.
   */
  function showValidationError(inputElement, message) {
    if (inputElement) {
      inputElement.classList.add('is-invalid');

      let feedback = inputElement.parentElement.querySelector('.invalid-feedback');
      if (!feedback) {
        // Create invalid-feedback element if it doesn't exist
        feedback = document.createElement('div');
        feedback.className = 'invalid-feedback';
        inputElement.parentElement.appendChild(feedback);
      }
      feedback.textContent = message;
    } else {
      // General form error (e.g., booking submission error)
      // You can choose where to display this error. For example, at the top of the form.
      let formError = bookingForm.querySelector('.form-error');
      if (!formError) {
        formError = document.createElement('div');
        formError.className = 'form-error text-danger mb-3';
        bookingForm.prepend(formError);
      }
      formError.textContent = message;
    }
  }

  /**
   * Removes the validation error message for a specific input.
   * @param {HTMLElement} inputElement - The input element to remove the error from.
   */
  function removeValidationError(inputElement) {
    if (inputElement) {
      inputElement.classList.remove('is-invalid');

      const feedback = inputElement.parentElement.querySelector('.invalid-feedback');
      if (feedback) {
        feedback.textContent = '';
      }
    }
  }

  /**
   * Validates inputs within a specific step.
   * @param {HTMLElement} currentStep - The current step container.
   * @returns {boolean} True if the step is valid, false otherwise.
   */
  function validateStep(currentStep) {
    let valid = true;
    const inputs = currentStep.querySelectorAll('.form-control');

    inputs.forEach(input => {
      if (!input.value.trim()) {
        showValidationError(input, getErrorMessage(input));
        valid = false;
      } else {
        // Additional validations for specific fields
        if (input.id === 'phone') {
          if (!phonePattern.test(input.value.trim())) {
            showValidationError(input, 'מספר הטלפון חייב להכיל בדיוק 10 ספרות.');
            valid = false;
          } else {
            removeValidationError(input);
          }
        } else if (input.id === 'firstName' || input.id === 'lastName') {
          if (!namePattern.test(input.value.trim())) {
            showValidationError(input, `ה${input.id === 'firstName' ? 'שם הפרטי' : 'שם המשפחה'} יכול להכיל רק אותיות בעברית או באנגלית.`);
            valid = false;
          } else {
            removeValidationError(input);
          }
        } else {
          // For other inputs, just remove any existing error
          removeValidationError(input);
        }
      }
    });

    return valid;
  }

  /**
   * Returns an appropriate error message based on the input element.
   * @param {HTMLElement} input - The input element.
   * @returns {string} The error message.
   */
  function getErrorMessage(input) {
    switch(input.id) {
      case 'haircutType':
        return 'אנא בחרו סוג שירות.';
      case 'date':
        return 'אנא בחרו תאריך.';
      case 'time':
        return 'אנא בחרו שעה.';
      case 'firstName':
        return 'אנא הזינו את השם הפרטי.';
      case 'lastName':
        return 'אנא הזינו את שם המשפחה.';
      case 'phone':
        return 'אנא הזינו את מספר הטלפון.';
      default:
        return 'אנא מלאו את השדה.';
    }
  }

  // ----------------------------------------------------
  // 7) Step Navigation / Progress Bar Enhancements
  // ----------------------------------------------------
  const totalSteps = 6;
  for (let i = 1; i <= totalSteps; i++) {
    const nextBtn = document.getElementById(`nextBtn-${i}`);
    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        const currentStep = document.getElementById(`step-${i}`);
        const nextStep = document.getElementById(`step-${i + 1}`);
        // Validate current step's inputs
        const stepIsValid = validateStep(currentStep);
        if (stepIsValid) {
          // Move to next step
          currentStep.classList.remove('active');
          if (nextStep) {
            nextStep.classList.add('active');
            updateProgressBar(i + 1);
          }
        }
      });
    }
    const prevBtn = document.getElementById(`prevBtn-${i}`);
    if (prevBtn) {
      prevBtn.addEventListener('click', function() {
        const currentStep = document.getElementById(`step-${i}`);
        const prevStep = document.getElementById(`step-${i - 1}`);
        currentStep.classList.remove('active');
        if (prevStep) {
          prevStep.classList.add('active');
          updateProgressBar(i - 1);
        }
      });
    }
  }

  /**
   * Updates the progress bar based on the current step.
   * @param {number} step - The current step number.
   */
  function updateProgressBar(step) {
    const progressBar = document.querySelector('.progress-bar');
    const percentage = (step / totalSteps) * 100;
    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', step);
    progressBar.textContent = `${step}/${totalSteps}`;
  }

  // Initialize progress bar at step 1
  updateProgressBar(1);

  // ----------------------------------------------------
  // 8) Helper function to format date objects => YYYY-MM-DD
  // ----------------------------------------------------
  function formatDate(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
});
