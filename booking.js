document.addEventListener('DOMContentLoaded', function() {
  const SERVER_BASE_URL = 'https://hairformation-backend.onrender.com';

  const haircutTypeSelect = document.getElementById('haircutType');
  const dateInput = document.getElementById('date');
  const timeSelect = document.getElementById('time');
  const bookingForm = document.getElementById('bookingForm');
  const submitBtn = document.getElementById('submitBtn');

  // Map the special services to their Hebrew names
  const serviceTypeToHebrew = {
    Gvanim: "גוונים",
    Keratin: "טיפול קרטין",
    Ampule: "אמפולה",
  };

  // Initialize the datepicker with Hebrew language and proper options
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
    loadAvailableTimes(formattedDate);
    goToStep(3);
  });

  haircutTypeSelect.addEventListener('change', function() {
    removeValidationError(haircutTypeSelect);
    if (haircutTypeSelect.value) {
      if (["Gvanim", "Keratin", "Ampule"].includes(haircutTypeSelect.value)) {
        submitBtn.classList.remove('btn-primary');
        submitBtn.classList.add('btn-success');
      } else {
        submitBtn.classList.remove('btn-success');
        submitBtn.classList.add('btn-primary');
      }
      goToStep(2);
      $('#date').datepicker('show');
    }
  });

  timeSelect.addEventListener('change', function() {
    removeValidationError(timeSelect);
    if (timeSelect.value) {
      goToStep(4);
    }
  });

  async function loadAvailableTimes(dateStr) {
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
        showValidationError(timeSelect, data.error);
        timeSelect.innerHTML = '<option value="">אין שעות פנויות</option>';
        return;
      }

      const slots = data.availableSlots || [];
      if (slots.length === 0) {
        timeSelect.innerHTML = '<option value="">אין שעות פנויות</option>';
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
      showValidationError(timeSelect, 'שגיאה בטעינת הזמנים');
      timeSelect.innerHTML = '<option value="">שגיאה בטעינת הזמנים</option>';
    }
  }

  bookingForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const isValid = validateForm();
    if (!isValid) {
      const firstError = document.querySelector('.is-invalid');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const serviceType = haircutTypeSelect.value;
    const date = dateInput.value;
    const time = timeSelect.value;
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const phone = document.getElementById('phone').value.trim();

    // For special services, open WhatsApp with a message that includes the Hebrew service name
    if (["Gvanim", "Keratin", "Ampule"].includes(serviceType)) {
      const baseWhatsappUrl = 'https://api.whatsapp.com/send';
      const phoneNumber = '972547224551';
      const hebrewService = serviceTypeToHebrew[serviceType] || serviceType;
      const textMessage = `היי, שמי ${firstName} ${lastName} ואשמח לקבוע תור בתאריך ${date} בשעה ${time} ל${hebrewService}.`;
      window.open(`${baseWhatsappUrl}?phone=${phoneNumber}&text=${encodeURIComponent(textMessage)}`, '_blank');
      return;
    }

    // For the normal booking procedure, perform a final availability check
    try {
      const finalCheckRes = await fetch(`${SERVER_BASE_URL}/get-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, serviceType })
      });
      const finalCheckData = await finalCheckRes.json();
      const latestSlots = finalCheckData.availableSlots || [];
      if (!latestSlots.includes(time)) {
        alert("אופס! נראה שמישהו אחר כבר קבע את השעה הזו. אנא בחרו שעה אחרת.");
        return;
      }
    } catch (err) {
      alert("שגיאה בבדיקה הסופית. אנא נסו שוב מאוחר יותר.");
      return;
    }

    try {
      const response = await fetch(`${SERVER_BASE_URL}/book-appointment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType, date, time, firstName, lastName, phone })
      });
      const data = await response.json();

      if (data.error) {
        showValidationError(timeSelect, `לא ניתן לקבוע את התור: ${data.error}`);
      } else {
        const appointmentDetails = {
          firstName,
          lastName,
          date,
          time,
          haircutType: serviceType
        };
        localStorage.setItem('appointmentDetails', JSON.stringify(appointmentDetails));
        window.location.href = 'confirmation.html';
      }
    } catch (err) {
      showValidationError(null, 'התרחשה שגיאה בקביעת התור. אנא נסו שוב מאוחר יותר.');
    }
  });

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
    } else {
      let formError = bookingForm.querySelector('.form-error');
      if (!formError) {
        formError = document.createElement('div');
        formError.className = 'form-error text-danger mb-3';
        bookingForm.prepend(formError);
      }
      formError.textContent = message;
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

  // Multi-step form navigation
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
      case 'date': return 'אנא בחרו תאריך.';
      case 'time': return 'אנא בחרו שעה.';
      case 'firstName': return 'אנא הזינו את השם הפרטי.';
      case 'lastName': return 'אנא הזינו את שם המשפחה.';
      case 'phone': return 'אנא הזינו את מספר הטלפון.';
      default: return 'אנא מלאו שדה זה.';
    }
  }

  function updateProgressBar(step) {
    const progressBar = document.querySelector('.progress-bar');
    const percentage = (step / totalSteps) * 100;
    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', step);
    progressBar.textContent = `${step}/${totalSteps}`;
  }

  function goToStep(n) {
    const currentActive = document.querySelector('.step.active');
    if (currentActive) {
      currentActive.classList.remove('active');
    }
    const newStep = document.getElementById(`step-${n}`);
    if (newStep) {
      newStep.classList.add('active');
      updateProgressBar(n);
    }
  }

  function formatDate(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
});
