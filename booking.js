document.addEventListener('DOMContentLoaded', function() {
  const SERVER_BASE_URL = 'https://hairformation-backend.onrender.com';

  const haircutTypeSelect = document.getElementById('haircutType');
  const dateInput = document.getElementById('date');
  const timeSelect = document.getElementById('time');
  const bookingForm = document.getElementById('bookingForm');
  const submitBtn = document.getElementById('submitBtn');

  let allServicesData = [];
  let currentServiceKeyForAutoAdvance = null; // To help with re-selection logic

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
        option.dataset.isManualTimeSelection = service.isManualTimeSelection;
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
        const formattedDate = formatDate(e.date);
        if(dateInput.value !== formattedDate) dateInput.value = formattedDate;
        console.log('[datepicker changeDate] Date selected. Formatted:', formattedDate, 'Input value:', dateInput.value);
        loadAvailableTimes(dateInput.value);
        goToStep(2); // To Time selection (0-indexed)
    } else {
        console.warn('[datepicker changeDate] e.date is undefined or null.');
        timeSelect.innerHTML = '<option value="">נא לבחור תאריך</option>';
    }
  });

  // This function will handle the logic after a service is confirmed (either by change or re-confirmation)
  function processServiceSelection() {
    removeValidationError(haircutTypeSelect);
    const selectedOption = haircutTypeSelect.options[haircutTypeSelect.selectedIndex];

    timeSelect.innerHTML = '<option value="">בחרו תאריך ושירות</option>';
    console.log('[processServiceSelection] Current service key:', haircutTypeSelect.value);

    if (selectedOption && selectedOption.value) {
      currentServiceKeyForAutoAdvance = selectedOption.value; // Store the current valid selection
      const isBookableOnline = selectedOption.dataset.bookableOnline === 'true';
      const isManualTimeSelection = selectedOption.dataset.isManualTimeSelection === 'true';

      if (!isBookableOnline && isManualTimeSelection) {
        submitBtn.textContent = 'שלחו הודעה בוואטסאפ';
        submitBtn.classList.remove('btn-primary');
        submitBtn.classList.add('btn-success');
      } else if (isBookableOnline) {
        submitBtn.textContent = 'קבעו תור';
        submitBtn.classList.remove('btn-success');
        submitBtn.classList.add('btn-primary');
      } else {
        submitBtn.textContent = 'בחרו שירות'; // Should ideally not happen
        submitBtn.classList.remove('btn-success');
        submitBtn.classList.add('btn-primary');
      }

      // Try to advance to date step
      goToStep(1); // Go to date selection (0-indexed 1)

      // If a date is already selected, try to load times for the new service
      // and potentially advance further to time selection.
      if (dateInput.value && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.value)) {
          console.log('[processServiceSelection] Date already selected, loading times.');
          loadAvailableTimes(dateInput.value);
          goToStep(2); // Advance to time selection (0-indexed 2)
      } else {
          // If no date, just show datepicker (already advanced to date step)
          $('#date').datepicker('show');
      }
    } else {
        currentServiceKeyForAutoAdvance = null; // No valid service selected
        submitBtn.textContent = 'קבעו תור';
        submitBtn.classList.remove('btn-success');
        submitBtn.classList.add('btn-primary');
        // If user deselects to the placeholder, don't auto-advance back to step 0 here,
        // they are already on step 0.
    }
  }

  haircutTypeSelect.addEventListener('change', processServiceSelection);

  // To handle the "re-selection" case when coming back to step 1:
  // If step 1 becomes active and a service is already selected,
  // we need a way to re-trigger the advancement logic.
  // We can do this by checking when goToStep(0) is called.
  // However, a simpler way is that the user will typically click a "Previous" button to get to step 0.
  // When they are on step 0, if `haircutTypeSelect.value` is already set,
  // they would expect that if they don't change it, they can still proceed.
  // Since we removed nextBtn-1, the only way to proceed from step 0 is to select a service (triggering 'change')
  // or to have a previously selected service and then pick a date.

  // The `processServiceSelection` will be called on 'change'.
  // If they go back to step 0, and `haircutTypeSelect` has a value,
  // and then they click on the date picker (which is on step 1),
  // the `processServiceSelection` should have already set the context.

  timeSelect.addEventListener('change', function() {
    removeValidationError(timeSelect);
    if (timeSelect.value && timeSelect.value !== "") {
      goToStep(3); // To First Name (0-indexed)
    }
  });

  async function loadAvailableTimes(dateStr) {
    const serviceKey = haircutTypeSelect.value; // Use the current value
    const selectedOption = haircutTypeSelect.options[haircutTypeSelect.selectedIndex];

    console.log('[loadAvailableTimes] Called. Date:', dateStr, 'ServiceKey:', serviceKey);
    if (selectedOption) {
        console.log('[loadAvailableTimes] Selected Option Text:', selectedOption.textContent,
                    'BookableOnline:', selectedOption.dataset.bookableOnline,
                    'IsManualTimeSelection:', selectedOption.dataset.isManualTimeSelection);
    } else {
        console.log('[loadAvailableTimes] No option selected in haircutTypeSelect.');
        timeSelect.innerHTML = '<option value="">בחרו סוג שירות קודם</option>';
        return;
    }

    if (!serviceKey) { // If serviceKey is empty (e.g. placeholder selected)
        timeSelect.innerHTML = '<option value="">בחרו סוג שירות קודם</option>';
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
      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || `שגיאת שרת: ${response.status}. נסו שוב.`;
        console.error('[loadAvailableTimes] Server error response:', data);
        showValidationError(timeSelect, errorMsg);
        timeSelect.innerHTML = `<option value="">${errorMsg}</option>`;
        return;
      }

      if (data.error && !(data.isManualTimeSelection && data.availableSlots)) {
        console.warn('[loadAvailableTimes] Application error from server:', data.error);
        showValidationError(timeSelect, data.error);
        timeSelect.innerHTML = `<option value="">${data.error}</option>`;
        return;
      }

      const isManualService = data.isManualTimeSelection === true || String(data.isManualTimeSelection) === "true";
      const slots = data.availableSlots || [];

      if (slots.length === 0) {
        if (isManualService && data.manualBookingMessage) {
            timeSelect.innerHTML = `<option value="">${data.manualBookingMessage.includes("שעה משוערת") ? "אין זמנים משוערים פנויים. עדיין ניתן לשלוח הודעה." : data.manualBookingMessage}</option>`;
        } else {
            timeSelect.innerHTML = '<option value="">אין שעות פנויות בתאריך זה</option>';
        }
      } else {
        timeSelect.innerHTML = `<option value="">בחרו שעה${isManualService ? " (משוערת)" : ""}</option>`;
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
    const isManualTimeSelection = selectedOptionElement.dataset.isManualTimeSelection === 'true';
    const hebrewServiceName = selectedOptionElement.textContent;

    const date = dateInput.value;
    const time = timeSelect.value;
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const phone = document.getElementById('phone').value.trim();

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> שולח...';

    if (isManualTimeSelection) {
      const baseWhatsappUrl = 'https://api.whatsapp.com/send';
      const barbershopPhoneNumber = '972547224551';
      let textMessage = `היי, שמי ${firstName} ${lastName} ואשמח לקבוע תור ל${hebrewServiceName}.`;
      if (date) textMessage += ` בתאריך ${date}`;
      if (time && timeSelect.options.length > 1 && timeSelect.value !== "" && time !== timeSelect.options[0].value) {
          textMessage += ` בסביבות השעה ${time}`;
      } else if (date) {
          textMessage += ` (שעה תיקבע טלפונית)`;
      }
      textMessage += `. מספר הטלפון שלי הוא ${phone}.`;

      window.open(`${baseWhatsappUrl}?phone=${barbershopPhoneNumber}&text=${encodeURIComponent(textMessage)}`, '_blank');
      alert("הודעת הוואטסאפ מוכנה לשליחה! אנא שלחו את ההודעה כדי להשלים את הבקשה.");
      bookingForm.reset();
      $('#date').datepicker('update', '');
      timeSelect.innerHTML = '<option value="">בחרו תאריך ושירות</option>';
      haircutTypeSelect.value = "";
      goToStep(0);
      submitBtn.disabled = false;
      submitBtn.textContent = 'קבעו תור';
      submitBtn.classList.remove('btn-success');
      submitBtn.classList.add('btn-primary');
      return;
    }

    if (isBookableOnline) {
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
            goToStep(2);
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
    } else {
        console.error("Error: Service is neither bookable online nor manual time selection.");
        showValidationError(submitBtn, "שגיאה בהגדרת השירות. אנא צרו קשר עם המספרה.");
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

    const isBookableOnline = selectedOption ? selectedOption.dataset.bookableOnline === 'true' : false;
    const isManualTimeSelection = selectedOption ? selectedOption.dataset.isManualTimeSelection === 'true' : false;

    if (isBookableOnline || isManualTimeSelection) {
      if (!dateInput.value) {
        showValidationError(dateInput, 'אנא בחרו תאריך.');
        isValid = false;
      } else {
        removeValidationError(dateInput);
      }
    }
    if (isBookableOnline) {
      if (!timeSelect.value) {
        showValidationError(timeSelect, 'אנא בחרו שעה.');
        isValid = false;
      } else {
        removeValidationError(timeSelect);
      }
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
        if (formError.scrollIntoView) formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      const feedbackElement = parent.classList.contains('input-group') ?
                              parent.parentElement.querySelector('.invalid-feedback') :
                              parent.querySelector('.invalid-feedback');
      if (feedbackElement) {
        feedbackElement.textContent = '';
        feedbackElement.style.display = 'none';
      }
    }
    const existingFormError = bookingForm.querySelector('.form-error-general');
    if (existingFormError) existingFormError.remove();
  }

  const steps = Array.from(document.querySelectorAll('.step'));
  const progressBar = document.querySelector('.progress-bar');
  const totalFormSteps = steps.length;

  function updateProgressBar(currentStepZeroIndexed) {
    const currentStepOneIndexed = currentStepZeroIndexed + 1;
    const percentage = (currentStepOneIndexed / totalFormSteps) * 100;
    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', currentStepOneIndexed);
    progressBar.textContent = `${currentStepOneIndexed}/${totalFormSteps}`;
  }

  function goToStep(stepZeroIndexed) {
    console.log('[goToStep] Going to step (0-indexed):', stepZeroIndexed);
    // Ensure stepZeroIndexed is within bounds
    stepZeroIndexed = Math.max(0, Math.min(stepZeroIndexed, steps.length - 1));

    steps.forEach((step, index) => {
      step.classList.toggle('active', index === stepZeroIndexed);
    });
    updateProgressBar(stepZeroIndexed);
    const activeStepElement = steps[stepZeroIndexed];
    if (activeStepElement && activeStepElement.scrollIntoView) {
        setTimeout(() => {
            activeStepElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
  }

  // Previous button listeners
  document.getElementById('prevBtn-2')?.addEventListener('click', () => goToStep(0)); // Date -> Service
  document.getElementById('prevBtn-3')?.addEventListener('click', () => goToStep(1)); // Time -> Date
  document.getElementById('prevBtn-4')?.addEventListener('click', () => goToStep(2)); // FName -> Time
  document.getElementById('prevBtn-5')?.addEventListener('click', () => goToStep(3)); // LName -> FName
  document.getElementById('prevBtn-6')?.addEventListener('click', () => goToStep(4)); // Phone -> LName

  // Next button listeners for steps that don't auto-advance
  // Step 1 (Service) auto-advances on 'change' via processServiceSelection
  // Step 2 (Date) auto-advances on 'changeDate'
  // Step 3 (Time) auto-advances on 'change'
  document.getElementById('nextBtn-4')?.addEventListener('click', () => { // FName -> LName
    if(validateSingleStepInputs(steps[3])) goToStep(4);
  });
  document.getElementById('nextBtn-5')?.addEventListener('click', () => { // LName -> Phone
    if(validateSingleStepInputs(steps[4])) goToStep(5);
  });
  // Submit button on step 6 is handled by the form's submit event.

  function validateSingleStepInputs(stepElement) {
    let stepIsValid = true;
    // Only validate inputs that are currently visible within the active step
    if (!stepElement || !stepElement.classList.contains('active')) {
        // If the step is not active, we might not want to validate it,
        // or this function was called erroneously.
        // For now, assume it's called only for the active step's "Next" button.
        // return true; // Or handle as an error/warning
    }

    const inputsToValidate = stepElement.querySelectorAll('input[required]:not([type="hidden"]), select[required]:not([type="hidden"])');
    inputsToValidate.forEach(input => {
        let currentInputValid = true;
        const labelElement = document.querySelector(`label[for="${input.id}"]`);
        const labelText = labelElement ? labelElement.textContent : (input.placeholder || 'שדה זה');
        // Remove colon from label text for error message
        const cleanedLabelText = labelText.endsWith(':') ? labelText.slice(0, -1) : labelText;
        const errorMessageBase = `אנא מלאו ${cleanedLabelText}.`;


        if (input.tagName === 'SELECT' && !input.value) {
            showValidationError(input, errorMessageBase);
            currentInputValid = false;
        } else if (input.tagName !== 'SELECT' && !input.value.trim()) {
            showValidationError(input, errorMessageBase);
            currentInputValid = false;
        }
        else { // Value exists, perform pattern checks if applicable
            if (input.id === 'firstName' || input.id === 'lastName') {
                if (!namePattern.test(input.value.trim())) {
                    showValidationError(input, 'השם יכול להכיל אותיות (עברית/אנגלית), רווחים ומקפים.');
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
  goToStep(0); // Initialize to the first step (Service selection)
});
