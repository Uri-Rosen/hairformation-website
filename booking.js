// booking.js
document.addEventListener('DOMContentLoaded', function() {
  // ----------------------------------------------------
  // 1) Configure the base URL of your Node server
  // ----------------------------------------------------
  const SERVER_BASE_URL = 'https://hairformation-backend.onrender.com'; // Adjust to your server's URL

  // ----------------------------------------------------
  // 2) Get references to form elements
  // ----------------------------------------------------
  const haircutTypeSelect = document.getElementById('haircutType');
  const dateInput = document.getElementById('date');
  const timeSelect = document.getElementById('time');
  const bookingForm = document.getElementById('bookingForm');
  const submitBtn = document.getElementById('submitBtn'); // final button

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
    const selectedDate = e.date; 
    const formattedDate = formatDate(selectedDate); 
    dateInput.value = formattedDate;
    console.log(`[Booking.js] Date selected: ${formattedDate}`);

    // After picking a date, load the available times from the server
    loadAvailableTimes(formattedDate);
  });

  // When user changes the service type, reset date/time,
  // AND toggle the button color if it’s a special service.
  haircutTypeSelect.addEventListener('change', function() {
    dateInput.value = ''; 
    timeSelect.innerHTML = '<option value="">בחרו שעה</option>';
    removeValidationError(haircutTypeSelect);
    console.log(`[Booking.js] Service type changed to: ${haircutTypeSelect.value}`);

    // Check if the selected value is one of the special services
    if (["Gvanim", "Keratin", "Ampule"].includes(haircutTypeSelect.value)) {
      submitBtn.classList.remove('btn-primary');
      submitBtn.classList.add('btn-success');
      console.log('[Booking.js] Special service selected. Button turned green.');
    } else {
      submitBtn.classList.remove('btn-success');
      submitBtn.classList.add('btn-primary');
      console.log('[Booking.js] Regular service selected. Button reverted to blue.');
    }
  });

  // ----------------------------------------------------
  // 4) Load Available Times from Node server
  // ----------------------------------------------------
  async function loadAvailableTimes(dateStr) {
    const serviceType = haircutTypeSelect.value;
    if (!serviceType) {
      timeSelect.innerHTML = '<option value="">בחרו סוג שירות קודם</option>';
      console.log('[Booking.js] No service type selected yet. Aborting availability load.');
      return;
    }

    timeSelect.innerHTML = '<option value="">טוען...</option>';
    console.log(`[Booking.js] Loading available times. date=${dateStr}, serviceType=${serviceType}`);

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
        console.log(`[Booking.js] Error from server: ${data.error}`);
        return;
      }

      const slots = data.availableSlots || [];
      if (slots.length === 0) {
        timeSelect.innerHTML = '<option value="">אין שעות פנויות</option>';
        console.log('[Booking.js] No available slots returned from server.');
      } else {
        timeSelect.innerHTML = '<option value="">בחרו שעה</option>';
        slots.forEach(t => {
          const option = document.createElement('option');
          option.value = t;   // e.g. "09:30"
          option.textContent = t;
          timeSelect.appendChild(option);
        });
        console.log(`[Booking.js] Received available slots: ${slots.join(', ')}`);
      }
      removeValidationError(timeSelect);
    } catch (err) {
      console.error('[Booking.js] Failed to load times:', err);
      showValidationError(timeSelect, 'שגיאה בטעינת הזמנים');
      timeSelect.innerHTML = '<option value="">שגיאה בטעינת הזמנים</option>';
    }
  }

  // ----------------------------------------------------
  // 5) Handle Form Submission => Book Appointment OR WhatsApp
  // ----------------------------------------------------
  bookingForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    console.log('[Booking.js] Booking form submitted.');

    // 1) Validate the form fields
    const isValid = validateForm();
    if (!isValid) {
      const firstError = document.querySelector('.is-invalid');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      console.log('[Booking.js] Form validation failed. Aborting submission.');
      return;
    }

    // 2) Gather form data
    const serviceType = haircutTypeSelect.value;
    const date = dateInput.value;
    const time = timeSelect.value;
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const phone = document.getElementById('phone').value.trim();

    console.log(`[Booking.js] Final Form Data => serviceType=${serviceType}, date=${date}, time=${time}, name=${firstName} ${lastName}, phone=${phone}`);

    // Hebrew mapping for special services
    const serviceTypeHebrew = {
      Gvanim: 'גוונים',
      Keratin: 'טיפול קרטין',
      Ampule: 'אמפולה',
      ManWithoutBeard: 'תספורת גברים ללא זקן',
      ManWithBeard: 'תספורת גברים עם זקן',
      Woman: 'תספורת נשים',
      BlowDry: 'פן',
      WomanAndBlowDry: 'תספורת נשים + פן',
      HairColoring: 'צבע שורש',
      InoaRootColoring: 'צבע שורש אינואה',
      ColorAndBlowDry: 'צבע שורש + פן',
      ColorAndWoman: 'צבע שורש + תספורת נשים',
      ColorAndWomanAndBlowDry: 'צבע שורש + תספורת נשים + פן',
      InoaRootColoringAndBlowDry: 'צבע שורש אינואה + פן',
      InoaRootColoringAndWoman: 'צבע שורש אינואה + תספורת נשים',
      InoaRootColoringAndWomanAndBlowDry: 'צבע שורש אינואה + תספורת נשים + פן'
      // Additional mappings if needed
    };

    // 3) If it's one of the 3 special services => open WhatsApp & skip normal booking
    if (["Gvanim", "Keratin", "Ampule"].includes(serviceType)) {
      const serviceHebrew = serviceTypeHebrew[serviceType] || serviceType;
      const baseWhatsappUrl = 'https://api.whatsapp.com/send';
      const phoneNumber = '972547224551';
      const textMessage = `היי, שמי ${firstName} ${lastName} ואשמח לקבוע תור בתאריך ${date} בשעה ${time} ל${serviceHebrew}.`;

      console.log('[Booking.js] Special service chosen, redirecting to WhatsApp:', textMessage);
      const whatsappLink = `${baseWhatsappUrl}?phone=${phoneNumber}&text=${encodeURIComponent(textMessage)}`;
      window.open(whatsappLink, '_blank');
      return;
    }

    // -----------------------------------------------------------
    // 4) Final availability check
    // -----------------------------------------------------------
    console.log('[Booking.js] Performing final availability check...');
    try {
      const finalCheckResponse = await fetch(`${SERVER_BASE_URL}/get-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, serviceType })
      });
      const finalCheckData = await finalCheckResponse.json();
      const latestSlots = finalCheckData.availableSlots || [];

      if (!latestSlots.includes(time)) {
        console.log(`[Booking.js] Slot ${time} no longer available according to final check.`);
        alert("אופס! נראה שמישהו אחר כבר קבע את השעה הזו. אנא בחרו שעה אחרת.");
        return;
      }
      console.log(`[Booking.js] Final check passed. Slot ${time} is still available.`);
    } catch (err) {
      console.error('[Booking.js] Final availability check failed:', err);
      alert("שגיאה בבדיקה הסופית. אנא נסו שוב מאוחר יותר.");
      return;
    }

    // 5) Attempt booking
    console.log('[Booking.js] Attempting to book appointment now...');
    try {
      const response = await fetch(`${SERVER_BASE_URL}/book-appointment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType, date, time, firstName, lastName, phone })
      });

      const data = await response.json();
      if (data.error) {
        showValidationError(timeSelect, `לא ניתן לקבוע את התור: ${data.error}`);
        console.log(`[Booking.js] Booking error from server: ${data.error}`);
      } else {
        // Success => store details, go to confirmation page
        const appointmentDetails = {
          firstName,
          lastName,
          date,
          time,
          haircutType: serviceType
        };
        localStorage.setItem('appointmentDetails', JSON.stringify(appointmentDetails));
        console.log('[Booking.js] Booking successful. Redirecting to confirmation page...');
        window.location.href = 'confirmation.html';
      }
    } catch (err) {
      console.error('[Booking.js] Booking failed:', err);
      showValidationError(null, 'התרחשה שגיאה בקביעת התור. אנא נסו שוב מאוחר יותר.');
    }
  });

  // ----------------------------------------------------
  // 6) Helper Functions for Validation and Error Handling
  // ----------------------------------------------------
  const phonePattern = /^\d{10}$/;
  const namePattern = /^[A-Za-zא-ת]+$/;

  function validateForm() {
    let valid = true;

    // Validate Service Type
    if (!haircutTypeSelect.value) {
      showValidationError(haircutTypeSelect, 'אנא בחרו סוג שירות.');
      console.log('[Booking.js] Validation: No service type chosen.');
      valid = false;
    } else {
      removeValidationError(haircutTypeSelect);
    }

    // Validate Date
    if (!dateInput.value) {
      showValidationError(dateInput, 'אנא בחרו תאריך.');
      console.log('[Booking.js] Validation: No date chosen.');
      valid = false;
    } else {
      removeValidationError(dateInput);
    }

    // Validate Time
    if (!timeSelect.value) {
      showValidationError(timeSelect, 'אנא בחרו שעה.');
      console.log('[Booking.js] Validation: No time chosen.');
      valid = false;
    } else {
      removeValidationError(timeSelect);
    }

    // Validate First Name
    const firstNameInput = document.getElementById('firstName');
    const firstName = firstNameInput.value.trim();
    if (!firstName) {
      showValidationError(firstNameInput, 'אנא הזינו את השם הפרטי.');
      console.log('[Booking.js] Validation: First name missing.');
      valid = false;
    } else if (!namePattern.test(firstName)) {
      showValidationError(firstNameInput, 'השם הפרטי יכול להכיל רק אותיות בעברית או באנגלית.');
      console.log('[Booking.js] Validation: First name format invalid.');
      valid = false;
    } else {
      removeValidationError(firstNameInput);
    }

    // Validate Last Name
    const lastNameInput = document.getElementById('lastName');
    const lastName = lastNameInput.value.trim();
    if (!lastName) {
      showValidationError(lastNameInput, 'אנא הזינו את שם המשפחה.');
      console.log('[Booking.js] Validation: Last name missing.');
      valid = false;
    } else if (!namePattern.test(lastName)) {
      showValidationError(lastNameInput, 'שם המשפחה יכול להכיל רק אותיות בעברית או באנגלית.');
      console.log('[Booking.js] Validation: Last name format invalid.');
      valid = false;
    } else {
      removeValidationError(lastNameInput);
    }

    // Validate Phone
    const phoneInput = document.getElementById('phone');
    const phoneVal = phoneInput.value.trim();
    if (!phoneVal) {
      showValidationError(phoneInput, 'אנא הזינו את מספר הטלפון.');
      console.log('[Booking.js] Validation: Phone missing.');
      valid = false;
    } else if (!phonePattern.test(phoneVal)) {
      showValidationError(phoneInput, 'מספר הטלפון חייב להכיל בדיוק 10 ספרות.');
      console.log('[Booking.js] Validation: Phone format invalid.');
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
      console.log(`[Booking.js] Validation Error => Element: ${inputElement.id}, Message: ${message}`);
    } else {
      // General form error
      let formError = bookingForm.querySelector('.form-error');
      if (!formError) {
        formError = document.createElement('div');
        formError.className = 'form-error text-danger mb-3';
        bookingForm.prepend(formError);
      }
      formError.textContent = message;
      console.log(`[Booking.js] Form-level error: ${message}`);
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

  // ----------------------------------------------------
  // 7) (Optional) Multi-Step Navigation / Progress
  // ----------------------------------------------------
  const totalSteps = 6;
  for (let i = 1; i <= totalSteps; i++) {
    const nextBtn = document.getElementById(`nextBtn-${i}`);
    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        const currentStep = document.getElementById(`step-${i}`);
        const nextStep = document.getElementById(`step-${i + 1}`);
        const stepIsValid = validateStep(currentStep);
        if (stepIsValid) {
          currentStep.classList.remove('active');
          if (nextStep) {
            nextStep.classList.add('active');
            updateProgressBar(i + 1);
            console.log(`[Booking.js] Moved from step ${i} to ${i+1}.`);
          }
        } else {
          console.log(`[Booking.js] Step ${i} validation failed, staying on this step.`);
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
          console.log(`[Booking.js] Went back from step ${i} to ${i-1}.`);
        }
      });
    }
  }

  function updateProgressBar(step) {
    const progressBar = document.querySelector('.progress-bar');
    const percentage = (step / totalSteps) * 100;
    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', step);
    progressBar.textContent = `${step}/${totalSteps}`;
    console.log(`[Booking.js] Progress bar updated => ${step}/${totalSteps}`);
  }

  function validateStep(currentStep) {
    let valid = true;
    const inputs = currentStep.querySelectorAll('.form-control');

    inputs.forEach(input => {
      if (!input.value.trim()) {
        showValidationError(input, getErrorMessage(input));
        valid = false;
      } else {
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
          removeValidationError(input);
        }
      }
    });

    return valid;
  }

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

  // Initialize progress bar at step 1
  updateProgressBar(1);

  // ----------------------------------------------------
  // 8) Helper: formatDate to YYYY-MM-DD
  // ----------------------------------------------------
  function formatDate(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
});
