/**
 * Glass Shatter Effect with Flashbang - Полная монолитная версия
 * Интерактивный 3D эффект разбивания страницы со светошумовой вспышкой
 * 
 * Управление:
 * - Ctrl + Alt + Клик: взрыв в точке клика
 * - Alt + H: взрыв из центра экрана
 * 
 * Фазы:
 * 1. Трещины (2D Canvas) - 0.6 сек
 * 2. Вспышка (Flashbang) - 0.15 сек ослепление, 0.7 сек затухание
 * 3. 3D Взрыв осколков (Three.js) - физика, гравитация, столкновения
 */

(function () {
    'use strict';

    if (window.glassShatter) {
        console.warn('[glassShatter] Уже инициализирован');
        return;
    }

    // ==================== КОНФИГУРАЦИЯ ====================
    const CONFIG = {
        // Фаза 1: Трещины
        crackCount: 28,
        crackSegments: 14,
        crackMaxLength: 0.5,
        crackBranchChance: 0.6,
        crackBranchCount: 4,
        crackBranchLength: 0.4,
        crackDuration: 0.6,
        sparkleCount: 40,
        crackGlowIntensity: 1.5,
        
        // Flashbang (Вспышка)
        flashDuration: 0.15,
        flashFadeDuration: 0.7,
        flashColor: '#ffffff',
        
        // Фаза 2: Осколки
        shardCount: 250,
        shardMinArea: 20,
        shardMaxArea: 3000,
        shardThickness: 0.4,
        aspectScale: 0.035,
        
        // Физика
        gravity: -9.8,
        explosionForce: 40,
        friction: 0.985,
        angularFriction: 0.97,
        bounceFactor: 0.25,
        floorFriction: 0.7,
        
        // Визуал
        shardLifetime: 4.0,
        fadeOutStart: 0.6,
        shardOpacity: 0.95,
        rotationSpeed: 10,
    };

    // ==================== СОСТОЯНИЕ ====================
    const STATE = {
        renderer: null,
        scene: null,
        camera: null,
        clock: null,
        canvas3d: null,
        canvas2d: null,
        ctx2d: null,
        flashDiv: null,
        screenshot: null,
        screenshotWidth: 0,
        screenshotHeight: 0,
        shards: [],
        cracks: [],
        sparkles: [],
        running: false,
        phase: 0,
        rafId: 0,
        lastTime: 0,
        crackProgress: 0,
        targetElement: null,
        originalOpacity: 1,
        clickX: 0,
        clickY: 0,
        clickOffsetX: 0,
        clickOffsetY: 0,
        isShattering: false,
        elementRect: null,
        floorY: 0,
        isFlashActive: false,
        flashStartTime: 0,
    };

    // ==================== УТИЛИТЫ ====================
    const Utils = {
        random: function (min, max) {
            return min + Math.random() * (max - min);
        },
        randomInt: function (min, max) {
            return Math.floor(this.random(min, max + 1));
        },
        clamp: function (v, min, max) {
            return Math.max(min, Math.min(max, v));
        },
        lerp: function (a, b, t) {
            return a + (b - a) * t;
        },
        dist: function (x1, y1, x2, y2) {
            return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
        },
        randomSparkColor: function () {
            const colors = ['#ffffff', '#ffffee', '#ffffcc', '#ffdd88', '#ffaa44'];
            return colors[Math.floor(Math.random() * colors.length)];
        }
    };

    // ==================== ТРИАНГУЛЯЦИЯ ДЕЛОНЕ ====================
    class Delaunay {
        constructor(points) {
            this.points = points;
            this.triangles = [];
            this._triangulate();
        }

        _triangulate() {
            const n = this.points.length / 2;
            if (n < 3) return;

            const indices = Array.from({ length: n }, function (_, i) { return i; });
            indices.sort(function (a, b) {
                return this.points[a * 2] - this.points[b * 2];
            }.bind(this));

            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;
            for (let i = 0; i < n; i++) {
                const x = this.points[i * 2];
                const y = this.points[i * 2 + 1];
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }

            const dx = maxX - minX;
            const dy = maxY - minY;
            const delta = Math.max(dx, dy) * 2;

            const superPoints = [
                [minX - delta, minY - delta],
                [maxX + delta, minY - delta],
                [minX + dx / 2, maxY + delta]
            ];

            this.points.push(superPoints[0][0], superPoints[0][1]);
            this.points.push(superPoints[1][0], superPoints[1][1]);
            this.points.push(superPoints[2][0], superPoints[2][1]);

            let triangles = [[n, n + 1, n + 2]];

            for (let idx = 0; idx < indices.length; idx++) {
                const pointIdx = indices[idx];
                const x = this.points[pointIdx * 2];
                const y = this.points[pointIdx * 2 + 1];

                const badTriangles = [];
                const edgeMap = new Map();

                for (let t = 0; t < triangles.length; t++) {
                    const tri = triangles[t];
                    if (this._inCircumcircle(x, y, tri)) {
                        badTriangles.push(tri);
                    }
                }

                for (let t = 0; t < badTriangles.length; t++) {
                    const tri = badTriangles[t];
                    for (let i = 0; i < 3; i++) {
                        const a = tri[i];
                        const b = tri[(i + 1) % 3];
                        const key = a < b ? a + ',' + b : b + ',' + a;
                        if (edgeMap.has(key)) {
                            edgeMap.delete(key);
                        } else {
                            edgeMap.set(key, [a, b]);
                        }
                    }
                }

                triangles = triangles.filter(function (t) {
                    return !badTriangles.includes(t);
                });

                for (const [a, b] of edgeMap.values()) {
                    triangles.push([a, b, pointIdx]);
                }
            }

            this.triangles = triangles.filter(function (tri) {
                return !tri.some(function (idx) {
                    return idx >= n;
                });
            });

            this.points.length = n * 2;
        }

        _inCircumcircle(px, py, tri) {
            const i0 = tri[0];
            const i1 = tri[1];
            const i2 = tri[2];
            const x0 = this.points[i0 * 2];
            const y0 = this.points[i0 * 2 + 1];
            const x1 = this.points[i1 * 2];
            const y1 = this.points[i1 * 2 + 1];
            const x2 = this.points[i2 * 2];
            const y2 = this.points[i2 * 2 + 1];

            const ax = x0 - px;
            const ay = y0 - py;
            const bx = x1 - px;
            const by = y1 - py;
            const cx = x2 - px;
            const cy = y2 - py;

            const det = (ax * ax + ay * ay) * (bx * cy - by * cx) -
                        (bx * bx + by * by) * (ax * cy - ay * cx) +
                        (cx * cx + cy * cy) * (ax * by - ay * bx);

            return det > 0;
        }
    }

    // ==================== ЗАХВАТ КОНТЕНТА ====================
    async function captureContent(element) {
        if (!window.html2canvas) {
            console.warn('[glassShatter] html2canvas не загружен, создаём фоллбек');
            return createFallbackCanvas(element);
        }

        const rect = element.getBoundingClientRect();
        
        try {
            const canvas = await window.html2canvas(element, {
                backgroundColor: null,
                scale: Math.min(window.devicePixelRatio || 1, 2),
                logging: false,
                useCORS: true,
                width: Math.floor(rect.width),
                height: Math.floor(rect.height),
                x: 0,
                y: 0,
                scrollX: -window.scrollX,
                scrollY: -window.scrollY,
            });

            return {
                canvas: canvas,
                width: rect.width,
                height: rect.height,
                rect: rect
            };
        } catch (err) {
            console.error('[glassShatter] Ошибка захвата:', err);
            return createFallbackCanvas(element);
        }
    }

    function createFallbackCanvas(element) {
        const canvas = document.createElement('canvas');
        const rect = element.getBoundingClientRect();
        canvas.width = Math.floor(rect.width) || 800;
        canvas.height = Math.floor(rect.height) || 600;
        const ctx = canvas.getContext('2d');
        const bg = window.getComputedStyle(element).backgroundColor || '#1a1a2e';
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return { canvas: canvas, width: canvas.width, height: canvas.height, rect: rect };
    }

    // ==================== ФАЗА 1: ТРЕЩИНЫ ====================
    function createCracks(width, height, clickX, clickY) {
        const cracks = [];
        const maxLen = Math.min(width, height) * CONFIG.crackMaxLength;

        for (let i = 0; i < CONFIG.crackCount; i++) {
            const angle = (i / CONFIG.crackCount) * Math.PI * 2 + Utils.random(-0.3, 0.3);
            const length = maxLen * Utils.random(0.6, 1.0);
            
            const points = [];
            const segments = CONFIG.crackSegments;
            
            for (let s = 0; s <= segments; s++) {
                const t = s / segments;
                const px = clickX + Math.cos(angle) * length * t;
                const py = clickY + Math.sin(angle) * length * t;
                const offset = Utils.random(-1, 1) * 10 * (1 + t * 1.5);
                const perpAngle = angle + Math.PI / 2;
                points.push({
                    x: px + Math.cos(perpAngle) * offset,
                    y: py + Math.sin(perpAngle) * offset,
                    width: Utils.random(1, 4) * (1 - t * 0.6),
                    progress: 0
                });
            }
            
            const crack = {
                points: points,
                angle: angle,
                length: length,
                branches: [],
                progress: 0
            };

            if (Math.random() < CONFIG.crackBranchChance) {
                const branchCount = Utils.randomInt(1, CONFIG.crackBranchCount);
                for (let b = 0; b < branchCount; b++) {
                    const branchAngle = angle + Utils.random(-1.2, 1.2);
                    const branchLength = length * CONFIG.crackBranchLength * Utils.random(0.5, 1.0);
                    const startT = Utils.random(0.2, 0.7);
                    const startIdx = Math.floor(startT * segments);
                    
                    const branchPoints = [];
                    const bSegments = 5;
                    
                    const startPoint = points[startIdx];
                    if (!startPoint) continue;
                    
                    for (let s = 0; s <= bSegments; s++) {
                        const t = s / bSegments;
                        const px = startPoint.x + Math.cos(branchAngle) * branchLength * t;
                        const py = startPoint.y + Math.sin(branchAngle) * branchLength * t;
                        const offset = Utils.random(-1, 1) * 6 * (1 + t);
                        const perpAngle = branchAngle + Math.PI / 2;
                        branchPoints.push({
                            x: px + Math.cos(perpAngle) * offset,
                            y: py + Math.sin(perpAngle) * offset,
                            width: Utils.random(0.5, 2) * (1 - t * 0.7),
                            progress: 0
                        });
                    }
                    
                    crack.branches.push({
                        points: branchPoints,
                        startX: startPoint.x,
                        startY: startPoint.y,
                        progress: 0
                    });
                }
            }

            cracks.push(crack);
        }

        const sparkles = [];
        for (let i = 0; i < CONFIG.sparkleCount; i++) {
            const angle = Utils.random(0, Math.PI * 2);
            const dist = Utils.random(2, 30);
            sparkles.push({
                x: clickX + Math.cos(angle) * dist,
                y: clickY + Math.sin(angle) * dist,
                size: Utils.random(1, 5),
                angle: Utils.random(0, Math.PI * 2),
                speed: Utils.random(0.5, 2.5),
                color: Utils.randomSparkColor(),
                progress: 0,
                delay: Utils.random(0, 0.3),
                life: Utils.random(0.3, 0.9)
            });
        }

        return { cracks: cracks, sparkles: sparkles };
    }

    function drawCracks(ctx, width, height, progress, cracks, sparkles) {
        if (!ctx) return;
        
        ctx.clearRect(0, 0, width, height);

        const alpha = Math.min(progress * 2.5, 0.95);

        const glowRadius = width * 0.3 * (1 - Math.max(0, progress - 0.5) * 0.7);
        const gradient = ctx.createRadialGradient(
            STATE.clickOffsetX, STATE.clickOffsetY, 0,
            STATE.clickOffsetX, STATE.clickOffsetY, glowRadius
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, ' + (alpha * 0.25 * CONFIG.crackGlowIntensity) + ')');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, ' + (alpha * 0.08 * CONFIG.crackGlowIntensity) + ')');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        for (let c = 0; c < cracks.length; c++) {
            const crack = cracks[c];
            const p = Math.min(progress / 0.5, 1);
            const drawCount = Math.floor(crack.points.length * p);
            
            if (drawCount < 2) continue;

            ctx.beginPath();
            ctx.moveTo(crack.points[0].x, crack.points[0].y);
            
            for (let i = 1; i < drawCount && i < crack.points.length; i++) {
                const pt = crack.points[i];
                ctx.lineTo(pt.x, pt.y);
            }
            
            ctx.strokeStyle = 'rgba(255, 255, 255, ' + (alpha * 0.95) + ')';
            ctx.lineWidth = Utils.lerp(3.5, 1.5, p);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowColor = 'rgba(255, 255, 255, ' + (alpha * 0.7 * CONFIG.crackGlowIntensity) + ')';
            ctx.shadowBlur = 15 + (1 - p) * 8;
            ctx.stroke();

            for (let b = 0; b < crack.branches.length; b++) {
                const branch = crack.branches[b];
                const bp = Math.min((progress - 0.1) / 0.5, 1);
                if (bp <= 0) continue;
                
                const branchCount = Math.floor(branch.points.length * bp);
                if (branchCount < 1) continue;
                
                ctx.beginPath();
                ctx.moveTo(branch.startX, branch.startY);
                for (let i = 0; i < branchCount && i < branch.points.length; i++) {
                    const pt = branch.points[i];
                    ctx.lineTo(pt.x, pt.y);
                }
                ctx.strokeStyle = 'rgba(255, 255, 255, ' + (alpha * 0.7) + ')';
                ctx.lineWidth = Utils.lerp(2.5, 0.8, bp);
                ctx.shadowBlur = 8;
                ctx.stroke();
            }
        }

        if (progress > 0.4) {
            const sparkProgress = (progress - 0.4) / 0.6;
            for (let s = 0; s < sparkles.length; s++) {
                const spark = sparkles[s];
                const sp = Utils.clamp((sparkProgress - spark.delay) / (1 - spark.delay), 0, 1);
                if (sp <= 0 || sp > 1) continue;
                
                const size = spark.size * (1 - sp * 0.7);
                const alpha2 = (1 - sp) * 0.9;
                
                ctx.save();
                ctx.globalAlpha = alpha * alpha2;
                ctx.translate(spark.x, spark.y);
                ctx.rotate(spark.angle + sp * spark.speed * 2);
                
                ctx.shadowColor = 'rgba(255, 255, 255, ' + (alpha2 * 0.9) + ')';
                ctx.shadowBlur = 18;
                ctx.fillStyle = spark.color;
                
                const s2 = size;
                ctx.fillRect(-s2/2, -s2/8, s2, s2/4);
                ctx.fillRect(-s2/8, -s2/2, s2/4, s2);
                
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(0, 0, s2 * 0.2, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.restore();
            }
        }
    }

    // ==================== FLASHBANG (ВСПЫШКА) ====================
    function createFlashbang() {
        const flashDiv = document.createElement('div');
        flashDiv.style.cssText = 
            'position:fixed;' +
            'inset:0;' +
            'width:100%;' +
            'height:100%;' +
            'background:' + CONFIG.flashColor + ';' +
            'pointer-events:none;' +
            'z-index:999999;' +
            'opacity:0;' +
            'transition:opacity ' + CONFIG.flashFadeDuration + 's ease-out;';
        document.body.appendChild(flashDiv);
        STATE.flashDiv = flashDiv;
        
        requestAnimationFrame(function () {
            flashDiv.style.opacity = '1';
        });
        
        STATE.isFlashActive = true;
        STATE.flashStartTime = performance.now();
        
        setTimeout(function () {
            if (flashDiv) {
                flashDiv.style.opacity = '0';
                setTimeout(function () {
                    if (flashDiv && flashDiv.parentNode) {
                        flashDiv.remove();
                        STATE.flashDiv = null;
                        STATE.isFlashActive = false;
                    }
                }, CONFIG.flashFadeDuration * 1000 + 100);
            }
        }, CONFIG.flashDuration * 1000);
    }

    // ==================== ФАЗА 2: 3D ОСКОЛКИ ====================
    function createShards3D(textureData, origin) {
        const THREE = window.THREE;
        const canvas = textureData.canvas;
        const width = textureData.width;
        const height = textureData.height;
        const rect = textureData.rect;

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const points = [];
        const cols = Math.ceil(Math.sqrt(CONFIG.shardCount * (width / height)));
        const rows = Math.ceil(CONFIG.shardCount / cols);
        const cellW = width / cols;
        const cellH = height / rows;

        for (let row = 0; row <= rows; row++) {
            for (let col = 0; col <= cols; col++) {
                const x = col * cellW + Utils.random(-cellW * 0.25, cellW * 0.25);
                const y = row * cellH + Utils.random(-cellH * 0.25, cellH * 0.25);
                points.push(Utils.clamp(x, 0, width), Utils.clamp(y, 0, height));
            }
        }

        const hitX = Utils.clamp(STATE.clickOffsetX, 0, width);
        const hitY = Utils.clamp(STATE.clickOffsetY, 0, height);
        points.push(hitX, hitY);

        const delaunay = new Delaunay(points);
        const triangles = delaunay.triangles;

        if (triangles.length === 0) {
            console.error('[glassShatter] Триангуляция не дала результатов, создаём фоллбек');
            return createFallbackShards(textureData, origin);
        }

        const shards = [];
        const scene = STATE.scene;
        const totalWidth = width;
        const totalHeight = height;
        const scale = CONFIG.aspectScale;

        const triData = triangles.map(function (tri) {
            const i0 = tri[0];
            const i1 = tri[1];
            const i2 = tri[2];
            const p0x = points[i0 * 2];
            const p0y = points[i0 * 2 + 1];
            const p1x = points[i1 * 2];
            const p1y = points[i1 * 2 + 1];
            const p2x = points[i2 * 2];
            const p2y = points[i2 * 2 + 1];
            
            const area = Math.abs(
                (p1x - p0x) * (p2y - p0y) -
                (p2x - p0x) * (p1y - p0y)
            ) / 2;
            
            return { tri: tri, area: area, p0x: p0x, p0y: p0y, p1x: p1x, p1y: p1y, p2x: p2x, p2y: p2y };
        });

        const validTris = triData.filter(function (d) {
            return d.area >= CONFIG.shardMinArea && d.area <= CONFIG.shardMaxArea;
        }).sort(function (a, b) {
            return a.area - b.area;
        });

        if (validTris.length === 0) {
            console.warn('[glassShatter] Нет подходящих треугольников, создаём фоллбек');
            return createFallbackShards(textureData, origin);
        }

        const centerX = width / 2;
        const centerY = height / 2;

        for (let t = 0; t < validTris.length; t++) {
            const data = validTris[t];
            const p0x = data.p0x;
            const p0y = data.p0y;
            const p1x = data.p1x;
            const p1y = data.p1y;
            const p2x = data.p2x;
            const p2y = data.p2y;
            
            const cx = (p0x + p1x + p2x) / 3;
            const cy = (p0y + p1y + p2y) / 3;

            const v0x = (p0x - cx) * scale;
            const v0y = (p0y - cy) * scale;
            const v1x = (p1x - cx) * scale;
            const v1y = (p1y - cy) * scale;
            const v2x = (p2x - cx) * scale;
            const v2y = (p2y - cy) * scale;

            const geometry = new THREE.BufferGeometry();
            
            const uv0x = p0x / totalWidth;
            const uv0y = 1 - (p0y / totalHeight);
            const uv1x = p1x / totalWidth;
            const uv1y = 1 - (p1y / totalHeight);
            const uv2x = p2x / totalWidth;
            const uv2y = 1 - (p2y / totalHeight);

            const thickness = CONFIG.shardThickness * (0.3 + Math.random() * 0.7);

            const vertices = [
                v0x, v0y, thickness * 0.3,
                v1x, v1y, thickness * 0.3,
                v2x, v2y, thickness * 0.3,
                v0x, v0y, -thickness * 0.3,
                v1x, v1y, -thickness * 0.3,
                v2x, v2y, -thickness * 0.3
            ];

            const uvs = [
                uv0x, uv0y,
                uv1x, uv1y,
                uv2x, uv2y,
                uv0x, uv0y,
                uv1x, uv1y,
                uv2x, uv2y
            ];

            const indices = [
                0, 1, 2,
                3, 5, 4,
                0, 3, 1,
                1, 3, 4,
                1, 4, 2,
                2, 4, 5,
                2, 5, 0,
                0, 5, 3
            ];

            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geometry.setIndex(indices);
            geometry.computeVertexNormals();

            const material = new THREE.MeshPhysicalMaterial({
                map: texture,
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide,
                roughness: 0.12,
                metalness: 0.08,
                clearcoat: 0.4,
                clearcoatRoughness: 0.15,
                reflectivity: 0.5,
                envMapIntensity: 0.4,
                premultipliedAlpha: true,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: -1,
            });

            const mesh = new THREE.Mesh(geometry, material);
            
            const worldX = origin.x + (cx - width / 2) * scale;
            const worldY = -(origin.y + (cy - height / 2) * scale);
            const worldZ = 0;
            mesh.position.set(worldX, worldY, worldZ);

            mesh.rotation.z = Utils.random(-0.15, 0.15);

            const dx = cx - centerX;
            const dy = -(cy - centerY);
            const dist = Math.sqrt(dx * dx + dy * dy) + 1;
            const forceMult = Utils.random(0.7, 1.3);

            const velocity = new THREE.Vector3(
                (dx / dist) * CONFIG.explosionForce * 0.7 * forceMult + Utils.random(-2, 2),
                (dy / dist) * CONFIG.explosionForce * 0.6 * forceMult + CONFIG.explosionForce * 0.3 + Utils.random(-1, 4),
                Utils.random(3, 15)
            );

            const angularVelocity = new THREE.Vector3(
                Utils.random(-CONFIG.rotationSpeed, CONFIG.rotationSpeed) * 1.5,
                Utils.random(-CONFIG.rotationSpeed, CONFIG.rotationSpeed) * 1.5,
                Utils.random(-CONFIG.rotationSpeed, CONFIG.rotationSpeed) * 0.8
            );

            const size = Math.sqrt(data.area);

            scene.add(mesh);
            shards.push({
                mesh: mesh,
                velocity: velocity,
                angularVelocity: angularVelocity,
                age: 0,
                onGround: false,
                size: size,
                mass: data.area * 0.001,
                opacity: 0,
                visible: false,
            });
        }

        console.log('[glassShatter] Создано ' + shards.length + ' осколков из ' + validTris.length + ' треугольников');
        return shards;
    }

    function createFallbackShards(textureData, origin) {
        const THREE = window.THREE;
        const canvas = textureData.canvas;
        const width = textureData.width;
        const height = textureData.height;
        const shards = [];
        const scale = CONFIG.aspectScale;

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace;

        const count = Math.min(CONFIG.shardCount, 60);
        const size = Math.min(width, height) * scale / 4;

        for (let i = 0; i < count; i++) {
            const x = Utils.random(0, width);
            const y = Utils.random(0, height);
            const w = Utils.random(size * 0.3, size);
            const h = Utils.random(size * 0.3, size);

            const geometry = new THREE.BoxGeometry(w, h, CONFIG.shardThickness * 0.5);
            const material = new THREE.MeshPhysicalMaterial({
                map: texture,
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide,
                roughness: 0.2,
                metalness: 0.05,
                clearcoat: 0.2,
            });

            const mesh = new THREE.Mesh(geometry, material);
            
            const u1 = x / width;
            const v1 = 1 - y / height;
            const u2 = (x + w / scale) / width;
            const v2 = 1 - (y + h / scale) / height;
            
            const uvAttr = geometry.attributes.uv;
            if (uvAttr) {
                const uvArray = uvAttr.array;
                uvArray[0] = u1; uvArray[1] = v2;
                uvArray[2] = u2; uvArray[3] = v2;
                uvArray[4] = u1; uvArray[5] = v1;
                uvArray[6] = u2; uvArray[7] = v1;
                uvAttr.needsUpdate = true;
            }

            const worldX = origin.x + (x - width / 2) * scale;
            const worldY = -(origin.y + (y - height / 2) * scale);
            mesh.position.set(worldX, worldY, 0);

            const velocity = new THREE.Vector3(
                Utils.random(-CONFIG.explosionForce, CONFIG.explosionForce) * 0.4,
                Utils.random(-CONFIG.explosionForce, CONFIG.explosionForce) * 0.4 + CONFIG.explosionForce * 0.3,
                Utils.random(3, 12)
            );

            const angularVelocity = new THREE.Vector3(
                Utils.random(-CONFIG.rotationSpeed, CONFIG.rotationSpeed),
                Utils.random(-CONFIG.rotationSpeed, CONFIG.rotationSpeed),
                Utils.random(-CONFIG.rotationSpeed, CONFIG.rotationSpeed)
            );

            STATE.scene.add(mesh);
            shards.push({
                mesh: mesh,
                velocity: velocity,
                angularVelocity: angularVelocity,
                age: 0,
                onGround: false,
                size: Math.max(w, h),
                mass: w * h * 0.001,
                opacity: 0,
                visible: false,
            });
        }

        console.log('[glassShatter] Создано ' + shards.length + ' фоллбек-осколков');
        return shards;
    }

    // ==================== ФИЗИКА ====================
    function updatePhysics(dt) {
        let alive = false;
        const floorY = STATE.floorY;

        for (let i = STATE.shards.length - 1; i >= 0; i--) {
            const shard = STATE.shards[i];
            shard.age += dt;

            if (!shard.visible && shard.age < 0.15) {
                shard.visible = true;
                shard.opacity = Math.min(shard.age / 0.15, 1) * CONFIG.shardOpacity;
                shard.mesh.material.opacity = shard.opacity;
            }

            if (!shard.onGround) {
                shard.velocity.y += CONFIG.gravity * dt;
                
                shard.velocity.x *= CONFIG.friction;
                shard.velocity.y *= CONFIG.friction;
                shard.velocity.z *= CONFIG.friction;
                
                shard.mesh.position.x += shard.velocity.x * dt;
                shard.mesh.position.y += shard.velocity.y * dt;
                shard.mesh.position.z += shard.velocity.z * dt;
                
                shard.mesh.rotation.x += shard.angularVelocity.x * dt;
                shard.mesh.rotation.y += shard.angularVelocity.y * dt;
                shard.mesh.rotation.z += shard.angularVelocity.z * dt;
                
                shard.angularVelocity.x *= CONFIG.angularFriction;
                shard.angularVelocity.y *= CONFIG.angularFriction;
                shard.angularVelocity.z *= CONFIG.angularFriction;

                if (shard.mesh.position.y < floorY) {
                    shard.mesh.position.y = floorY;
                    
                    const bounce = CONFIG.bounceFactor * (0.5 + Math.random() * 0.5);
                    shard.velocity.y = -shard.velocity.y * bounce;
                    shard.velocity.x *= CONFIG.floorFriction;
                    shard.velocity.z *= CONFIG.floorFriction;
                    
                    shard.angularVelocity.x += Utils.random(-3, 3);
                    shard.angularVelocity.y += Utils.random(-3, 3);
                    
                    if (Math.abs(shard.velocity.y) < 0.5) {
                        shard.onGround = true;
                        shard.velocity.x *= 0.8;
                        shard.velocity.z *= 0.8;
                        shard.angularVelocity.multiplyScalar(0.5);
                    }
                }

                const halfScreenX = window.innerWidth * CONFIG.aspectScale / 2 + 5;
                if (Math.abs(shard.mesh.position.x) > halfScreenX) {
                    shard.mesh.position.x = Math.sign(shard.mesh.position.x) * halfScreenX;
                    shard.velocity.x *= -0.3;
                    shard.velocity.z *= 0.8;
                }

                if (Math.abs(shard.mesh.position.z) > 45) {
                    shard.mesh.position.z = Math.sign(shard.mesh.position.z) * 45;
                    shard.velocity.z *= -0.3;
                }
            }

            const fadeStart = CONFIG.shardLifetime * CONFIG.fadeOutStart;
            if (shard.age > fadeStart) {
                const fadeProgress = (shard.age - fadeStart) / (CONFIG.shardLifetime * (1 - CONFIG.fadeOutStart));
                shard.opacity = CONFIG.shardOpacity * (1 - Math.min(fadeProgress, 1));
                shard.mesh.material.opacity = shard.opacity;
            }

            if (shard.age >= CONFIG.shardLifetime || shard.opacity <= 0) {
                STATE.scene.remove(shard.mesh);
                shard.mesh.geometry.dispose();
                shard.mesh.material.dispose();
                STATE.shards.splice(i, 1);
                continue;
            }

            alive = true;
        }

        return alive;
    }

    // ==================== ИНИЦИАЛИЗАЦИЯ THREE.JS ====================
    function initThree() {
        if (STATE.renderer) return true;

        const THREE = window.THREE;
        if (!THREE) {
            console.error('[glassShatter] Three.js не загружен');
            return false;
        }

        const canvas = document.createElement('canvas');
        canvas.className = 'glass-shatter-canvas';
        canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99999;display:none;';
        document.body.appendChild(canvas);

        STATE.canvas3d = canvas;
        STATE.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
        });
        STATE.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        STATE.renderer.setSize(window.innerWidth, window.innerHeight);
        STATE.renderer.setClearColor(0x000000, 0);
        STATE.renderer.shadowMap.enabled = true;
        STATE.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        STATE.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        STATE.renderer.toneMappingExposure = 1.2;

        STATE.scene = new THREE.Scene();
        
        STATE.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
        STATE.camera.position.set(0, 0, 60);
        STATE.camera.lookAt(0, 0, 0);

        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        STATE.scene.add(ambient);

        const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
        mainLight.position.set(15, 25, 20);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 1024;
        mainLight.shadow.mapSize.height = 1024;
        STATE.scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0x8888ff, 0.4);
        fillLight.position.set(-20, 10, -10);
        STATE.scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
        rimLight.position.set(0, -20, 20);
        STATE.scene.add(rimLight);

        STATE.clock = new THREE.Clock();
        
        STATE.floorY = screenToWorld(0, window.innerHeight).y;
        
        window.addEventListener('resize', onResize);
        return true;
    }

    function onResize() {
        if (!STATE.renderer) return;
        STATE.renderer.setSize(window.innerWidth, window.innerHeight);
        STATE.camera.aspect = window.innerWidth / window.innerHeight;
        STATE.camera.updateProjectionMatrix();
        STATE.floorY = screenToWorld(0, window.innerHeight).y;
    }

    function screenToWorld(x, y) {
        const ndcX = (x / window.innerWidth) * 2 - 1;
        const ndcY = -(y / window.innerHeight) * 2 + 1;
        const ndc = new THREE.Vector2(ndcX, ndcY);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, STATE.camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const point = new THREE.Vector3();
        ray.ray.intersectPlane(plane, point);
        return point;
    }

    // ==================== ИГРОВОЙ ЦИКЛ ====================
    function gameLoop(timestamp) {
        if (!STATE.running) return;

        const dt = STATE.lastTime === 0 ? 1 / 60 : Math.min((timestamp - STATE.lastTime) / 1000, 0.05);
        STATE.lastTime = timestamp;

        if (STATE.phase === 1) {
            STATE.crackProgress += dt / CONFIG.crackDuration;
            if (STATE.crackProgress >= 1) {
                STATE.crackProgress = 1;
                drawCracks(
                    STATE.ctx2d,
                    STATE.screenshotWidth,
                    STATE.screenshotHeight,
                    1,
                    STATE.cracks,
                    STATE.sparkles
                );
                transitionToShards();
            } else {
                drawCracks(
                    STATE.ctx2d,
                    STATE.screenshotWidth,
                    STATE.screenshotHeight,
                    STATE.crackProgress,
                    STATE.cracks,
                    STATE.sparkles
                );
            }
        }

        if (STATE.phase === 2) {
            const alive = updatePhysics(dt);
            STATE.renderer.render(STATE.scene, STATE.camera);
            
            if (!alive) {
                stopEffect();
                return;
            }
        }

        STATE.rafId = requestAnimationFrame(gameLoop);
    }

    // ==================== ПЕРЕХОД МЕЖДУ ФАЗАМИ ====================
    function transitionToShards() {
        // Запускаем Flashbang
        createFlashbang();
        
        // Подготовка 3D сцены под вспышкой
        if (STATE.canvas2d) {
            STATE.canvas2d.style.opacity = '0';
            setTimeout(function () {
                if (STATE.canvas2d) {
                    STATE.canvas2d.remove();
                    STATE.canvas2d = null;
                    STATE.ctx2d = null;
                }
            }, 100);
        }

        if (STATE.targetElement) {
            STATE.targetElement.style.transition = 'opacity 0.05s ease-out';
            STATE.targetElement.style.opacity = '0';
        }

        // Показываем 3D canvas
        if (STATE.canvas3d) {
            STATE.canvas3d.style.display = 'block';
        }

        const rect = STATE.elementRect || STATE.targetElement.getBoundingClientRect();
        const origin = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
        
        STATE.shards = createShards3D(
            {
                canvas: STATE.screenshot,
                width: STATE.screenshotWidth,
                height: STATE.screenshotHeight,
                rect: rect
            },
            origin
        );

        STATE.phase = 2;
        STATE.clock.start();
        STATE.lastTime = 0;
    }

    // ==================== ЗАПУСК ЭФФЕКТА ====================
    async function shatter(clickX, clickY) {
        if (STATE.isShattering) return;
        STATE.isShattering = true;

        try {
            const element = document.querySelector('.creator__panel') ||
                            document.querySelector('.creator') ||
                            document.querySelector('.main') ||
                            document.querySelector('.page-content') ||
                            document.querySelector('.content') ||
                            document.querySelector('.cards-grid') ||
                            document.querySelector('main') ||
                            document.body;

            STATE.targetElement = element;
            STATE.originalOpacity = parseFloat(window.getComputedStyle(element).opacity) || 1;

            if (!initThree()) {
                console.error('[glassShatter] Не удалось инициализировать Three.js');
                STATE.isShattering = false;
                return;
            }

            const rect = element.getBoundingClientRect();
            STATE.elementRect = rect;
            
            STATE.clickX = clickX !== undefined ? clickX : rect.left + rect.width / 2;
            STATE.clickY = clickY !== undefined ? clickY : rect.top + rect.height / 2;
            STATE.clickOffsetX = STATE.clickX - rect.left;
            STATE.clickOffsetY = STATE.clickY - rect.top;

            const textureData = await captureContent(element);
            STATE.screenshot = textureData.canvas;
            STATE.screenshotWidth = textureData.width;
            STATE.screenshotHeight = textureData.height;

            STATE.phase = 1;
            STATE.crackProgress = 0;

            const cracksData = createCracks(
                STATE.screenshotWidth,
                STATE.screenshotHeight,
                STATE.clickOffsetX,
                STATE.clickOffsetY
            );
            STATE.cracks = cracksData.cracks;
            STATE.sparkles = cracksData.sparkles;

            const canvas2d = document.createElement('canvas');
            canvas2d.width = STATE.screenshotWidth;
            canvas2d.height = STATE.screenshotHeight;
            canvas2d.style.cssText = 'position:fixed;left:' + rect.left + 'px;top:' + rect.top + 'px;width:' + rect.width + 'px;height:' + rect.height + 'px;pointer-events:none;z-index:99998;opacity:0;transition:opacity 0.15s ease;';
            document.body.appendChild(canvas2d);
            
            STATE.canvas2d = canvas2d;
            STATE.ctx2d = canvas2d.getContext('2d');

            requestAnimationFrame(function () {
                canvas2d.style.opacity = '1';
            });

            STATE.running = true;
            STATE.lastTime = 0;
            STATE.rafId = requestAnimationFrame(gameLoop);

            console.log('[glassShatter] Эффект запущен');

        } catch (err) {
            console.error('[glassShatter] Ошибка:', err);
            STATE.isShattering = false;
            stopEffect();
        }
    }

    // ==================== ОСТАНОВКА ====================
    function stopEffect() {
        STATE.running = false;
        STATE.phase = 0;
        STATE.isShattering = false;
        STATE.isFlashActive = false;

        if (STATE.rafId) {
            cancelAnimationFrame(STATE.rafId);
            STATE.rafId = 0;
        }

        if (STATE.flashDiv) {
            STATE.flashDiv.remove();
            STATE.flashDiv = null;
        }

        if (STATE.targetElement) {
            STATE.targetElement.style.transition = 'opacity 0.3s ease-in';
            STATE.targetElement.style.opacity = String(STATE.originalOpacity);
            STATE.targetElement = null;
        }

        if (STATE.canvas2d) {
            STATE.canvas2d.remove();
            STATE.canvas2d = null;
            STATE.ctx2d = null;
        }

        for (let i = 0; i < STATE.shards.length; i++) {
            const shard = STATE.shards[i];
            STATE.scene.remove(shard.mesh);
            shard.mesh.geometry.dispose();
            shard.mesh.material.dispose();
        }
        STATE.shards = [];

        if (STATE.canvas3d) {
            STATE.canvas3d.style.display = 'none';
        }

        STATE.cracks = [];
        STATE.sparkles = [];
        STATE.screenshot = null;

        console.log('[glassShatter] Эффект остановлен');
    }

    // ==================== ЗАГРУЗКА БИБЛИОТЕК ====================
    async function loadLibraries() {
        const loadScript = function (src) {
            return new Promise(function (resolve, reject) {
                if (document.querySelector('script[src="' + src + '"]')) {
                    resolve();
                    return;
                }
                const script = document.createElement('script');
                script.src = src;
                script.onload = function () { resolve(); };
                script.onerror = function () { reject(new Error('Не удалось загрузить ' + src)); };
                document.head.appendChild(script);
            });
        };

        try {
            if (!window.THREE) {
                await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
            }
            if (!window.html2canvas) {
                await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
            }
            console.log('[glassShatter] Библиотеки загружены');
        } catch (err) {
            console.error('[glassShatter] Ошибка загрузки библиотек:', err);
        }
    }

    // ==================== ОБРАБОТЧИКИ ====================
    function handleKeyDown(event) {
        if (event.altKey && (event.key === 'h' || event.key === 'H' || event.code === 'KeyH')) {
            event.preventDefault();
            shatter();
        }
    }

    function handleClick(event) {
        if (event.altKey && event.ctrlKey) {
            event.preventDefault();
            shatter(event.clientX, event.clientY);
        }
    }

    // ==================== ИНИЦИАЛИЗАЦИЯ ====================
    async function init() {
        try {
            await loadLibraries();
            document.addEventListener('keydown', handleKeyDown);
            document.addEventListener('click', handleClick);
            window.addEventListener('resize', onResize);
            
            console.log('[glassShatter] Готов к работе!');
            console.log('  - Ctrl + Alt + Клик: разбить в точке клика');
            console.log('  - Alt + H: разбить по центру');
            console.log('  - Осколков: ' + CONFIG.shardCount + ', Трещин: ' + CONFIG.crackCount);
            console.log('  - Flashbang: ' + CONFIG.flashDuration + 'с ослепление, ' + CONFIG.flashFadeDuration + 'с затухание');
            
            window.glassShatter = {
                shatter: shatter,
                init: init,
                stop: stopEffect,
                CONFIG: CONFIG,
                STATE: STATE
            };
            
        } catch (err) {
            console.error('[glassShatter] Ошибка инициализации:', err);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();