// Konfiguracja
const API_BASE_URL = 'http://localhost:8080/api';
const SESSION_KEY = 'zpoStrona_session';

// Zarządzanie sesją
function saveSession(studentData) {
    const sessionData = {
        student: studentData,
        loginTime: new Date().getTime(),
        attendances: null // będzie zapisane po pobraniu
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
}

function getSession() {
    const sessionData = localStorage.getItem(SESSION_KEY);
    return sessionData ? JSON.parse(sessionData) : null;
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

function updateSessionAttendances(attendances) {
    const session = getSession();
    if (session) {
        session.attendances = attendances;
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
}

// Sprawdzenie i przywrócenie sesji przy ładowaniu strony
function restoreSession() {
    const session = getSession();
    if (session && session.student) {
        const studentData = session.student;

        // Sprawdź czy sesja nie jest zbyt stara (np. 24 godziny)
        const sessionAge = new Date().getTime() - session.loginTime;
        const maxAge = 24 * 60 * 60 * 1000; // 24 godziny

        if (sessionAge > maxAge) {
            clearSession();
            return false;
        }

        // Przywróć sesję
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('attendanceSection').style.display = 'block';
        document.getElementById('userInfo').style.display = 'flex';
        document.getElementById('currentAlbum').textContent = `Album: ${studentData.indexNumber}`;

        const groupInfo = studentData.groupName ? `, Grupa: ${studentData.groupName}` : ' (bez przypisanej grupy)';
        document.getElementById('welcomeMessage').innerHTML = `
                <strong>Witaj ponownie, ${studentData.firstName} ${studentData.lastName}!</strong><br>
                Sesja przywrócona. Album: ${studentData.indexNumber}${groupInfo}
            `;

        // Jeśli mamy zapisane obecności, wyświetl je
        if (session.attendances) {
            displayAttendances(session.attendances);
        } else {
            // Pobierz najnowsze obecności
            loadStudentAttendances(studentData.indexNumber);
        }

        return true;
    }
    return false;
}

// Walidacja numeru albumu
function validateAlbumNumber(albumNumber) {
    const pattern = /^\d{6}$/;
    return pattern.test(albumNumber);
}

// Wyświetlenie komunikatu błędu
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');

    successDiv.style.display = 'none';
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';

    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Wyświetlenie komunikatu sukcesu
function showSuccess(message) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');

    errorDiv.style.display = 'none';
    successDiv.textContent = message;
    successDiv.style.display = 'block';

    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 3000);
}

// Sprawdzenie czy student istnieje w bazie
async function checkStudentExists(indexNumber) {
    try {
        const response = await fetch(`${API_BASE_URL}/students/${indexNumber}`);
        return response.ok;
    } catch (error) {
        console.error('Błąd sprawdzania studenta:', error);
        return false;
    }
}

// Pobieranie danych studenta
async function getStudentData(indexNumber) {
    try {
        const response = await fetch(`${API_BASE_URL}/students/${indexNumber}`);
        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.error('Błąd pobierania danych studenta:', error);
        return null;
    }
}

// Pobieranie obecności studenta
async function getStudentAttendances(indexNumber) {
    try {
        const response = await fetch(`${API_BASE_URL}/attendance/student/${indexNumber}`);
        if (response.ok) {
            return await response.json();
        }
        return [];
    } catch (error) {
        console.error('Błąd pobierania obecności:', error);
        return [];
    }
}

// Asynchroniczne ładowanie obecności
async function loadStudentAttendances(indexNumber) {
    try {
        const attendances = await getStudentAttendances(indexNumber);
        displayAttendances(attendances);
        updateSessionAttendances(attendances);
    } catch (error) {
        console.error('Błąd ładowania obecności:', error);
        displayAttendances([]);
    }
}

// Formatowanie daty
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('pl-PL', options);
}

// Formatowanie statusu obecności
function getStatusInfo(status) {
    switch (status) {
        case 'PRESENT':
            return { text: 'Obecny', class: 'status-present' };
        case 'LATE':
            return { text: 'Spóźniony', class: 'status-late' };
        case 'ABSENT':
            return { text: 'Nieobecny', class: 'status-absent' };
        default:
            return { text: 'Nieznany', class: 'status-absent' };
    }
}

// Funkcje wylogowania
function showLogoutConfirmation() {
    document.getElementById('logoutConfirmation').style.display = 'flex';
}

