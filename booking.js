document.addEventListener('DOMContentLoaded', function() {
  const SERVER_BASE_URL = 'https://hairformation-backend.onrender.com';

  const haircutTypeSelect = document.getElementById('haircutType');
  const dateInput = document.getElementById('date');
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

      haircutTypeSelect.innerHTML = '<option value="">בחרו סוג גליות</option>';
      allServicesData.forEach(service => {
        const option = document.createElement('option');
        option.value = service.key;
        option.textContent = service.hebrewName;
        option.dataset.bookableOnline = service.bookableOnline; // boolean
        option.dataset.isManualTimeSelection = service.isManualTimeSelection; // boolean
        if (service.manualBookingMessage) {
            option.dataset.manualBookingMessage = service.manualBookingMessage;
        }
        haircutTypeSelect.appendChild(option);
      });
      console.log('[loadServices] Services loaded and populated into select.');
    } catch (error) {
      console.error("[loadServices] Failed to load services:", error);
      showValidationError(haircutTypeSelect, 'שגיאה בטעינת סוגי הגליותים. נסו לרענן את הדף.');
      haircutTypeSelect.innerHTML = '<option value="">שגיאה בטעינת גליותים</option>';
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
        console.log('[datepicker changeDate] Date selected. Formatted:', formattedDate, 'Input value:', dateInput.value);
        // Ensure input value is also updated if datepicker doesn't do it reliably for manual changes
        if(dateInput.value !== formattedDate) dateInput.value = formattedDate;

        loadAvailableTimes(dateInput.value);
        goToStep(2); // To Time selection (0-indexed)
    } else {
        console.warn('[datepicker changeDate] e.date is undefined or null.');
        timeSelect.innerHTML = '<option value="">נא לבחור תאריך</option>';
    }
  });

  haircutTypeSelect.addEventListener('change', function() {
    removeValidationError(haircutTypeSelect);
    const selectedOption = haircutTypeSelect.options[haircutTypeSelect.selectedIndex];

    timeSelect.innerHTML = '<option value="">בחרו תאריך וגליות</option>';
    console.log('[haircutTypeSelect change] Selected service key:', this.value);

    if (selectedOption && selectedOption.value) {
      const isBookableOnline = selectedOption.dataset.bookableOnline === 'true'; // This is for actual booking
      const isManualTimeSelection = selectedOption.dataset.isManualTimeSelection === 'true'; // For showing time slots for WA

      if (!isBookableOnline && isManualTimeSelection) { // Gvanim, Keratin, Ampule
        submitBtn.textContent = 'שלחו הודעה בוואטסאפ';
        submitBtn.classList.remove('btn-primary');
        submitBtn.classList.add('btn-success');
      } else if (isBookableOnline) { // Normal online booking
        submitBtn.textContent = 'קבעו תור';
        submitBtn.classList.remove('btn-success');
        submitBtn.classList.add('btn-primary');
      } else { // Should not happen if all services are one of the above
        submitBtn.textContent = 'בחרו גליות';
        submitBtn.classList.remove('btn-success');
        submitBtn.classList.add('btn-primary');
      }

      if (dateInput.value && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.value)) {
          console.log('[haircutTypeSelect change] Date already selected, loading times for new service.');
          loadAvailableTimes(dateInput.value);
          goToStep(2); // To time selection (0-indexed)
      } else {
          goToStep(1); // To date selection (0-indexed)
          $('#date').datepicker('show');
      }
    } else {
        submitBtn.textContent = 'קבעו תור';
        submitBtn.classList.remove('btn-success');
        submitBtn.classList.add('btn-primary');
        goToStep(0); // Back to first step
    }
  });

  timeSelect.addEventListener('change', function() {
    removeValidationError(timeSelect);
    if (timeSelect.value) {
      goToStep(3); // To First Name (0-indexed)
    }
  });

  async function loadAvailableTimes(dateStr) {
    const serviceKey = haircutTypeSelect.value;
    const selectedOption = haircutTypeSelect.options[haircutTypeSelect.selectedIndex];

    console.log('[loadAvailableTimes] Called. Date:', dateStr, 'ServiceKey:', serviceKey);
    if (selectedOption) {
        console.log('[loadAvailableTimes] Selected Option Text:', selectedOption.textContent,
                    'BookableOnline:', selectedOption.dataset.bookableOnline,
                    'IsManualTimeSelection:', selectedOption.dataset.isManualTimeSelection);
    } else {
        console.log('[loadAvailableTimes] No option selected in haircutTypeSelect.');
        timeSelect.innerHTML = '<option value="">בחרו סוג גליות קודם</option>';
        return;
    }

    // No need to check bookableOnline here, backend handles it by returning slots for manualTimeSelection too
    if (!serviceKey) { // Should be caught by selectedOption check above, but good failsafe
        timeSelect.innerHTML = '<option value="">בחרו סוג גליות קודם</option>';
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

      if (data.error && !(data.isManualTimeSelection && data.availableSlots)) { // Allow proceeding if manual with slots
        console.warn('[loadAvailableTimes] Application error from server:', data.error);
        showValidationError(timeSelect, data.error);
        timeSelect.innerHTML = `<option value="">${data.error}</option>`;
        return;
      }

      // For manual time selection, use the manualBookingMessage if no slots, or guide user
      const isManualService = data.isManualTimeSelection === true || String(data.isManualTimeSelection) === "true";

      const slots = data.availableSlots || [];
      if (slots.length === 0) {
        if (isManualService && data.manualBookingMessage) {
            timeSelect.innerHTML = `<option value="">${data.manualBookingMessage.includes("שעה משוערת") ? "אין זמנים משוערים. עדיין ניתן לשלוח הודעה." : data.manualBookingMessage}</option>`;
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
    // These booleans are now definitive from the dataset
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

    if (isManualTimeSelection) { // This covers Gvanim, Keratin, Ampule
      const baseWhatsappUrl = 'https://api.whatsapp.com/send';
      const barbershopPhoneNumber = '972547224551';
      let textMessage = `היי, שמי ${firstName} ${lastName} ואשמח לקבוע תור ל${hebrewServiceName}.`;
      if (date) textMessage += ` בתאריך ${date}`;
      // Only include time if a valid time was actually selected from the (potentially short) list
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
      timeSelect.innerHTML = '<option value="">בחרו תאריך וגליות</option>';
      goToStep(0);
      // loadServices(); // Already done, form reset handles selects
      submitBtn.disabled = false;
      // Reset button text based on initial state or first option
      const firstServiceOption = haircutTypeSelect.options[0];
      if (firstServiceOption && firstServiceOption.value === "") { // if placeholder exists
        haircutTypeSelect.value = ""; // select placeholder
        submitBtn.textContent = 'קבעו תור'; // default text
        submitBtn.classList.remove('btn-success');
        submitBtn.classList.add('btn-primary');
      }
      return;
    }

    // This part is for truly bookableOnline services
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
            goToStep(2); // Back to Time (0-indexed)
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
        // Should not reach here if logic for isManualTimeSelection and isBookableOnline is correct
        console.error("Error: Service is neither bookable online nor manual time selection.");
        showValidationError(submitBtn, "שגיאה בהגדרת הגליות. אנא צרו קשר עם המספרה.");
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
      showValidationError(haircutTypeSelect, 'אנא בחרו סוג גליות.');
      isValid = false;
    } else {
      removeValidationError(haircutTypeSelect);
    }

    const isBookableOnline = selectedOption ? selectedOption.dataset.bookableOnline === 'true' : false;
    const isManualTimeSelection = selectedOption ? selectedOption.dataset.isManualTimeSelection === 'true' : false;

    if (isBookableOnline || isManualTimeSelection) { // Date required for both showing slots
      if (!dateInput.value) {
        showValidationError(dateInput, 'אנא בחרו תאריך.');
        isValid = false;
      } else {
        removeValidationError(dateInput);
      }
    }
    // Time is only strictly required for online booking, for manual it's optional for the WA message
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
        formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    inputElement.classList.add('is-invalid');
    inputElement.classList.add('error-field');
    let feedback = inputElement.parentElement.querySelector('.invalid-feedback');
    if (!feedback) {
      feedback = document.createElement('div');
      feedback.className = 'invalid-feedback';
      if (inputElement.parentNode.classList.contains('input-group')) { // For datepicker
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
      // For datepicker, feedback might be outside the immediate parent
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
    steps.forEach((step, index) => {
      step.classList.toggle('active', index === stepZeroIndexed);
    });
    updateProgressBar(stepZeroIndexed);
    const activeStepElement = steps[stepZeroIndexed];
    if (activeStepElement) {
        setTimeout(() => {
            // Check if the active step is for date and trigger datepicker show if it's not already visible
            if (stepZeroIndexed === 1 && !$('#date').data('datepicker').picker.is(":visible")) { // 1 is index for date step
                 // $('#date').datepicker('show'); // This might be too aggressive
            } else {
                 activeStepElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }
  }

  document.getElementById('prevBtn-2')?.addEventListener('click', () => goToStep(0));
  document.getElementById('prevBtn-3')?.addEventListener('click', () => goToStep(1));
  document.getElementById('prevBtn-4')?.addEventListener('click', () => goToStep(2));
  document.getElementById('nextBtn-4')?.addEventListener('click', () => {
    if(validateSingleStepInputs(steps[3])) goToStep(4);
  });
  document.getElementById('prevBtn-5')?.addEventListener('click', () => goToStep(3));
  document.getElementById('nextBtn-5')?.addEventListener('click', () => {
    if(validateSingleStepInputs(steps[4])) goToStep(5);
  });
  document.getElementById('prevBtn-6')?.addEventListener('click', () => goToStep(4));

  function validateSingleStepInputs(stepElement) {
    let stepIsValid = true;
    const inputsToValidate = stepElement.querySelectorAll('input[required], select[required]');
    inputsToValidate.forEach(input => {
        let currentInputValid = true;
        const labelElement = document.querySelector(`label[for="${input.id}"]`);
        const labelText = labelElement ? labelElement.textContent : 'שדה זה';
        const errorMessageBase = `אנא מלאו ${labelText.replace(':', '')}.`;

        if (!input.value.trim()) {
            showValidationError(input, errorMessageBase);
            currentInputValid = false;
        } else {
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
  goToStep(0);
});
