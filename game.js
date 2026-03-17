// ========================================
// FPS GAME - Counter-Strike 2 Style
// ========================================

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 500, 1000);

const canvas = document.getElementById('canvas');
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowShadowMap;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(100, 100, 50);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -200;
directionalLight.shadow.camera.right = 200;
directionalLight.shadow.camera.top = 200;
directionalLight.shadow.camera.bottom = -200;
scene.add(directionalLight);

// Physics World
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.defaultContactMaterial.friction = 0.3;

// Player Controller
const playerController = {
    position: new THREE.Vector3(0, 10, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    acceleration: 0.1,
    maxSpeed: 0.5,
    jumpForce: 0.2,
    isGrounded: false,
    isSprinting: false,
    isCrouching: false,
    health: 100,
    crouchHeight: 1.2,
    normalHeight: 1.8
};

camera.position.copy(playerController.position);

// Input Handling
const keys = {};
const mouse = { x: 0, y: 0, locked: false };

document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    
    if (e.key === 'r' || e.key === 'R') {
        currentWeapon.reload();
    }
    
    if (e.key === '1') selectWeapon(0);
    if (e.key === '2') selectWeapon(1);
    if (e.key === '3') selectWeapon(2);
    
    if (e.key === 'Shift') playerController.isSprinting = true;
    if (e.key === 'Control') playerController.isCrouching = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    if (e.key === 'Shift') playerController.isSprinting = false;
    if (e.key === 'Control') playerController.isCrouching = false;
});

document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
        const sensitivity = 0.002;
        camera.rotation.order = 'YXZ';
        camera.rotation.y -= e.movementX * sensitivity;
        camera.rotation.x -= e.movementY * sensitivity;
        
        // Clamp vertical rotation
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
    }
});

document.addEventListener('click', () => {
    canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
    canvas.requestPointerLock();
});

document.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left click
        currentWeapon.shoot();
    }
});

// Map Creation
function createMap() {
    // Ground
    const groundGeometry = new THREE.PlaneGeometry(500, 500);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Add some walls/buildings
    createBuilding(0, 5, 0, 20, 10, 20, 0x8B4513);
    createBuilding(50, 5, 50, 15, 10, 15, 0x555555);
    createBuilding(-50, 5, -50, 20, 10, 20, 0x666666);
    createBuilding(0, 5, -100, 100, 10, 20, 0x444444);
}

function createBuilding(x, y, z, width, height, depth, color) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshLambertMaterial({ color });
    const building = new THREE.Mesh(geometry, material);
    building.position.set(x, y, z);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);
}

// Weapon System
const weaponStats = {
    ak47: {
        name: 'AK-47',
        damage: 25,
        fireRate: 10,
        accuracy: 0.92,
        recoil: 0.08,
        spreadIncrease: 0.02,
        maxSpread: 0.15,
        ammoPerMag: 30,
        totalAmmo: 240,
        reloadTime: 2.5,
        bulletSpeed: 3,
        weight: 3.6
    },
    m4a1: {
        name: 'M4A1',
        damage: 20,
        fireRate: 13,
        accuracy: 0.95,
        recoil: 0.06,
        spreadIncrease: 0.015,
        maxSpread: 0.12,
        ammoPerMag: 30,
        totalAmmo: 270,
        reloadTime: 2.3,
        bulletSpeed: 3.2,
        weight: 2.9
    },
    awp: {
        name: 'AWP Dragon Lore',
        damage: 86,
        fireRate: 1.5,
        accuracy: 0.99,
        recoil: 0.3,
        spreadIncrease: 0.1,
        maxSpread: 0.2,
        ammoPerMag: 10,
        totalAmmo: 50,
        reloadTime: 2.9,
        bulletSpeed: 4,
        weight: 6.5
    }
};

class Weapon {
    constructor(stats) {
        this.stats = { ...stats };
        this.currentAmmo = stats.ammoPerMag;
        this.totalAmmo = stats.totalAmmo;
        this.currentSpread = 0;
        this.lastShotTime = 0;
        this.isReloading = false;
        this.reloadStartTime = 0;
    }

