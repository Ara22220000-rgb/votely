/**
 * ЭФФЕКТ ПРАЗДНИЧНОЙ ХЛОПУШКИ (КОНФЕТТИ ВЕЕРОМ)
 * Выстрел происходит из нижней центральной точки экрана.
 * Запуск: confetti.start()
 * Чистый JS + Canvas 2D, плавные 60 FPS с исправленным dt
 */
(function () {
    'use strict';

    if (window.confetti) return;

    // ==================== КОНФИГУРАЦИЯ ====================
    const CONFIG = {
        count: 150,               // Количество кусочков конфетти
        gravity: 350,             // Сила гравитации (пикселей/сек²)
        friction: 0.98,           // Сопротивление воздуха (затухание скорости)
        lifetime: 4.0,            // Максимальное время жизни (сек)
        
        // Начальные силы выстрела хлопушки
        minVelocityY: -600,       // Минимальная скорость вверх (отрицательная Y)
        maxVelocityY: -950,       // Максимальная скорость вверх
        minVelocityX: -350,       // Максимальный разброс влево
        maxVelocityX: 350,        // Максимальный разброс вправо
        
        colors: [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
            '#98D8C8', '#F7DC6F', '#BB8FCE', '#82E0AA',
            '#FF8C00', '#00CED1', '#FF69B4', '#7B68EE'
        ],
        shapes: ['rect', 'circle', 'star'],
    };

    // ==================== СОСТОЯНИЕ ПРИЛОЖЕНИЯ ====================
    const STATE = {
        canvas: null,
        ctx: null,
        particles: [],
        running: false,
        rafId: 0,
        lastTime: 0,              // Переменная для фиксации точного времени кадров
    };

    // ==================== УТИЛИТЫ ====================
    const Utils = {
        random: (min, max) => min + Math.random() * (max - min),
    };

    // ==================== СОЗДАНИЕ ЧАСТИЦ (ВСПЫШКА ХЛОПУШКИ) ====================
    function createParticle(startX, startY) {
        const shape = CONFIG.shapes[Math.floor(Math.random() * CONFIG.shapes.length)];
        const color = CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)];
        
        return {
            x: startX,
            y: startY,
            // Импульс взрыва: мощно вверх и веером в стороны
            vx: Utils.random(CONFIG.minVelocityX, CONFIG.maxVelocityX),
            vy: Utils.random(CONFIG.minVelocityY, CONFIG.maxVelocityY),
            
            rotation: Utils.random(0, 360),
            rotationSpeed: Utils.random(-360, 360), // Скорость вращения (градусов/сек)
            
            // Эффект покачивания на ветру (синусоида)
            wobble: Utils.random(0, Math.PI * 2),
            wobbleSpeed: Utils.random(4, 10),
            
            size: Utils.random(6, 14),
            color: color,
            shape: shape,
            age: 0,
            lifetime: CONFIG.lifetime * Utils.random(0.7, 1.3),
        };
    }

    function drawParticle(ctx, p) {
        ctx.save();
        
        // Добавляем легкое покачивание по горизонтали для реалистичного планирования в воздухе
        const currentX = p.x + Math.sin(p.wobble) * (p.size * 0.4);
        
        ctx.translate(currentX, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        
        // Плавное исчезновение (Fade-out) в конце жизни кусочка
        ctx.globalAlpha = Math.max(0, 1 - (p.age / p.lifetime));
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else if (p.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Звезда (5 лучей)
            const spikes = 5;
            const outerRadius = p.size / 2;
            const innerRadius = outerRadius * 0.4;
            ctx.beginPath();
            for (let i = 0; i < spikes * 2; i++) {
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const angle = (i * Math.PI) / spikes;
                const sx = Math.cos(angle) * radius;
                const sy = Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(sx, sy);
                else ctx.lineTo(sx, sy);
            }
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    // ==================== ИГРОВОЙ ЦИКЛ (60 FPS С ДЕЛЬТОЙ ВРЕМЕНИ) ====================
    function animate(timestamp) {
        if (!STATE.running) return;

        // Исправленный расчет dt: переводим системное время в секунды (макс 0.05 сек для защиты от фризов)
        if (STATE.lastTime === 0) STATE.lastTime = timestamp;
        const dt = Math.min((timestamp - STATE.lastTime) / 1000, 0.05);
        STATE.lastTime = timestamp;

        const ctx = STATE.ctx;
        const width = STATE.canvas.width;
        const height = STATE.canvas.height;

        ctx.clearRect(0, 0, width, height);

        let hasAliveParticles = false;

        for (let i = STATE.particles.length - 1; i >= 0; i--) {
            const p = STATE.particles[i];
            p.age += dt;

            // Если время вышло, убираем частицу
            if (p.age >= p.lifetime) {
                STATE.particles.splice(i, 1);
                continue;
            }

            // Применяем физику гравитации и сопротивления воздуха с привязкой к dt
            p.vy += CONFIG.gravity * dt;
            p.vx *= Math.pow(CONFIG.friction, dt * 60);
            p.vy *= Math.pow(CONFIG.friction, dt * 60);

            // Обновляем координаты
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            
            // Вращение и покачивание
            p.rotation += p.rotationSpeed * dt;
            p.wobble += p.wobbleSpeed * dt;

            // Если конфетти упало ниже экрана, удаляем его
            if (p.y > height + 20) {
                STATE.particles.splice(i, 1);
                continue;
            }

            hasAliveParticles = true;
            drawParticle(ctx, p);
        }

        // Если живые частицы еще есть, продолжаем цикл, иначе — очищаем ресурсы
        if (hasAliveParticles) {
            STATE.rafId = requestAnimationFrame(animate);
        } else {
            cleanup();
        }
    }

    // ==================== УПРАВЛЕНИЕ И ОЧИСТКА MEMORY ====================
    function cleanup() {
        if (STATE.rafId) {
            cancelAnimationFrame(STATE.rafId);
            STATE.rafId = 0;
        }
        STATE.running = false;
        if (STATE.canvas && STATE.canvas.parentNode) {
            STATE.canvas.parentNode.removeChild(STATE.canvas);
            STATE.canvas = null;
            STATE.ctx = null;
        }
        STATE.particles = [];
        STATE.lastTime = 0;
        console.log('[confetti] Анимация хлопушки завершена, ресурсы очищены');
    }

    function start() {
        // Если анимация уже идет, перезапускаем её (добавляем новый залп)
        if (STATE.running) {
            const fireX = window.innerWidth / 2;
            const fireY = window.innerHeight + 10;
            for (let i = 0; i < CONFIG.count; i++) {
                STATE.particles.push(createParticle(fireX, fireY));
            }
            return;
        }

        // Создаем холст поверх сайта
        const canvas = document.createElement('canvas');
        canvas.className = 'confetti-canvas';
        canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:100000;';
        document.body.appendChild(canvas);

        STATE.canvas = canvas;
        STATE.ctx = canvas.getContext('2d');
        STATE.canvas.width = window.innerWidth;
        STATE.canvas.height = window.innerHeight;

        // Точка выстрела: строго по горизонтали центр экрана, снизу
        const fireX = window.innerWidth / 2;
        const fireY = window.innerHeight + 10;

        // Заполняем обойму хлопушки частицами
        for (let i = 0; i < CONFIG.count; i++) {
            STATE.particles.push(createParticle(fireX, fireY));
        }

        STATE.running = true;
        STATE.lastTime = 0; // Сбрасываем таймер перед requestAnimationFrame
        STATE.rafId = requestAnimationFrame(animate);
        console.log('[confetti] Бабах! Хлопушка выстрелила из центра экрана.');
    }

    // Экспортируем функцию запуска в глобальное окно браузера
    window.confetti = { start, cleanup, CONFIG };

    // Обработчик изменения размеров окна
    window.addEventListener('resize', () => {
        if (STATE.canvas) {
            STATE.canvas.width = window.innerWidth;
            STATE.canvas.height = window.innerHeight;
        }
    });
})();