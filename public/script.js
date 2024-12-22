document.addEventListener('DOMContentLoaded', function() {
    // קישור לוואטסאפ בעמוד הראשי
    const whatsappLinkMain = document.getElementById('whatsappLink');
    if (whatsappLinkMain) {
        whatsappLinkMain.addEventListener('click', function(event) {
            event.preventDefault();
            const phoneNumber = '972547224551'; // החלף במספר הטלפון של המספרה
            const message = 'שלום, אשמח לקבל פרטים נוספים.';
            const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        });
    }

    // Initialize Bootstrap Carousel (optional customization)
    $('#hairCarousel').carousel({
        interval: 5000, // Time in milliseconds between slides
        ride: 'carousel',
        wrap: true,
        pause: 'hover'
    });
});
