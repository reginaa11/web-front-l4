 (function () {
    'use strict';

    // Константы и хранилище
    const STORAGE_KEY = 'todo-tasks';
    const THEME_KEY = 'todo-theme';

    // DOM-ссылки
    const listEl = document.querySelector('[data-js="task-list"]');
    const emptyEl = document.querySelector('[data-js="empty-state"]');
    const searchEl = document.querySelector('[data-js="search"]');
    const dialog = document.querySelector('[data-js="task-dialog"]');
    const form = document.querySelector('[data-js="task-form"]');
    const titleInput = document.querySelector('[data-js="task-title-input"]');
    const titleError = document.querySelector('[data-js="task-title-error"]');
    const openBtn = document.querySelector('[data-js="open-modal"]');
    const closeBtn = document.querySelector('[data-js="close-modal"]');
    const themeToggle = document.querySelector('[data-js="theme-toggle"]');
    const themeIcon = document.querySelector('[data-js="theme-icon"]');

    // Состояние
    let tasks = [];              // { id, title, done }
    let editingId = null;        // null = создание, иначе id задачи
    let lastFocusedBeforeModal = null;

    // Работа с localStorage
    function loadTasks() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(t =>
                t && typeof t.id === 'string' && typeof t.title === 'string'
            );
        } catch (e) {
            console.warn('Не удалось прочитать задачи из localStorage:', e);
            return [];
        }
    }

    function saveTasks() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        } catch (e) {
            console.warn('Не удалось сохранить задачи:', e);
        }
    }

    // Генерация уникального id
    function generateId() {
        return 't-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }

    // Рендер списка задач
     function render() {
        const query = searchEl.value.trim().toLowerCase();

        // Сортировка: невыполненные сверху, потом по id
        const sorted = [...tasks].sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1;
            return 0;
        });

        // Фильтрация по поиску
        const visible = sorted.filter(t =>
            t.title.toLowerCase().includes(query)
        );

        listEl.innerHTML = '';

        visible.forEach(task => {
            listEl.appendChild(buildTaskElement(task));
        });

        // Пустое состояние
        const isEmpty = visible.length === 0;
        emptyEl.hidden = !isEmpty;

        if (isEmpty) {
            emptyEl.querySelector('.empty-state__title').textContent =
                query ? 'Ничего не найдено' : 'Пока нет задач';
            emptyEl.querySelector('.empty-state__text').textContent =
                query
                    ? 'Попробуйте изменить запрос'
                    : 'Нажмите «Добавить задачу», чтобы начать';
        }
    }

    // Построение DOM-элемента задачи
    function buildTaskElement(task) {
        const li = document.createElement('li');
        li.className = 'task-list__item';
        li.setAttribute('data-task-id', task.id);

        const article = document.createElement('article');
        article.className = 'task' + (task.done ? ' task--done' : '');

        // Чекбокс
        const checkboxId = `task-${task.id}-done`;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxId;
        checkbox.className = 'task__checkbox';
        checkbox.checked = task.done;
        checkbox.setAttribute('data-js', 'task-toggle');

        // Заголовок (label чекбокса) — требование A3
        const titleId = `task-${task.id}-title`;
        const title = document.createElement('label');
        title.htmlFor = checkboxId;
        title.id = titleId;
        title.className = 'task__title';
        title.textContent = task.title;   // textContent — защита от XSS

        // Действия
        const actions = document.createElement('div');
        actions.className = 'task__actions';

        // Кнопка редактирования
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'button button--icon';
        editBtn.setAttribute('data-js', 'task-edit');
        editBtn.setAttribute('aria-labelledby', `task-${task.id}-edit ${titleId}`);
        editBtn.innerHTML = '<span class="visually-hidden" id="task-' + task.id + '-edit">Редактировать задачу</span>✏️';
        editBtn.setAttribute('aria-hidden', 'false');

        // Кнопка удаления
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'button button--icon button--danger';
        deleteBtn.setAttribute('data-js', 'task-delete');
        deleteBtn.setAttribute('aria-labelledby', `task-${task.id}-delete ${titleId}`);
        deleteBtn.innerHTML = '<span class="visually-hidden" id="task-' + task.id + '-delete">Удалить задачу</span>🗑️';

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        article.appendChild(checkbox);
        article.appendChild(title);
        article.appendChild(actions);
        li.appendChild(article);

        return li;
    }

    // Модальное окно
    function openModal(taskId) {
        editingId = taskId || null;
        titleError.textContent = '';
        titleInput.classList.remove('is-invalid');

        if (editingId) {
            const task = tasks.find(t => t.id === editingId);
            titleInput.value = task ? task.title : '';
            document.querySelector('#task-dialog-title').textContent = 'Редактировать задачу';
        } else {
            titleInput.value = '';
            document.querySelector('#task-dialog-title').textContent = 'Новая задача';
        }

        lastFocusedBeforeModal = document.activeElement;

        dialog.showModal();
        // autofocus ставится на input через атрибут или вручную
        setTimeout(() => titleInput.focus(), 0);
    }

    function closeModal() {
        dialog.close();
        // Возврат фокуса — требование A4 (dialog сам делает возврат, но подстрахуемся)
        if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
            lastFocusedBeforeModal.focus();
        }
        editingId = null;
    }

    openBtn.addEventListener('click', () => openModal(null));
    closeBtn.addEventListener('click', closeModal);

    // Отмена по Esc — нативный dialog делает это сам, но перехватим для чистоты
    dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        closeModal();
    });

    // Сохранение задачи из формы
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const title = titleInput.value.trim();
        if (title.length < 1) {
            titleError.textContent = 'Введите название задачи';
            titleInput.classList.add('is-invalid');
            titleInput.focus();
            return;
        }

        if (editingId) {
            const task = tasks.find(t => t.id === editingId);
            if (task) {
                task.title = title;
            }
        } else {
            tasks.push({
                id: generateId(),
                title: title,
                done: false
            });
        }

        saveTasks();
        render();

        // Возврат фокуса на кнопку «Добавить»
        dialog.close();
        if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
            lastFocusedBeforeModal.focus();
        }
        editingId = null;
    });

    // Сброс ошибки при вводе
    titleInput.addEventListener('input', () => {
        if (titleInput.value.trim().length > 0) {
            titleError.textContent = '';
            titleInput.classList.remove('is-invalid');
        }
    });

    // Обработка кликов в списке (делегирование)
    listEl.addEventListener('click', (e) => {
        const target = e.target.closest('[data-js]');
        if (!target) return;

        const li = target.closest('[data-task-id]');
        if (!li) return;

        const taskId = li.getAttribute('data-task-id');

        if (target.matches('[data-js="task-edit"]')) {
            openModal(taskId);
        } else if (target.matches('[data-js="task-delete"]')) {
            deleteTask(taskId, li);
        }
    });

    // Обработка чекбоксов
    listEl.addEventListener('change', (e) => {
        if (e.target.matches('[data-js="task-toggle"]')) {
            const li = e.target.closest('[data-task-id]');
            const taskId = li.getAttribute('data-task-id');
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                task.done = e.target.checked;
                saveTasks();
                render();
            }
        }
    });

    // Удаление задачи + возврат фокуса (A5)
    function deleteTask(taskId, li) {
        const allItems = [...listEl.querySelectorAll('[data-task-id]')];
        const index = allItems.indexOf(li);

        tasks = tasks.filter(t => t.id !== taskId);
        saveTasks();
        render();

        // Поиск следующего видимого элемента для фокуса
        const newItems = [...listEl.querySelectorAll('[data-task-id]')];
        if (newItems.length === 0) {
            openBtn.focus();
            return;
        }

        const next = newItems[index] || newItems[index - 1] || newItems[0];
        const nextCheckbox = next.querySelector('input[type="checkbox"]');
        if (nextCheckbox) {
            nextCheckbox.focus();
        } else {
            openBtn.focus();
        }
    }

    // Поиск
    searchEl.addEventListener('input', render);

    // Тема
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
        try {
            localStorage.setItem(THEME_KEY, theme);
        } catch (e) {}
    }

    function getSavedTheme() {
        try {
            return localStorage.getItem(THEME_KEY);
        } catch (e) {
            return null;
        }
    }

    function getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
    }

    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        applyTheme(current === 'dark' ? 'light' : 'dark');
    });

    // Инициализация
    function init() {
        tasks = loadTasks();
        applyTheme(getSavedTheme() || getSystemTheme());
        render();
    }

    init();

})();