function cancelLogout() {
    document.getElementById('logoutConfirmation').style.display = 'none';
}

function confirmLogout() {
    clearSession();
    document.getElementById('logoutConfirmation').style.display = 'none';
    showLogin();
    showSuccess('Zostałeś pomyślnie wylogowany');
}

// Obsługa formularza logowania
document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const albumNumber = document.getElementById('albumNumber').value.trim();
    const albumInput = document.getElementById('albumNumber');
    const loginButton = document.getElementById('loginButton');
    const loginButtonText = document.getElementById('loginButtonText');

    albumInput.classList.remove('error', 'success');

    if (!albumNumber) {
        showError('Proszę wprowadzić numer albumu');
        albumInput.classList.add('error');
        albumInput.focus();
        return;
    }

    if (!validateAlbumNumber(albumNumber)) {
        showError('Numer albumu musi składać się z dokładnie 6 cyfr (np. 123456)');
        albumInput.classList.add('error');
        albumInput.focus();
        return;
    }

    loginButton.disabled = true;
    loginButtonText.innerHTML = '<span class="loading"></span>Sprawdzam...';

    try {
        const studentExists = await checkStudentExists(albumNumber);

        if (!studentExists) {
            showError(`Nieprawidłowy numer albumu. Student o numerze ${albumNumber} nie istnieje w systemie.`);
            albumInput.classList.add('error');
            albumInput.focus();
            return;
        }

        const studentData = await getStudentData(albumNumber);

        if (!studentData) {
            showError('Błąd pobierania danych studenta. Spróbuj ponownie.');
            return;
        }

        albumInput.classList.add('success');
        showSuccess(`Witaj ${studentData.firstName} ${studentData.lastName}!`);

        setTimeout(() => {
            login(studentData);
        }, 1000);

    } catch (error) {
        console.error('Błąd logowania:', error);
        showError('Błąd połączenia z serwerem. Sprawdź czy backend jest uruchomiony.');
    } finally {
        loginButton.disabled = false;
        loginButtonText.textContent = 'Zaloguj się';
    }
});

// Walidacja w czasie rzeczywistym
document.getElementById('albumNumber').addEventListener('input', function (e) {
    const input = e.target;
    const value = input.value;

    const cleanValue = value.replace(/\D/g, '');

    if (cleanValue.length > 6) {
        input.value = cleanValue.substring(0, 6);
    } else {
        input.value = cleanValue;
    }

    input.classList.remove('error', 'success');
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('successMessage').style.display = 'none';
});

// Logowanie studenta
async function login(studentData) {
    try {
        // Zapisz sesję
        saveSession(studentData);

        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('attendanceSection').style.display = 'block';
        document.getElementById('userInfo').style.display = 'flex';
        document.getElementById('currentAlbum').textContent = `Album: ${studentData.indexNumber}`;

        const groupInfo = studentData.groupName ? `, Grupa: ${studentData.groupName}` : ' (bez przypisanej grupy)';
        document.getElementById('welcomeMessage').innerHTML = `
                <strong>Witaj, ${studentData.firstName} ${studentData.lastName}!</strong><br>
                Zalogowano pomyślnie. Album: ${studentData.indexNumber}${groupInfo}
            `;

        // Pobierz i wyświetl obecności
        await loadStudentAttendances(studentData.indexNumber);

    } catch (error) {
        console.error('Błąd podczas logowania:', error);
        showError('Błąd podczas logowania. Spróbuj ponownie.');
    }
}

