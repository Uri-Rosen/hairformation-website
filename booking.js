document.addEventListener('DOMContentLoaded', function() {
  const SERVER_BASE_URL = 'https://hairformation-backend.onrender.com'; // Ensure this is correct

  const haircutTypeSelect = document.getElementById('haircutType');
  const dateInput = document.getElementById('date');
  const timeSelect = document.getElementById('time');
  const bookingForm = document.getElementById('bookingForm');
  const submitBtn = document.getElementById('submitBtn');

  let allServicesData = []; // To store service details fetched from backend

  // Function to populate service select dropdown
  async function loadServices() {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/services`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      allServicesData = await response.json();

      haircutTypeSelect.innerHTML = '<option value="">בחרו סוג שירות</option>'; // Clear existing and add placeholder
      allServicesData.forEach(service => {
        const option = document.createElement('option');
        option.value = service.key; // Use the serviceKey from backend
        option.textContent = service.hebrewName;
        // Store bookableOnline and manualBookingMessage directly on the option for easy access
        option.dataset.bookableOnline = service.bookableOnline;
        if (service.manualBookingMessage) {
            option.dataset.manualBookingMessage = service.manualBookingMessage;
        }
        haircutTypeSelect.appendChild(option);
      });
    } catch (error) {
      console.error("Failed to load services:", error);
      showValidationError(haircutTypeSelect, 'שגיאה בטעינת סוגי השירותים. נסו לרענן את הדף.');
      haircutTypeSelect.innerHTML = '<option value="">שגיאה בטעינת שירותים</option>';
    }
  }

  // Initialize the datepicker
  $('#date').datepicker({
    format: 'yyyy-mm-dd',
    language: 'he',
    orientation: 'bottom left',
    weekStart: 0, // Sunday
    daysOfWeekDisabled: [1, 6], // Monday, Saturday
    autoclose: true,
    startDate: new Date(),
    todayHighlight: true,
    rtl: true
  }).on('changeDate', function(e) {
    if (e.date) {
        const selectedDate = e.date;
        const formattedDate = formatDate(selectedDate);
        // dateInput.value = formattedDate; // Datepicker sets it directly
        loadAvailableTimes(formattedDate);
        goToStep(3); // Move to time selection
    }
  });

  haircutTypeSelect.addEventListener('change', function() {
    removeValidationError(haircutTypeSelect);
    const selectedOption = haircutTypeSelect.options[haircutTypeSelect.selectedIndex];

    if (selectedOption && selectedOption.value) {
      const isBookableOnline = selectedOption.dataset.bookableOnline === 'true';
      if (!isBookableOnline) {
        submitBtn.textContent = 'שלחו הודעה בוואטסאפ'; // Change button text
        submitBtn.classList.remove('btn-primary');
        submitBtn.classList.add('btn-success');
      } else {
        submitBtn.textContent = 'קבעו תור'; // Reset button text
        submitBtn.classList.remove('btn-success');
        submitBtn.classList.add('btn-primary');
      }
      goToStep(2); // Move to date selection
      $('#date').datepicker('show'); // Show datepicker automatically
    } else {
        // Reset button if no service is selected
        submitBtn.textContent = 'קבעו תור';
        submitBtn.classList.remove('btn-success');
        submitBtn.classList.add('btn-primary');
        timeSelect.innerHTML = '<option value="">בחרו תאריך ושירות</option>';
    }
  });

  timeSelect.addEventListener('change', function() {
    removeValidationError(timeSelect);
    if (timeSelect.value) {
      goToStep(4); // Move to first name
    }
  });

  async function loadAvailableTimes(dateStr) {
    const serviceKey = haircutTypeSelect.value; // This is now the serviceKey
    const selectedOption = haircutTypeSelect.options[haircutTypeSelect.selectedIndex];

    if (!selectedOption || !serviceKey) {
      timeSelect.innerHTML = '<option value="">בחרו סוג שירות קודם</option>';
      return;
    }

    const isBookableOnline = selectedOption.dataset.bookableOnline === 'true';
    if (!isBookableOnline) {
        timeSelect.innerHTML = '<option value="">שירות זה נקבע ידנית</option>';
        // Optionally, you could allow time selection for WhatsApp message
        // For now, we assume manual services don't show time slots
        return;
    }


    timeSelect.innerHTML = '<option value="">טוען זמנים...</option>';
    try {
      const response = await fetch(`${SERVER_BASE_URL}/get-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, serviceKey: serviceKey }) // Send serviceKey
      });
      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || `שגיאת שרת: ${response.status}`;
        showValidationError(timeSelect, errorMsg);
        timeSelect.innerHTML = `<option value="">${errorMsg}</option>`;
        return;
      }


      if (data.error) { // Backend specific error after 200 OK (should be rare with good status codes)
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
      console.error("Error loading times:", err);
      showValidationError(timeSelect, 'שגיאה בטעינת הזמנים. נסו שוב.');
      timeSelect.innerHTML = '<option value="">שגיאה בטעינת זמנים</option>';
    }
  }

  bookingForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    if (!validateForm()) { // validateForm will handle showing errors
      const firstError = document.querySelector('.is-invalid, .form-control.error-field'); // .error-field for custom
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const serviceKey = haircutTypeSelect.value;
    const selectedOptionElement = haircutTypeSelect.options[haircutTypeSelect.selectedIndex];
    const isBookableOnline = selectedOptionElement.dataset.bookableOnline === 'true';
    const manualBookingMessage = selectedOptionElement.dataset.manualBookingMessage;
    const hebrewServiceName = selectedOptionElement.textContent; // Get Hebrew name from option text

    const date = dateInput.value;
    const time = timeSelect.value; // Might be empty for manual booking if not allowing time selection
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const phone = document.getElementById('phone').value.trim();

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> שולח...';


    if (!isBookableOnline) {
      // Construct WhatsApp message
      const baseWhatsappUrl = 'https://api.whatsapp.com/send';
      const barbershopPhoneNumber = '972547224551'; // Replace with actual number if different
      let textMessage = `היי, שמי ${firstName} ${lastName} ואשמח לקבוע תור ל${hebrewServiceName}.`;
      if (date) textMessage += ` בתאריך ${date}`;
      if (time) textMessage += ` בסביבות השעה ${time}`; // Use 'בסביבות' if time is optional
      textMessage += `. מספר הטלפון שלי הוא ${phone}.`;

      window.open(`${baseWhatsappUrl}?phone=${barbershopPhoneNumber}&text=${encodeURIComponent(textMessage)}`, '_blank');
      // Reset form or show success message for WhatsApp
      alert("הודעת הוואטסאפ מוכנה לשליחה!");
      bookingForm.reset();
      goToStep(1);
      loadServices(); // Reload services to reset select
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'קבעו תור';
      return;
    }

    // For normal online booking
    try {
      // Optional: Final availability check (backend also does this, but can prevent wasted submission)
      // This adds an extra request, consider if necessary based on traffic.
      const finalCheckRes = await fetch(`${SERVER_BASE_URL}/get-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, serviceKey })
      });
      const finalCheckData = await finalCheckRes.json();
      if (!finalCheckRes.ok || !(finalCheckData.availableSlots && finalCheckData.availableSlots.includes(time))) {
        alert("אופס! נראה שהשעה שבחרת כבר נתפסה. אנא בחרו שעה אחרת.");
        loadAvailableTimes(date); // Refresh time slots
        goToStep(3); // Go back to time selection
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'קבעו תור';
        return;
      }

      const response = await fetch(`${SERVER_BASE_URL}/book-appointment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send serviceKey, clientName, clientPhone
        body: JSON.stringify({ serviceKey, date, time, clientName: `${firstName} ${lastName}`, clientPhone: phone })
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
          serviceName: hebrewServiceName // Use the displayed Hebrew name for confirmation
        };
        localStorage.setItem('appointmentDetails', JSON.stringify(appointmentDetails));
        window.location.href = '/confirmation/'; // Redirect to your confirmation page
      }
    } catch (err) {
      console.error("Booking error:", err);
      showValidationError(submitBtn, 'התרחשה שגיאה בקביעת התור. אנא נסו שוב מאוחר יותר או צרו קשר.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'קבעו תור';
    }
  });

  const phonePattern = /^(05\d|0\d|07\d|02|03|04|08|09)\d{7,8}$/; // More flexible Israeli phone pattern
  const namePattern = /^[A-Za-zא-תĀ-ž\s'-]+$/u; // Allows spaces, hyphens, apostrophes in names, and more Unicode letters

  function validateForm() {
    let isValid = true;
    // Clear all previous general form errors
    const existingFormError = bookingForm.querySelector('.form-error-general');
    if (existingFormError) existingFormError.remove();

    // --- Service Type ---
    const selectedOption = haircutTypeSelect.options[haircutTypeSelect.selectedIndex];
    if (!haircutTypeSelect.value || !selectedOption) {
      showValidationError(haircutTypeSelect, 'אנא בחרו סוג שירות.');
      isValid = false;
    } else {
      removeValidationError(haircutTypeSelect);
    }

    // For online bookable services, date and time are mandatory
    if (selectedOption && selectedOption.dataset.bookableOnline === 'true') {
      // --- Date ---
      if (!dateInput.value) {
        showValidationError(dateInput, 'אנא בחרו תאריך.');
        isValid = false;
      } else {
        removeValidationError(dateInput);
      }
      // --- Time ---
      if (!timeSelect.value) {
        showValidationError(timeSelect, 'אנא בחרו שעה.');
        isValid = false;
      } else {
        removeValidationError(timeSelect);
      }
    }
    // For manual booking, date might be optional for the form if we want to allow it
    // For now, we'll keep it as required if a date picker was touched.

    // --- First Name ---
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

    // --- Last Name ---
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

    // --- Phone ---
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
    // If inputElement is submitBtn or null, show general form error
    if (!inputElement || inputElement.type === 'submit') {
        let formError = bookingForm.querySelector('.form-error-general');
        if (!formError) {
            formError = document.createElement('div');
            formError.className = 'form-error-general alert alert-danger mt-3'; // Use Bootstrap alert
            formError.setAttribute('role', 'alert');
            // Insert after progress bar or at the top of the form
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
    inputElement.classList.add('error-field'); // Custom class for easier selection
    let feedback = inputElement.parentElement.querySelector('.invalid-feedback');
    if (!feedback) {
      feedback = document.createElement('div');
      feedback.className = 'invalid-feedback';
      // Insert after the input element itself, or its wrapper if it's inside one (like datepicker)
      if (inputElement.parentNode.classList.contains('input-group')) {
        inputElement.parentNode.parentNode.appendChild(feedback);
      } else {
        inputElement.parentElement.appendChild(feedback);
      }
    }
    feedback.textContent = message;
    feedback.style.display = 'block'; // Ensure it's visible
  }

  function removeValidationError(inputElement) {
    if (inputElement) {
      inputElement.classList.remove('is-invalid');
      inputElement.classList.remove('error-field');
      const feedback = inputElement.parentElement.querySelector('.invalid-feedback');
      if (feedback) {
        feedback.textContent = '';
        feedback.style.display = 'none'; // Hide it
      }
    }
     // Also clear general form error if it exists
    const existingFormError = bookingForm.querySelector('.form-error-general');
    if (existingFormError) existingFormError.remove();
  }


  // --- Multi-step form logic ---
  const steps = Array.from(document.querySelectorAll('.step'));
  const progressBar = document.querySelector('.progress-bar');
  const totalFormSteps = steps.length;

  function updateProgressBar(currentStepIndex) {
    const percentage = ((currentStepIndex + 1) / totalFormSteps) * 100;
    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', currentStepIndex + 1);
    progressBar.textContent = `${currentStepIndex + 1}/${totalFormSteps}`;
  }

  function goToStep(stepIndex) {
    steps.forEach((step, index) => {
      step.classList.toggle('active', index === stepIndex);
    });
    updateProgressBar(stepIndex);
    // Scroll to the top of the form or the current step
    const activeStepElement = steps[stepIndex];
    if (activeStepElement) {
        activeStepElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Add event listeners to existing next/prev buttons in your HTML for steps 4, 5, 6
  // For steps 1, 2, 3, navigation is handled by service/date/time selection events
  document.getElementById('nextBtn-4')?.addEventListener('click', () => {
    if(validateSingleStepInputs(steps[3])) goToStep(4); // from step 4 (idx 3) to step 5 (idx 4)
  });
  document.getElementById('prevBtn-4')?.addEventListener('click', () => goToStep(2)); // to step 3 (idx 2)

  document.getElementById('nextBtn-5')?.addEventListener('click', () => {
    if(validateSingleStepInputs(steps[4])) goToStep(5); // from step 5 (idx 4) to step 6 (idx 5)
  });
  document.getElementById('prevBtn-5')?.addEventListener('click', () => goToStep(3)); // to step 4 (idx 3)

  document.getElementById('prevBtn-2')?.addEventListener('click', () => goToStep(0)); // to step 1 (idx 0)
  document.getElementById('prevBtn-3')?.addEventListener('click', () => goToStep(1)); // to step 2 (idx 1)
  document.getElementById('prevBtn-6')?.addEventListener('click', () => goToStep(4)); // to step 5 (idx 4)

  function validateSingleStepInputs(stepElement) {
    let stepIsValid = true;
    const inputsToValidate = stepElement.querySelectorAll('input[required], select[required]');
    inputsToValidate.forEach(input => {
        // A more specific validation for each input type could be added here if needed
        let currentInputValid = true;
        if (!input.value.trim()) {
            showValidationError(input, `אנא מלאו שדה זה: ${input.labels[0]?.textContent || ''}`);
            currentInputValid = false;
        } else {
            // Add specific pattern checks if necessary, e.g., for name, phone
            if (input.id === 'firstName' || input.id === 'lastName') {
                if (!namePattern.test(input.value.trim())) {
                    showValidationError(input, 'השם יכול להכיל אותיות, רווחים ומקפים.');
                    currentInputValid = false;
                } else {
                     removeValidationError(input);
                }
            } else if (input.id === 'phone') {
                if (!phonePattern.test(input.value.trim())) {
                    showValidationError(input, 'מספר טלפון לא תקין.');
                    currentInputValid = false;
                } else {
                     removeValidationError(input);
                }
            }
            else {
                 removeValidationError(input);
            }
        }
        if (!currentInputValid) stepIsValid = false;
    });
    return stepIsValid;
  }


  // --- Utility function ---
  function formatDate(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Initial actions
  loadServices(); // Load services when the page loads
  goToStep(0); // Start at the first step
});
