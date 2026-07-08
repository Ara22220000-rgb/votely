/**
 * 3D-анимация взрыва дымовой гранаты.
 * Запуск: Alt + S (взрыв в центре экрана) либо клик с зажатым Alt+S не требуется —
 * для точечного запуска можно вызвать window.smokeGrenade.explodeAt(x, y).
 * Зависимость: Three.js (подключается отдельно через CDN).
 */
(function () {
    'use strict';

    if (window.smokeGrenade) return;

    const STATE = {
        renderer: null,
        scene: null,
        camera: null,
        clock: null,
        canvas: null,
        flashes: [],
        smokes: [],
        running: false,
        rafId: 0,
        texture: null,
    };

    const CONFIG = {
        smokeParticleCount: 450,       // больше частиц для объёма
        smokeLifetime: 6.5,            // дольше живут (лучше рассеиваются)
        smokeBaseSize: 18,             // больше базовый размер
        smokeGrow: 45,                 // сильнее растут
        smokeSpread: 12,               // шире разлёт в 3D
        smokeRise: 3.2,                // сильнее подъём
        smokeGravity: -0.4,
        flashLifetime: 0.28,
        flashStartSize: 2,
        flashEndSize: 16,
        sparkCount: 80,
        sparkLifetime: 1.1,
        sparkSpeed: 22,
    };

    /** Ленивая инициализация сцены и рендерера (один раз). */
    function ensureScene() {
        if (STATE.renderer) return;

        const THREE = window.THREE;
        if (!THREE) {
            console.warn('[smokeGrenade] Three.js не загружен');
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.className = 'smoke-grenade-canvas';
        canvas.style.cssText =
            'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99998;';
        document.body.append(canvas);

        STATE.canvas = canvas;
        STATE.renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true,
        });
        STATE.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        STATE.renderer.setSize(window.innerWidth, window.innerHeight);

        STATE.scene = new THREE.Scene();
        STATE.scene.fog = new THREE.FogExp2(0x000000, 0.012); // туман для глубины
        STATE.camera = new THREE.PerspectiveCamera(
            50,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        STATE.camera.position.set(0, 3, 28);
        STATE.camera.lookAt(0, 0, 0);

        STATE.clock = new THREE.Clock();
        STATE.texture = makeSoftCircleTexture();

        window.addEventListener('resize', onResize);
    }

    function onResize() {
        if (!STATE.renderer) return;
        STATE.renderer.setSize(window.innerWidth, window.innerHeight);
        STATE.camera.aspect = window.innerWidth / window.innerHeight;
        STATE.camera.updateProjectionMatrix();
    }

    /** Мягкая радиальная текстура для частиц (без внешних ассетов). */
    function makeSoftCircleTexture() {
        const THREE = window.THREE;
        const size = 128;
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(
            size / 2, size / 2, 0,
            size / 2, size / 2, size / 2
        );
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
        g.addColorStop(0.7, 'rgba(255,255,255,0.25)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        const tex = new THREE.CanvasTexture(c);
        tex.needsUpdate = true;
        return tex;
    }

    /** Конвертация экранных координат в точку 3D-сцены на плоскости z=0. */
    function screenToWorld(x, y) {
        const THREE = window.THREE;
        const ndc = new THREE.Vector2(
            (x / window.innerWidth) * 2 - 1,
            -(y / window.innerHeight) * 2 + 1
        );
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, STATE.camera);
        // пересечение с плоскостью z = 0
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const point = new THREE.Vector3();
        ray.ray.intersectPlane(plane, point);
        return point;
    }

    /** Яркая вспышка в момент детонации. */
    function spawnFlash(origin) {
        const THREE = window.THREE;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute([origin.x, origin.y, origin.z], 3));
        const mat = new THREE.PointsMaterial({
            size: CONFIG.flashStartSize,
            map: STATE.texture,
            color: new THREE.Color(0xffd27a),
            transparent: true,
            opacity: 1,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true,
        });
        const points = new THREE.Points(geo, mat);
        STATE.scene.add(points);
        STATE.flashes.push({ points, mat, age: 0, life: CONFIG.flashLifetime });
    }

    /** Искры/осколки, разлетающиеся от взрыва. */
    function spawnSparks(origin) {
        const THREE = window.THREE;
        const count = CONFIG.sparkCount;
        const positions = new Float32Array(count * 3);
        const velocities = [];
        for (let i = 0; i < count; i++) {
            positions[i * 3] = origin.x;
            positions[i * 3 + 1] = origin.y;
            positions[i * 3 + 2] = origin.z;
            const dir = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ).normalize().multiplyScalar(CONFIG.sparkSpeed * (0.4 + Math.random() * 0.8));
            velocities.push(dir);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
            size: 0.6,
            map: STATE.texture,
            color: new THREE.Color(0xffb24d),
            transparent: true,
            opacity: 1,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true,
        });
        const points = new THREE.Points(geo, mat);
        STATE.scene.add(points);
        STATE.smokes.push({
            points,
            mat,
            velocities,
            age: 0,
            life: CONFIG.sparkLifetime,
            kind: 'spark',
            baseSize: 0.6,
            grow: 0,
        });
    }

    /** Основное облако дыма. */
    function spawnSmoke(origin) {
        const THREE = window.THREE;
        const count = CONFIG.smokeParticleCount;
        const positions = new Float32Array(count * 3);
        const velocities = [];
        const sizes = new Float32Array(count);
        const shades = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            // Больше разброс в 3D пространстве
            positions[i * 3] = origin.x + (Math.random() - 0.5) * 1.2;
            positions[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 1.2;
            positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 1.2;

            // Сферический разлёт в 3D с акцентом на подъём вверх
            const angle = Math.random() * Math.PI * 2;
            const elev = (Math.random() - 0.3) * Math.PI * 0.7; // больше вверх
            const speed = CONFIG.smokeSpread * (0.3 + Math.random() * 0.9);
            velocities.push(new THREE.Vector3(
                Math.cos(angle) * Math.cos(elev) * speed,
                Math.abs(Math.sin(elev)) * speed + CONFIG.smokeRise * (0.5 + Math.random()),
                Math.sin(angle) * Math.cos(elev) * speed
            ));
            sizes[i] = CONFIG.smokeBaseSize * (0.5 + Math.random() * 1.2);
            // Серый дым с небольшой вариацией (от тёмно-серого к светло-серому)
            shades[i] = 0.45 + Math.random() * 0.25; // 0.45-0.70 = серый диапазон
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
        geo.setAttribute('shade', new THREE.Float32BufferAttribute(shades, 1));

        const mat = makeSmokeMaterial();
        const points = new THREE.Points(geo, mat);
        points.frustumCulled = false;
        STATE.scene.add(points);

        STATE.smokes.push({
            points,
            mat,
            velocities,
            age: 0,
            life: CONFIG.smokeLifetime,
            kind: 'smoke',
            baseSize: CONFIG.smokeBaseSize,
            grow: CONFIG.smokeGrow,
            sizes,
        });
    }

    /** Кастомный шейдерный материал для дыма: мягкие частицы, затухание, рост размера, глубина. */
    function makeSmokeMaterial() {
        const THREE = window.THREE;
        return new THREE.ShaderMaterial({
            uniforms: {
                uTex: { value: STATE.texture },
                uTime: { value: 0 },
                uLife: { value: CONFIG.smokeLifetime },
                uPixelRatio: { value: STATE.renderer.getPixelRatio() },
            },
            vertexShader: /* glsl */ `
                attribute float size;
                attribute float shade;
                varying float vShade;
                varying float vDepth;
                uniform float uTime;
                uniform float uLife;
                uniform float uPixelRatio;
                void main() {
                    vShade = shade;
                    float t = clamp(uTime / uLife, 0.0, 1.0);
                    // частица растёт со временем (сильнее для большего рассеивания)
                    float curSize = size * (1.0 + t * 2.5);
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    vDepth = -mv.z;
                    gl_PointSize = curSize * (300.0 / -mv.z) * uPixelRatio;
                    gl_Position = projectionMatrix * mv;
                }
            `,
            fragmentShader: /* glsl */ `
                uniform sampler2D uTex;
                uniform float uTime;
                uniform float uLife;
                varying float vShade;
                varying float vDepth;
                void main() {
                    vec2 uv = gl_PointCoord;
                    vec4 tex = texture2D(uTex, uv);
                    float t = clamp(uTime / uLife, 0.0, 1.0);
                    // плавное появление и ОЧЕНЬ медленное затухание (для рассеивания)
                    float fadeIn = smoothstep(0.0, 0.15, t);
                    float fadeOut = 1.0 - smoothstep(0.4, 1.0, t);
                    float alpha = tex.a * fadeIn * fadeOut * 0.75;
                    // Серый цвет + затемнение по глубине (3D объём)
                    float depthFade = 1.0 - smoothstep(15.0, 45.0, vDepth);
                    vec3 col = vec3(vShade) * (0.6 + depthFade * 0.4);
                    gl_FragColor = vec4(col, alpha * (0.5 + depthFade * 0.5));
                    if (alpha < 0.01) discard;
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.NormalBlending,
        });
    }

    /** Запуск взрыва в экранной точке (по умолчанию — центр). */
    function explodeAt(x, y) {
        ensureScene();
        if (!STATE.renderer) return;

        const cx = x ?? window.innerWidth / 2;
        const cy = y ?? window.innerHeight / 2;
        const origin = screenToWorld(cx, cy);

        spawnFlash(origin);
        spawnSparks(origin);
        spawnSmoke(origin);

        if (!STATE.running) {
            STATE.running = true;
            STATE.clock.start();
            loop();
        }
    }

    function loop() {
        STATE.rafId = requestAnimationFrame(loop);
        const dt = Math.min(STATE.clock.getDelta(), 0.05);
        update(dt);
        STATE.renderer.render(STATE.scene, STATE.camera);
    }

    function update(dt) {
        let alive = false;

        // вспышки
        for (let i = STATE.flashes.length - 1; i >= 0; i--) {
            const f = STATE.flashes[i];
            f.age += dt;
            const t = f.age / f.life;
            if (t >= 1) {
                STATE.scene.remove(f.points);
                f.points.geometry.dispose();
                f.mat.dispose();
                STATE.flashes.splice(i, 1);
                continue;
            }
            f.mat.size = CONFIG.flashStartSize + (CONFIG.flashEndSize - CONFIG.flashStartSize) * t;
            f.mat.opacity = 1 - t;
            alive = true;
        }

        // дым и искры
        for (let i = STATE.smokes.length - 1; i >= 0; i--) {
            const s = STATE.smokes[i];
            s.age += dt;
            const t = s.age / s.life;
            if (t >= 1) {
                STATE.scene.remove(s.points);
                s.points.geometry.dispose();
                s.mat.dispose();
                STATE.smokes.splice(i, 1);
                continue;
            }
            alive = true;

            const posAttr = s.points.geometry.attributes.position;
            const arr = posAttr.array;

            if (s.kind === 'spark') {
                for (let j = 0; j < s.velocities.length; j++) {
                    const v = s.velocities[j];
                    v.y += CONFIG.smokeGravity * dt * 2;
                    v.multiplyScalar(0.96); // затухание
                    arr[j * 3] += v.x * dt;
                    arr[j * 3 + 1] += v.y * dt;
                    arr[j * 3 + 2] += v.z * dt;
                }
                s.mat.opacity = 1 - t;
            } else {
                // дым: замедляется, поднимается, турбулентность в 3D
                for (let j = 0; j < s.velocities.length; j++) {
                    const v = s.velocities[j];
                    v.multiplyScalar(0.92); // медленнее затухает
                    v.y += (CONFIG.smokeRise + Math.sin(s.age * 1.8 + j) * 0.5) * dt;
                    // сильная турбулентность в 3D для лучшего рассеивания
                    arr[j * 3] += v.x * dt + Math.sin(s.age * 1.2 + j * 0.5) * dt * 0.8;
                    arr[j * 3 + 1] += v.y * dt + Math.cos(s.age * 0.9 + j * 0.3) * dt * 0.4;
                    arr[j * 3 + 2] += v.z * dt + Math.cos(s.age * 1.1 + j * 0.7) * dt * 0.8;
                }
                s.mat.uniforms.uTime.value = s.age;
            }
            posAttr.needsUpdate = true;
        }

        if (!alive) {
            stopLoop();
        }
    }

    function stopLoop() {
        if (STATE.rafId) {
            cancelAnimationFrame(STATE.rafId);
            STATE.rafId = 0;
        }
        STATE.running = false;
        STATE.clock.stop();
    }

    /** Динамическая загрузка Three.js с CDN, если ещё не загружена. */
    function loadThreeJS() {
        return new Promise((resolve, reject) => {
            if (window.THREE) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Не удалось загрузить Three.js'));
            document.head.append(script);
        });
    }

    /** Обработчик Alt + S. */
    function handleKeyDown(event) {
        if (event.altKey && (event.key === 's' || event.key === 'S' || event.code === 'KeyS')) {
            event.preventDefault();
            explodeAt();
        }
    }

    /** Инициализация: ждём загрузки Three.js, затем вешаем слушатель клавиш. */
    async function init() {
        try {
            await loadThreeJS();
            document.addEventListener('keydown', handleKeyDown);
            console.log('[smokeGrenade] Готов. Нажмите Alt+S для взрыва дымовой гранаты.');
        } catch (err) {
            console.error('[smokeGrenade]', err.message);
        }
    }

    window.smokeGrenade = { explodeAt, init };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();