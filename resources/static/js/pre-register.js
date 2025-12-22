// Функция для показа уведомления об ошибке
function showError(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: rgb(255, 55, 71);
        color: #fff;
        padding: 15px 20px;
        border-radius: 10px;
        z-index: 10000;
        font-family: monospace;
        font-size: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        max-width: 400px;
        opacity: 0.9;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Валидация домена
function validateDomain(domain) {
    if (!domain || domain.trim() === '') {
        return { valid: false, message: 'Пожалуйста, введите имя домена' };
    }
    
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!domainRegex.test(domain)) {
        return { valid: false, message: 'Некорректное имя домена. Используйте только буквы, цифры и дефисы' };
    }
    
    if (domain.length > 63) {
        return { valid: false, message: 'Имя домена не должно превышать 63 символа' };
    }
    
    return { valid: true };
}

// Проверка существования домена
async function checkDomainAvailability(domain) {
    try {
        const response = await fetch('/api/dmn/owner', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ domain: domain })
        });
        
        const data = await response.json();
        
        if (data.status === 'ok') {
            // Если description === "noone", домен свободен
            return data.description === 'noone';
        } else {
            showError('Ошибка проверки домена: ' + (data.description || 'Неизвестная ошибка'));
            return false;
        }
    } catch (error) {
        console.error('Ошибка проверки домена:', error);
        showError('Ошибка подключения к серверу');
        return false;
    }
}

// Переход на страницу регистрации
async function goToRegistration() {
    const domainInput = document.getElementById('domain-input');
    const domain = domainInput ? domainInput.value.trim() : '';
    
    // Валидация домена
    const validation = validateDomain(domain);
    if (!validation.valid) {
        showError(validation.message);
        if (domainInput) {
            domainInput.focus();
        }
        return;
    }
    
    // Добавляем .dcn если его нет
    const fullDomain = domain.endsWith('.dcn') ? domain : domain + '.dcn';
    
    // Проверка доступности домена
    const isAvailable = await checkDomainAvailability(fullDomain);
    if (!isAvailable) {
        showError('Домен уже занят. Выберите другое имя.');
        if (domainInput) {
            domainInput.focus();
        }
        return;
    }
    
    // Перенаправляем на страницу регистрации с параметром domain
    window.location.href = `/registration.html?domain=${encodeURIComponent(fullDomain)}`;
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    const domainInput = document.getElementById('domain-input');
    const nextBtn = document.getElementById('domain-next-btn');
    
    // Обработчик кнопки "Далее"
    if (nextBtn) {
        nextBtn.addEventListener('click', goToRegistration);
    }
    
    // Обработчик Enter в поле ввода домена
    if (domainInput) {
        domainInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                goToRegistration();
            }
        });
        
        // Фокус на поле ввода при загрузке
        domainInput.focus();
    }
});

