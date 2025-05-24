document.addEventListener('DOMContentLoaded', function() {
  const SERVER_BASE_URL = 'https://hairformation-backend.onrender.com';

  const haircutTypeSelect = document.getElementById('haircutType');
  const dateInput = document.getElementById('date'); // This is the <input type="text"> for the datepicker
  const timeSelect = document.getElementById('time');
  const bookingForm = document.getElementById('bookingForm');
  const submitBtn = document.getElementById('submitBtn');

  let allServicesData = [];

  async function loadServices() {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/services`);
      if (!response.ok) {
        throw new Error(`[loadServices] HTTP error! status: ${response.status}`);
      }
      allServicesData = await response.json();

      haircutTypeSelect.innerHTML = '<option value="">בחרו סוג שירות</option>';
      allServicesData.forEach(service => {
        const option = document.createElement('option');
        option.value = service.key;
        option.textContent = service.hebrewName;
        option.dataset.bookableOnline = service.bookableOnline;
        if (service.manualBookingMessage) {
            option.dataset.manualBookingMessage = service.manualBookingMessage;
        }
        haircutTypeSelect.appendChild(option);
      });
      console.log('[loadServices] Services loaded and populated into select.');
    } catch (error) {
      console.error("[loadServices] Failed to load services:", error);
      showValidationError(haircutTypeSelect, 'שגיאה בטעינת סוגי השירותים. נסו לרענן את הדף.');
      haircutTypeSelect.innerHTML = '<option value="">שגיאה בטעינת שירותים</option>';
    }
  }

  $('#date').datepicker({
    format: 'yyyy-mm-dd',
    language: 'he',
    orientation: 'bottom left',
    weekStart: 0,
    daysOfWeekDisabled: [1, 6],
    autoclose: true,
    startDate: new Date(),
    todayHighlight: true,
    rtl: true
  }).on('changeDate', function(e) {
    if (e.date) {
        const selectedDate = e.date;
        const formattedDate = formatDate(selectedDate); // Your formatDate function
        // dateInput.value is set by datepicker plugin automatically
        console.log('[datepicker changeDate] Date selected. Formatted:', formattedDate, 'Input value:', dateInput.value);
        loadAvailableTimes(dateInput.value); // Use the input's value which datepicker should have set
        goToStep(2); // Move to step 3 (0-indexed: step 0, 1, 2)
    } else {
        console.warn('[datepicker changeDate] e.date is undefined or null.');
        timeSelect.innerHTML = '<option value="">נא לבחור תאריך</option>';
    }
  });

  haircutTypeSelect.addEventListener('change', function() {
    removeValidationError(haircutTypeSelect);
    const selectedOption = haircutTypeSelect.options[haircutTypeSelect.selectedIndex];

    // Clear previous time slots and date if service changes
    timeSelect.innerHTML = '<option value="">בחרו תאריך ושירות</option>';
    // Do not clear dateInput.value here, allow user to keep date if they change service

    console.log('[haircutTypeSelect change] Selected service key:', this.value);

    if (selectedOption && selectedOption.value) {
      const isBookableOnline = selectedOption.dataset.bookableOnline === 'true';
      if (!isBookableOnline) {
        submitBtn.textContent = 'שלחו הודעה בוואטסאפ';
        submitBtn.classList.remove('btn-primary');
        submitBtn.classList.add('btn-success');
      } else {
        submitBtn.textContent = 'קבעו תור';
        submitBtn.classList.remove('btn-success');
        submitBtn.classList.add('btn-primary');
      }
      // If a date is already selected, try to load times for the new service
      if (dateInput.value && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.value)) {
          console.log('[haircutTypeSelect change] Date already selected, loading times for new service.');
          loadAvailableTimes(dateInput.value);
          goToStep(2); // Go to time selection (step 3, 0-indexed 2)
      } else {
          goToStep(1); // Go to date selection (step 2, 0-indexed 1)
          $('#date').datepicker('show');
      }
    } else {
        submitBtn.textContent = 'קבעו תור';
        submitBtn.classList.remove('btn-success');
        submitBtn.classList.add('btn-primary');
        goToStep(0); // Go back to first step if no service
    }
  });

  timeSelect.addEventListener('change', function() {
    removeValidationError(timeSelect);
    if (timeSelect.value) {
      goToStep(3); // Move to step 4 (0-indexed: 3)
    }
  });

  async function loadAvailableTimes(dateStr) {
    const serviceKey = haircutTypeSelect.value;
    const selectedOption = haircutTypeSelect.options[haircutTypeSelect.selectedIndex];

    // --- ADDED DEBUGGING ---
    console.log('[loadAvailableTimes] Called. Date:', dateStr, 'ServiceKey:', serviceKey);
    if (selectedOption) {
        console.log('[loadAvailableTimes] Selected Option Text:', selectedOption.textContent, 'BookableOnline:', selectedOption.dataset.bookableOnline);
    } else {
        console.log('[loadAvailableTimes] No option selected in haircutTypeSelect.');
    }
    // --- END DEBUGGING ---

    if (!selectedOption || !serviceKey) {
      timeSelect.innerHTML = '<option value="">בחרו סוג שירות קודם</option>';
      return;
    }

    const isBookableOnline = selectedOption.dataset.bookableOnline === 'true';
    if (!isBookableOnline) {
        timeSelect.innerHTML = '<option value="">שירות זה נקבע ידנית</option>';
        return;
    }

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        console.error('[loadAvailableTimes] Invalid or missing dateStr for API call:', dateStr);
        timeSelect.innerHTML = '<option value="">נא לבחור תאריך תקין</option>';
        return;
    }

    timeSelect.innerHTML = '<option value="">טוען זמנים...</option>';
    try {
      const requestBody = { date: dateStr, serviceKey: serviceKey };
      console.log('[loadAvailableTimes] Fetching availability with body:', JSON.stringify(requestBody));
      const response = await fetch(`${SERVER_BASE_URL}/get-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const data = await response.json(); // Always try to parse JSON

      if (!response.ok) {
        const errorMsg = data.error || `שגיאת שרת: ${response.status}. נסו שוב.`;
        console.error('[loadAvailableTimes] Server error response:', data);
        showValidationError(timeSelect, errorMsg);
        timeSelect.innerHTML = `<option value="">${errorMsg}</option>`;
        return;
      }

      // data.error might still exist even with 200 OK if backend logic decides so
      if (data.error) {
        console.warn('[loadAvailableTimes] Application error from server:', data.error);
        showValidationError(timeSelect, data.error);
        timeSelect.innerHTML = `<option value="">${data.error}</option>`;
        return;
      }

      const slots = data.availableSlots || [];
      if (slots.length === 0) {
        timeSelect.innerHTML = '<option value="">אין שעות פנויות בתאריך זה</option>';
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
      console.error("[loadAvailableTimes] Fetch/Network error:", err);
      showValidationError(timeSelect, 'שגיאה בטעינת הזמנים. בדקו את חיבור האינטרנט ונסו שוב.');
      timeSelect.innerHTML = '<option value="">שגיאה בטעינת זמנים</option>';
    }
  }

  bookingForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    if (!validateForm()) {
      const firstError = document.querySelector('.is-invalid, .form-control.error-field');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const serviceKey = haircutTypeSelect.value;
    const selectedOptionElement = haircutTypeSelect.options[haircutTypeSelect.selectedIndex];
    const isBookableOnline = selectedOptionElement.dataset.bookableOnline === 'true';
    const hebrewServiceName = selectedOptionElement.textContent;

    const date = dateInput.value;
    const time = timeSelect.value;
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const phone = document.getElementById('phone').value.trim();

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> שולח...';

    if (!isBookableOnline) {
      const baseWhatsappUrl = 'https://api.whatsapp.com/send';
      const barbershopPhoneNumber = '972547224551';
      let textMessage = `היי, שמי ${firstName} ${lastName} ואשמח לקבוע תור ל${hebrewServiceName}.`;
      if (date) textMessage += ` בתאריך ${date}`;
      if (time && timeSelect.options.length > 1 && timeSelect.value !== "") { // Only add time if available and selected
        textMessage += ` בסביבות השעה ${time}`;
      }
      textMessage += `. מספר הטלפון שלי הוא ${phone}.`;

      window.open(`${baseWhatsappUrl}?phone=${barbershopPhoneNumber}&text=${encodeURIComponent(textMessage)}`, '_blank');
      alert("הודעת הוואטסאפ מוכנה לשליחה! אנא שלחו את ההודעה כדי להשלים את הבקשה.");
      bookingForm.reset();
      $('#date').datepicker('update', ''); // Clear datepicker
      timeSelect.innerHTML = '<option value="">בחרו תאריך ושירות</option>';
      goToStep(0);
      loadServices(); // Reload services to reset select (might not be necessary if reset works well)
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'קבעו תור';
      return;
    }

    try {
      const finalCheckRequestBody = { date, serviceKey };
      console.log('[bookingForm submit] Final availability check with body:', JSON.stringify(finalCheckRequestBody));
      const finalCheckRes = await fetch(`${SERVER_BASE_URL}/get-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalCheckRequestBody)
      });
      const finalCheckData = await finalCheckRes.json();

      if (!finalCheckRes.ok || !finalCheckData.availableSlots || !finalCheckData.availableSlots.includes(time)) {
        alert("אופס! נראה שהשעה שבחרת כבר נתפסה או שאינה זמינה עוד. אנא בחרו שעה אחרת.");
        loadAvailableTimes(date);
        goToStep(2); // Go back to time selection (0-indexed: 2)
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'קבעו תור';
        return;
      }

      const bookRequestBody = { serviceKey, date, time, clientName: `${firstName} ${lastName}`, clientPhone: phone };
      console.log('[bookingForm submit] Booking appointment with body:', JSON.stringify(bookRequestBody));
      const response = await fetch(`${SERVER_BASE_URL}/book-appointment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookRequestBody)
      });
      const data = await response.json();

      if (!response.ok || data.error) {
        const errorDetail = data.error || `שגיאה ${response.status}.`;
        showValidationError(submitBtn, `לא ניתן לקבוע את התור: ${errorDetail}. נסו שעה אחרת או צרו קשר.`);
      } else {
        const appointmentDetails = {
          clientName: `${firstName} ${lastName}`,
          date,
          time,
          serviceName: hebrewServiceName
        };
        localStorage.setItem('appointmentDetails', JSON.stringify(appointmentDetails));
        window.location.href = '/confirmation/';
      }
    } catch (err) {
      console.error("[bookingForm submit] Booking error:", err);
      showValidationError(submitBtn, 'התרחשה שגיאה בקביעת התור. אנא נסו שוב מאוחר יותר או צרו קשר.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'קבעו תור';
    }
  });

  const phonePattern = /^(05\d|0\d|07\d|02|03|04|08|09)\d{7,8}$/;
  const namePattern = /^[A-Za-zא-תĀ-ž\s'-]+$/u;

  function validateForm() {
    let isValid = true;
    const existingFormError = bookingForm.querySelector('.form-error-general');
    if (existingFormError) existingFormError.remove();

    const selectedOption = haircutTypeSelect.options[haircutTypeSelect.selectedIndex];
    if (!haircutTypeSelect.value || !selectedOption) {
      showValidationError(haircutTypeSelect, 'אנא בחרו סוג שירות.');
      isValid = false;
    } else {
      removeValidationError(haircutTypeSelect);
    }

    if (selectedOption && selectedOption.dataset.bookableOnline === 'true') {
      if (!dateInput.value) {
        showValidationError(dateInput, 'אנא בחרו תאריך.');
        isValid = false;
      } else {
        removeValidationError(dateInput);
      }
      if (!timeSelect.value) {
        showValidationError(timeSelect, 'אנא בחרו שעה.');
        isValid = false;
      } else {
        removeValidationError(timeSelect);
      }
    } else if (selectedOption && selectedOption.dataset.bookableOnline === 'false') {
        // For manual booking via WhatsApp, date might be optional if you allow it.
        // If you require date even for WhatsApp, uncomment the validation below.
        /*
        if (!dateInput.value) {
            showValidationError(dateInput, 'אנא בחרו תאריך גם לשליחת הודעה.');
            isValid = false;
        } else {
            removeValidationError(dateInput);
        }
        */
    }


    const firstNameInput = document.getElementById('firstName');
    if (!firstNameInput.value.trim()) {
      showValidationError(firstNameInput, 'אנא הזינו שם פרטי.');
      isValid = false;
    } else if (!namePattern.test(firstNameInput.value.trim())) {
      showValidationError(firstNameInput, 'השם הפרטי יכול להכיל אותיות, רווחים ומקפים.');
      isValid = false;
    } else {
      removeValidationError(firstNameInput);
    }

    const lastNameInput = document.getElementById('lastName');
    if (!lastNameInput.value.trim()) {
      showValidationError(lastNameInput, 'אנא הזינו שם משפחה.');
      isValid = false;
    } else if (!namePattern.test(lastNameInput.value.trim())) {
      showValidationError(lastNameInput, 'שם המשפחה יכול להכיל אותיות, רווחים ומקפים.');
      isValid = false;
    } else {
      removeValidationError(lastNameInput);
    }

    const phoneInput = document.getElementById('phone');
    if (!phoneInput.value.trim()) {
      showValidationError(phoneInput, 'אנא הזינו מספר טלפון.');
      isValid = false;
    } else if (!phonePattern.test(phoneInput.value.trim())) {
      showValidationError(phoneInput, 'מספר טלפון לא תקין (לדוגמה: 0501234567).');
      isValid = false;
    } else {
      removeValidationError(phoneInput);
    }
    return isValid;
  }

  function showValidationError(inputElement, message) {
    if (!inputElement || inputElement.type === 'submit') {
        let formError = bookingForm.querySelector('.form-error-general');
        if (!formError) {
            formError = document.createElement('div');
            formError.className = 'form-error-general alert alert-danger mt-3';
            formError.setAttribute('role', 'alert');
            const progressBar = document.querySelector('.progress');
            if (progressBar) {
                progressBar.parentNode.insertBefore(formError, progressBar.nextSibling);
            } else {
                bookingForm.prepend(formError);
            }
        }
        formError.textContent = message;
        formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    inputElement.classList.add('is-invalid');
    inputElement.classList.add('error-field');
    let feedback = inputElement.parentElement.querySelector('.invalid-feedback');
    if (!feedback) {
      feedback = document.createElement('div');
      feedback.className = 'invalid-feedback';
      if (inputElement.parentNode.classList.contains('input-group')) {
        inputElement.parentNode.parentNode.appendChild(feedback);
      } else {
        inputElement.parentElement.appendChild(feedback);
      }
    }
    feedback.textContent = message;
    feedback.style.display = 'block';
  }

  function removeValidationError(inputElement) {
    if (inputElement) {
      inputElement.classList.remove('is-invalid');
      inputElement.classList.remove('error-field');
      const parent = inputElement.parentElement;
      const feedback = parent.querySelector('.invalid-feedback');
      if (feedback) {
        feedback.textContent = '';
        feedback.style.display = 'none';
      }
    }
    const existingFormError = bookingForm.querySelector('.form-error-general');
    if (existingFormError) existingFormError.remove();
  }

  const steps = Array.from(document.querySelectorAll('.step'));
  const progressBar = document.querySelector('.progress-bar');
  const totalFormSteps = steps.length; // Should be 6

  function updateProgressBar(currentStepZeroIndexed) {
    const currentStepOneIndexed = currentStepZeroIndexed + 1;
    const percentage = (currentStepOneIndexed / totalFormSteps) * 100;
    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', currentStepOneIndexed);
    progressBar.textContent = `${currentStepOneIndexed}/${totalFormSteps}`;
  }

  function goToStep(stepZeroIndexed) { // Expects 0 for step-1, 1 for step-2, etc.
    console.log('[goToStep] Going to step (0-indexed):', stepZeroIndexed);
    steps.forEach((step, index) => {
      step.classList.toggle('active', index === stepZeroIndexed);
    });
    updateProgressBar(stepZeroIndexed);
    const activeStepElement = steps[stepZeroIndexed];
    if (activeStepElement) {
        // Small delay to ensure step is visible before scrolling
        setTimeout(() => {
            activeStepElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
  }

  // Event listeners for Next/Prev buttons
  // Step 1 (idx 0) -> service selection (auto-next on change if valid)
  // Step 2 (idx 1) -> date selection (auto-next on changeDate if valid)
  // Step 3 (idx 2) -> time selection (auto-next on change if valid)

  document.getElementById('prevBtn-2')?.addEventListener('click', () => goToStep(0)); // Back to Service (idx 0)
  document.getElementById('prevBtn-3')?.addEventListener('click', () => goToStep(1)); // Back to Date (idx 1)

  document.getElementById('prevBtn-4')?.addEventListener('click', () => goToStep(2)); // Back to Time (idx 2)
  document.getElementById('nextBtn-4')?.addEventListener('click', () => {
    if(validateSingleStepInputs(steps[3])) goToStep(4); // To Last Name (idx 4)
  });

  document.getElementById('prevBtn-5')?.addEventListener('click', () => goToStep(3)); // Back to First Name (idx 3)
  document.getElementById('nextBtn-5')?.addEventListener('click', () => {
    if(validateSingleStepInputs(steps[4])) goToStep(5); // To Phone (idx 5)
  });

  document.getElementById('prevBtn-6')?.addEventListener('click', () => goToStep(4)); // Back to Last Name (idx 4)
  // Submit button on step 6 (idx 5) is handled by form submit event

  function validateSingleStepInputs(stepElement) {
    let stepIsValid = true;
    const inputsToValidate = stepElement.querySelectorAll('input[required], select[required]');
    inputsToValidate.forEach(input => {
        let currentInputValid = true;
        const labelText = input.labels && input.labels[0] ? input.labels[0].textContent : 'שדה זה';
        const errorMessageBase = `אנא מלאו ${labelText.replace(':', '')}.`;

        if (!input.value.trim()) {
            showValidationError(input, errorMessageBase);
            currentInputValid = false;
        } else {
            if (input.id === 'firstName' || input.id === 'lastName') {
                if (!namePattern.test(input.value.trim())) {
                    showValidationError(input, 'השם יכול להכיל אותיות, רווחים ומקפים.');
                    currentInputValid = false;
                } else { removeValidationError(input); }
            } else if (input.id === 'phone') {
                if (!phonePattern.test(input.value.trim())) {
                    showValidationError(input, 'מספר טלפון לא תקין (לדוגמה: 0501234567).');
                    currentInputValid = false;
                } else { removeValidationError(input); }
            } else { removeValidationError(input); }
        }
        if (!currentInputValid) stepIsValid = false;
    });
    return stepIsValid;
  }

  function formatDate(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  loadServices();
  goToStep(0); // Initialize to the first step
});