    canShoot() {
        const timeSinceLastShot = Date.now() - this.lastShotTime;
        const minTimeBetweenShots = 1000 / this.stats.fireRate;
        return timeSinceLastShot > minTimeBetweenShots && this.currentAmmo > 0 && !this.isReloading;
    }

    shoot() {
        if (!this.canShoot()) return;

        this.currentAmmo--;
        this.lastShotTime = Date.now();

        // Increase spread
        this.currentSpread = Math.min(
            this.stats.maxSpread,
            this.currentSpread + this.stats.spreadIncrease
        );

        // Calculate bullet direction with spread
        const spread = this.currentSpread;
        const angle = (Math.random() - 0.5) * spread;
        const verticalAngle = (Math.random() - 0.5) * spread;

        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        direction.applyAxisAngle(new THREE.Vector3(1, 0, 0), verticalAngle);
        direction.applyQuaternion(camera.quaternion);

        // Create bullet
        createBullet(
            camera.position.clone(),
            direction,
            this.stats.damage,
            this.stats.bulletSpeed
        );

        // Visual feedback
        showMuzzleFlash();
        applyRecoil(this.stats.recoil);
        updateWeaponDisplay();
    }

    reload() {
        if (this.isReloading || this.currentAmmo === this.stats.ammoPerMag || this.totalAmmo === 0) {
            return;
        }

        this.isReloading = true;
        this.reloadStartTime = Date.now();

        setTimeout(() => {
            const ammoNeeded = this.stats.ammoPerMag - this.currentAmmo;
            const ammoToAdd = Math.min(ammoNeeded, this.totalAmmo);
            this.currentAmmo += ammoToAdd;
            this.totalAmmo -= ammoToAdd;
            this.isReloading = false;
            updateWeaponDisplay();
        }, this.stats.reloadTime * 1000);

        updateWeaponDisplay();
    }
}

let weapons = [
    new Weapon(weaponStats.ak47),
    new Weapon(weaponStats.m4a1),
    new Weapon(weaponStats.awp)
];

let currentWeaponIndex = 0;
let currentWeapon = weapons[0];

function selectWeapon(index) {
    if (index >= 0 && index < weapons.length) {
        currentWeaponIndex = index;
        currentWeapon = weapons[index];
        currentWeapon.currentSpread = 0;
        updateWeaponDisplay();
    }
}

// Bullet System
const bullets = [];

function createBullet(position, direction, damage, speed) {
    const bullet = {
        position: position.clone(),
        direction: direction.normalize(),
        damage: damage,
        speed: speed,
        age: 0,
        maxAge: 5000, // 5 seconds
        traveled: 0,
        maxDistance: 500
    };

    bullets.push(bullet);

    // Visual representation
    const geometry = new THREE.SphereGeometry(0.1, 4, 4);
    const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.userData.isBullet = true;
    mesh.userData.bulletData = bullet;
    scene.add(mesh);
    bullet.mesh = mesh;
}

function updateBullets(deltaTime) {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.age += deltaTime * 1000;

        // Movement
        const moveDistance = bullet.speed * (deltaTime / 1000);
        const moveVector = bullet.direction.clone().multiplyScalar(moveDistance);
        bullet.position.add(moveVector);
        bullet.traveled += moveDistance;

        // Update mesh position
        bullet.mesh.position.copy(bullet.position);

        // Remove if too old or traveled too far
        if (bullet.age > bullet.maxAge || bullet.traveled > bullet.maxDistance) {
            scene.remove(bullet.mesh);
            bullets.splice(i, 1);
            continue;
        }

        // Check for hits with objects
        const raycaster = new THREE.Raycaster(
            bullet.position.clone().sub(bullet.direction.clone().multiplyScalar(moveDistance)),
            bullet.direction
        );

        const intersects = raycaster.intersectObjects(scene.children);
        
        for (let hit of intersects) {
            if (hit.object !== bullet.mesh) {
                // Hit detected
                if (hit.object.userData.health !== undefined) {
                    hit.object.userData.health -= bullet.damage;
                    showDamageIndicator();
                }
                scene.remove(bullet.mesh);
                bullets.splice(i, 1);
                break;
            }
        }
    }
}