// Wyświetlanie obecności
function displayAttendances(attendances) {
    const grid = document.getElementById('attendanceGrid');

    if (attendances.length === 0) {
        grid.innerHTML = `
                <div class="no-attendance">
                    Brak zapisanych obecności
                    <div style="margin-top: 10px; font-size: 0.9rem;">
                        Twoje obecności pojawią się tutaj po pierwszych zajęciach.
                    </div>
                </div>
            `;
        updateStats(0, 0, 0, 0);
        return;
    }

    // Oblicz statystyki
    const stats = {
        total: attendances.length,
        present: attendances.filter(a => a.status === 'PRESENT').length,
        late: attendances.filter(a => a.status === 'LATE').length,
        absent: attendances.filter(a => a.status === 'ABSENT').length
    };

    updateStats(stats.total, stats.present, stats.late, stats.absent);

    // Sortuj obecności po dacie (najnowsze pierwsze)
    attendances.sort((a, b) => new Date(b.markedAt) - new Date(a.markedAt));

    grid.innerHTML = '';

    attendances.forEach(attendance => {
        const attendanceCard = document.createElement('div');
        const statusInfo = getStatusInfo(attendance.status);
        const statusClass = attendance.status.toLowerCase();

        attendanceCard.className = `attendance-card ${statusClass}`;

        const schedule = attendance.schedule;
        const startDate = formatDate(schedule.startTime);

        attendanceCard.innerHTML = `
                <div class="attendance-header">
                    <div class="attendance-subject">${schedule.subject}</div>
                    <div class="attendance-status ${statusInfo.class}">${statusInfo.text}</div>
                </div>

                <div class="attendance-details">
                    <div class="attendance-date">📅 ${startDate}</div>

                    ${schedule.classroom ? `
                        <div class="attendance-classroom">
                            🏫 Sala: ${schedule.classroom}
                        </div>
                    ` : ''}

                    ${schedule.instructor ? `
                        <div class="attendance-instructor">
                            👨‍🏫 Prowadzący: ${schedule.instructor}
                        </div>
                    ` : ''}

                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #dee2e6; font-size: 0.8rem; color: #6c757d;">
                        Oznaczono: ${formatDate(attendance.markedAt)}
                    </div>

                    ${attendance.notes ? `
                        <div class="attendance-notes">
                            💬 ${attendance.notes}
                        </div>
                    ` : ''}

                    ${schedule.notes ? `
                        <div style="margin-top: 8px; font-size: 0.85rem; color: #6c757d;">
                            ℹ️ ${schedule.notes}
                        </div>
                    ` : ''}
                </div>
            `;

        attendanceCard.addEventListener('click', function () {
            showAttendanceDetails(attendance);
        });

        grid.appendChild(attendanceCard);
    });
}

// Aktualizacja statystyk
function updateStats(total, present, late, absent) {
    document.getElementById('totalCount').textContent = total;
    document.getElementById('presentCount').textContent = present;
    document.getElementById('lateCount').textContent = late;
    document.getElementById('absentCount').textContent = absent;
}

// Wyświetlenie szczegółów obecności
function showAttendanceDetails(attendance) {
    const schedule = attendance.schedule;
    const statusInfo = getStatusInfo(attendance.status);

    const details = `
🎓 SZCZEGÓŁY OBECNOŚCI

📚 Przedmiot: ${schedule.subject}
📅 Data: ${formatDate(schedule.startTime)}
📍 Status: ${statusInfo.text}
${schedule.classroom ? `🏫 Sala: ${schedule.classroom}` : ''}
${schedule.instructor ? `👨‍🏫 Prowadzący: ${schedule.instructor}` : ''}

⏰ Czas trwania: ${formatDate(schedule.startTime)} - ${formatDate(schedule.endTime)}
📝 Oznaczono: ${formatDate(attendance.markedAt)}

${attendance.notes ? `💬 Notatki: ${attendance.notes}` : ''}
${schedule.notes ? `ℹ️ Informacje: ${schedule.notes}` : ''}
        `.trim();

    alert(details);
}

// Powrót do logowania (bez wylogowania)
function showLogin() {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('attendanceSection').style.display = 'none';
    document.getElementById('userInfo').style.display = 'none';

    document.getElementById('albumNumber').value = '';
    document.getElementById('albumNumber').classList.remove('error', 'success');
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('successMessage').style.display = 'none';
}

// Zamknięcie dialogu wylogowania klawiszem Escape
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        const logoutDialog = document.getElementById('logoutConfirmation');
        if (logoutDialog.style.display === 'flex') {
            cancelLogout();
        }
    }
});

// Zamknięcie dialogu wylogowania kliknięciem w tło
document.getElementById('logoutConfirmation').addEventListener('click', function (e) {
    if (e.target === this) {
        cancelLogout();
    }
});

// Test połączenia z backendem
window.addEventListener('load', async function () {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (!response.ok) {
            console.warn('Backend może być niedostępny');
        }
    } catch (error) {
        console.warn('Nie można połączyć się z backendem:', error);
    }

    // Sprawdź i przywróć sesję
    restoreSession();
});