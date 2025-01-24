// booking.js
document.addEventListener('DOMContentLoaded', function() {
  const SERVER_BASE_URL = 'https://hairformation-backend.onrender.com'; // Adjust if needed

  const haircutTypeSelect = document.getElementById('haircutType');
  const dateInput = document.getElementById('date');
  const timeSelect = document.getElementById('time');
  const bookingForm = document.getElementById('bookingForm');
  const submitBtn = document.getElementById('submitBtn');

  $('#date').datepicker({
    format: 'yyyy-mm-dd',
    language: 'he',
    orientation: 'bottom left',
    weekStart: 0,
    daysOfWeekDisabled: [1,6],
    autoclose: true,
    startDate: new Date(),
    todayHighlight: true,
    rtl: true
  }).on('changeDate', function(e) {
    const selectedDate = e.date;
    const formattedDate = formatDate(selectedDate);
    dateInput.value = formattedDate;
    console.log(`[Booking.js] Date selected: ${formattedDate}`);

    loadAvailableTimes(formattedDate);
  });

  haircutTypeSelect.addEventListener('change', function() {
    dateInput.value = '';
    timeSelect.innerHTML = '<option value="">בחרו שעה</option>';
    removeValidationError(haircutTypeSelect);
    console.log(`[Booking.js] Service type changed to: ${haircutTypeSelect.value}`);

    if (["Gvanim", "Keratin", "Ampule"].includes(haircutTypeSelect.value)) {
      submitBtn.classList.remove('btn-primary');
      submitBtn.classList.add('btn-success');
      console.log('[Booking.js] Special service => button is green.');
    } else {
      submitBtn.classList.remove('btn-success');
      submitBtn.classList.add('btn-primary');
      console.log('[Booking.js] Normal service => button is blue.');
    }
  });

  async function loadAvailableTimes(dateStr) {
    const serviceType = haircutTypeSelect.value;
    if (!serviceType) {
      timeSelect.innerHTML = '<option value="">בחרו סוג שירות קודם</option>';
      console.log('[Booking.js] No service type => skipping availability load.');
      return;
    }

    timeSelect.innerHTML = '<option value="">טוען...</option>';
    console.log(`[Booking.js] Loading availability => date=${dateStr}, serviceType=${serviceType}`);

    try {
      const response = await fetch(`${SERVER_BASE_URL}/get-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, serviceType })
      });
      const data = await response.json();

      if (data.error) {
        showValidationError(timeSelect, data.error);
        timeSelect.innerHTML = '<option value="">אין שעות פנויות</option>';
        console.log(`[Booking.js] /get-availability error: ${data.error}`);
        return;
      }

      const slots = data.availableSlots || [];
      const dayEvents = data.dayEvents || [];

      // Log other appointments
      console.log('[Booking.js] Day events for chosen date:', dayEvents);
      // Log available slots
      console.log('[Booking.js] Available slots for chosen service:', slots);

      if (slots.length === 0) {
        timeSelect.innerHTML = '<option value="">אין שעות פנויות</option>';
        console.log('[Booking.js] No available slots returned.');
      } else {
        timeSelect.innerHTML = '<option value="">בחרו שעה</option>';
        slots.forEach(t => {
          const option = document.createElement('option');
          option.value = t; 
          option.textContent = t;
          timeSelect.appendChild(option);
        });
      }
      removeValidationError(timeSelect);
    } catch (err) {
      console.error('[Booking.js] loadAvailableTimes failed:', err);
      showValidationError(timeSelect, 'שגיאה בטעינת הזמנים');
      timeSelect.innerHTML = '<option value="">שגיאה בטעינת הזמנים</option>';
    }
  }

  bookingForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    console.log('[Booking.js] Booking form submitted.');

    const isValid = validateForm();
    if (!isValid) {
      const firstError = document.querySelector('.is-invalid');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      console.log('[Booking.js] Form invalid => submission aborted.');
      return;
    }

    const serviceType = haircutTypeSelect.value;
    const date = dateInput.value;
    const time = timeSelect.value;
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const phone = document.getElementById('phone').value.trim();

    console.log(`[Booking.js] Submitting booking => serviceType=${serviceType}, date=${date}, time=${time}, name=${firstName} ${lastName}, phone=${phone}`);

    // If special service => open WhatsApp
    if (["Gvanim", "Keratin", "Ampule"].includes(serviceType)) {
      const baseWhatsappUrl = 'https://api.whatsapp.com/send';
      const phoneNumber = '972547224551';
      const textMessage = `היי, שמי ${firstName} ${lastName} ואשמח לקבוע תור בתאריך ${date} בשעה ${time} ל${serviceType}.`;

      console.log('[Booking.js] Special service => redirecting to WhatsApp');
      window.open(`${baseWhatsappUrl}?phone=${phoneNumber}&text=${encodeURIComponent(textMessage)}`, '_blank');
      return;
    }

    // Final check
    console.log('[Booking.js] Performing final availability check...');
    try {
      const finalCheckRes = await fetch(`${SERVER_BASE_URL}/get-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, serviceType })
      });
      const finalCheckData = await finalCheckRes.json();

      const latestSlots = finalCheckData.availableSlots || [];
      if (!latestSlots.includes(time)) {
        console.log(`[Booking.js] Final check => time ${time} not available anymore.`);
        alert("אופס! נראה שמישהו אחר כבר קבע את השעה הזו. אנא בחרו שעה אחרת.");
        return;
      }
      console.log(`[Booking.js] Final check => time ${time} still available, proceeding with booking.`);

    } catch (err) {
      console.error('[Booking.js] Final check failed:', err);
      alert("שגיאה בבדיקה הסופית. אנא נסו שוב מאוחר יותר.");
      return;
    }

    // Book
    console.log('[Booking.js] Sending /book-appointment request...');
    try {
      const response = await fetch(`${SERVER_BASE_URL}/book-appointment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType, date, time, firstName, lastName, phone })
      });
      const data = await response.json();

      if (data.error) {
        showValidationError(timeSelect, `לא ניתן לקבוע את התור: ${data.error}`);
        console.log(`[Booking.js] Booking error from server => ${data.error}`);
      } else {
        const appointmentDetails = {
          firstName,
          lastName,
          date,
          time,
          haircutType: serviceType
        };
        localStorage.setItem('appointmentDetails', JSON.stringify(appointmentDetails));
        console.log('[Booking.js] Booking successful => redirecting to confirmation.');
        window.location.href = 'confirmation.html';
      }
    } catch (err) {
      console.error('[Booking.js] booking failed:', err);
      showValidationError(null, 'התרחשה שגיאה בקביעת התור. אנא נסו שוב מאוחר יותר.');
    }
  });

  // Validation & Helpers
  const phonePattern = /^\d{10}$/; 
  const namePattern = /^[A-Za-zא-ת]+$/;

  function validateForm() {
    let valid = true;

    if (!haircutTypeSelect.value) {
      showValidationError(haircutTypeSelect, 'אנא בחרו סוג שירות.');
      valid = false;
    } else {
      removeValidationError(haircutTypeSelect);
    }

    if (!dateInput.value) {
      showValidationError(dateInput, 'אנא בחרו תאריך.');
      valid = false;
    } else {
      removeValidationError(dateInput);
    }

    if (!timeSelect.value) {
      showValidationError(timeSelect, 'אנא בחרו שעה.');
      valid = false;
    } else {
      removeValidationError(timeSelect);
    }

    const firstNameInput = document.getElementById('firstName');
    const fName = firstNameInput.value.trim();
    if (!fName) {
      showValidationError(firstNameInput, 'אנא הזינו את השם הפרטי.');
      valid = false;
    } else if (!namePattern.test(fName)) {
      showValidationError(firstNameInput, 'השם הפרטי יכול להכיל רק אותיות בעברית או באנגלית.');
      valid = false;
    } else {
      removeValidationError(firstNameInput);
    }

    const lastNameInput = document.getElementById('lastName');
    const lName = lastNameInput.value.trim();
    if (!lName) {
      showValidationError(lastNameInput, 'אנא הזינו את שם המשפחה.');
      valid = false;
    } else if (!namePattern.test(lName)) {
      showValidationError(lastNameInput, 'שם המשפחה יכול להכיל רק אותיות בעברית או באנגלית.');
      valid = false;
    } else {
      removeValidationError(lastNameInput);
    }

    const phoneInput = document.getElementById('phone');
    const phoneVal = phoneInput.value.trim();
    if (!phoneVal) {
      showValidationError(phoneInput, 'אנא הזינו את מספר הטלפון.');
      valid = false;
    } else if (!phonePattern.test(phoneVal)) {
      showValidationError(phoneInput, 'מספר הטלפון חייב להכיל בדיוק 10 ספרות.');
      valid = false;
    } else {
      removeValidationError(phoneInput);
    }

    return valid;
  }

  function showValidationError(inputElement, message) {
    if (inputElement) {
      inputElement.classList.add('is-invalid');
      let feedback = inputElement.parentElement.querySelector('.invalid-feedback');
      if (!feedback) {
        feedback = document.createElement('div');
        feedback.className = 'invalid-feedback';
        inputElement.parentElement.appendChild(feedback);
      }
      feedback.textContent = message;
      console.log(`[Booking.js] Validation error on ${inputElement.id}: ${message}`);
    } else {
      let formError = bookingForm.querySelector('.form-error');
      if (!formError) {
        formError = document.createElement('div');
        formError.className = 'form-error text-danger mb-3';
        bookingForm.prepend(formError);
      }
      formError.textContent = message;
      console.log(`[Booking.js] Validation error (form-level): ${message}`);
    }
  }

  function removeValidationError(inputElement) {
    if (inputElement) {
      inputElement.classList.remove('is-invalid');
      const feedback = inputElement.parentElement.querySelector('.invalid-feedback');
      if (feedback) {
        feedback.textContent = '';
      }
    }
  }

  const totalSteps = 6;
  for (let i = 1; i <= totalSteps; i++) {
    const nextBtn = document.getElementById(`nextBtn-${i}`);
    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        const currentStep = document.getElementById(`step-${i}`);
        const nextStep = document.getElementById(`step-${i + 1}`);
        if (validateStep(currentStep)) {
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

  function validateStep(currentStep) {
    let valid = true;
    const inputs = currentStep.querySelectorAll('.form-control');

    inputs.forEach(input => {
      if (!input.value.trim()) {
        showValidationError(input, getErrorMessage(input));
        valid = false;
      }
    });
    return valid;
  }

  function getErrorMessage(input) {
    switch (input.id) {
      case 'haircutType': return 'אנא בחרו סוג שירות.';
      case 'date':        return 'אנא בחרו תאריך.';
      case 'time':        return 'אנא בחרו שעה.';
      case 'firstName':   return 'אנא הזינו את השם הפרטי.';
      case 'lastName':    return 'אנא הזינו את שם המשפחה.';
      case 'phone':       return 'אנא הזינו את מספר הטלפון.';
      default:            return 'אנא מלאו שדה זה.';
    }
  }

  function updateProgressBar(step) {
    const progressBar = document.querySelector('.progress-bar');
    const percentage = (step / totalSteps) * 100;
    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', step);
    progressBar.textContent = `${step}/${totalSteps}`;
  }

  function formatDate(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
});