// Recoil System
let recoilPitch = 0;
let recoilYaw = 0;

function applyRecoil(recoilAmount) {
    recoilPitch += recoilAmount * (Math.random() - 0.3) * 0.5;
    recoilYaw += (Math.random() - 0.5) * recoilAmount;
}

function updateRecoil() {
    camera.rotation.x += recoilPitch * 0.1;
    camera.rotation.y += recoilYaw * 0.1;
    
    recoilPitch *= 0.92;
    recoilYaw *= 0.92;
}

// Visual Feedback
function showMuzzleFlash() {
    const flash = document.createElement('div');
    flash.className = 'muzzle-flash';
    flash.style.cssText = `
        top: 50%;
        left: 50%;
        width: 100px;
        height: 100px;
        background: radial-gradient(circle, #ffaa00, #ff6600, transparent);
        opacity: 0.8;
        pointer-events: none;
    `;
    document.getElementById('hud').appendChild(flash);
    
    setTimeout(() => flash.remove(), 50);
}

function showDamageIndicator() {
    const indicator = document.getElementById('damageIndicator');
    indicator.style.opacity = '1';
    setTimeout(() => indicator.style.opacity = '0', 100);
}

function updateWeaponDisplay() {
    const weapon = currentWeapon;
    document.getElementById('weaponName').textContent = weapon.stats.name;
    document.getElementById('ammoCount').textContent = `${weapon.currentAmmo} / ${weapon.totalAmmo}`;
}

// Player Movement
function updatePlayerMovement(deltaTime) {
    const moveDirection = new THREE.Vector3();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);

    if (keys['w']) moveDirection.add(forward);
    if (keys['s']) moveDirection.add(forward.multiplyScalar(-1));
    if (keys['a']) moveDirection.add(right.multiplyScalar(-1));
    if (keys['d']) moveDirection.add(right);

    if (moveDirection.length() > 0) {
        moveDirection.normalize();
        const speed = playerController.isSprinting ? 0.3 : 0.2;
        playerController.velocity.add(moveDirection.multiplyScalar(speed));
    }

    // Gravity
    playerController.velocity.y -= 0.015;

    // Jump
    if (keys[' '] && playerController.isGrounded) {
        playerController.velocity.y = 0.2;
        playerController.isGrounded = false;
    }

    // Apply friction
    playerController.velocity.x *= 0.95;
    playerController.velocity.z *= 0.95;

    // Update position
    playerController.position.add(playerController.velocity);

    // Ground collision
    if (playerController.position.y < 2) {
        playerController.position.y = 2;
        playerController.velocity.y = 0;
        playerController.isGrounded = true;
    }

    // Decrease spread over time when not shooting
    if (Date.now() - currentWeapon.lastShotTime > 100) {
        currentWeapon.currentSpread = Math.max(0, currentWeapon.currentSpread - 0.008);
    }

    camera.position.copy(playerController.position);
}

// Statistics
let frameCount = 0;
let lastTime = Date.now();
let fps = 0;

function updateStats() {
    frameCount++;
    const currentTime = Date.now();
    if (currentTime - lastTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastTime = currentTime;
    }

    document.getElementById('fps').textContent = fps;
    const pos = playerController.position;
    document.getElementById('position').textContent = 
        `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
    document.getElementById('bulletCount').textContent = bullets.length;
}

// Initialize
createMap();
updateWeaponDisplay();

// Game Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();

    // Update
    updatePlayerMovement(deltaTime);
    updateRecoil();
    updateBullets(deltaTime);
    updateStats();

    // Render
    renderer.render(scene, camera);
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});