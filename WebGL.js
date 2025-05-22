var VSHADER_SOURCE = `
    attribute vec4 a_Position;
    attribute vec4 a_Color;
    uniform mat4 u_ModelMatrix;
    uniform mat4 u_ViewMatrix;
    uniform mat4 u_ProjMatrix;
    varying vec4 v_Color;
    void main() {
        gl_Position = u_ProjMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;
        v_Color = a_Color;
    }
`;

var FSHADER_SOURCE = `
    precision mediump float;
    varying vec4 v_Color;
    void main() {
        gl_FragColor = v_Color;
    }
`;

// Global WebGL variables
let gl;
let program;
let canvas;

// Game state and UI elements
let gameState = 'startScreen'; // 'startScreen', 'playing', 'gameOverScreen'
let startScreenDiv, gameOverScreenDiv, startButton, restartButton;
let scoreDiv, coinCountDiv; // UI elements for score and coin count

// Game objects and parameters
let player;
let trains = [];
let coins = []; // Array to store coin objects
let score = 0;
let coinCount = 0; // Counter for collected coins
let lanes = [];

// 3D Game world parameters
const LANE_WIDTH = 1.0;       // Width of each lane
const LANE_LENGTH = 30.0;     // Length of the visible track
const LANE_SPACING = 1.2;     // Space between lane centers
// Global game parameters
const PLAYER_WIDTH = 1.0;     // Player width (increased for visibility)
const PLAYER_HEIGHT = 1.0;    // Player height (increased for visibility)
const PLAYER_DEPTH = 1.0;     // Player depth (increased for visibility)
const TRAIN_WIDTH = 0.9;      // Train width
const TRAIN_HEIGHT = 0.9;     // Train height
const TRAIN_DEPTH = 2.0;      // Train depth (longer than player)
// Coin parameters
const COIN_RADIUS = 0.3;      // Coin radius
const COIN_HEIGHT = 0.05;     // Coin thickness
const COIN_SEGMENTS = 12;     // Number of segments for coin cylinder
const COIN_ROTATION_SPEED = 90.0; // Degrees per second
// Movement parameters
const OBJECT_SPEED = 5.0;     // Unified speed for all moving objects

// Lane X positions (center of the lane)
const LANE_POSITIONS = [-LANE_SPACING, 0.0, LANE_SPACING];

// Matrices
let modelMatrix = new Matrix4();
let viewMatrix = new Matrix4();
let projMatrix = new Matrix4();

// Animation and timing
let animationFrameId = null;
let lastTimestamp = 0;
let trainSpawnInterval = 2.0; // seconds
let lastTrainSpawnTime = 0;
let coinSpawnInterval = 1.5; // seconds
let lastCoinSpawnTime = 0;

// 3D Cube vertices and colors
function createCube(width, height, depth, r, g, b) {
    // Create a cube
    //    v6----- v5
    //   /|      /|
    //  v1------v0|
    //  | |     | |
    //  | |v7---|-|v4
    //  |/      |/
    //  v2------v3
    const w = width / 2, h = height / 2, d = depth / 2;
    
    // Vertex coordinates
    const vertices = new Float32Array([
        // Front face
        w, h, d,   -w, h, d,   -w, -h, d,   w, -h, d,
        // Back face
        w, h, -d,   -w, h, -d,   -w, -h, -d,   w, -h, -d,
        // Top face
        w, h, d,   w, h, -d,   -w, h, -d,   -w, h, d,
        // Bottom face
        w, -h, d,   w, -h, -d,   -w, -h, -d,   -w, -h, d,
        // Right face
        w, h, d,   w, h, -d,   w, -h, -d,   w, -h, d,
        // Left face
        -w, h, d,   -w, h, -d,   -w, -h, -d,   -w, -h, d
    ]);
    
    // Colors (slightly vary the shade for each face)
    const baseColor = [r, g, b];
    const colors = new Float32Array([
        // Front face - base color
        ...baseColor, 1.0, ...baseColor, 1.0, ...baseColor, 1.0, ...baseColor, 1.0,
        // Back face - darker
        ...baseColor.map(c => c * 0.8), 1.0, ...baseColor.map(c => c * 0.8), 1.0, 
        ...baseColor.map(c => c * 0.8), 1.0, ...baseColor.map(c => c * 0.8), 1.0,
        // Top face - lighter
        ...baseColor.map(c => Math.min(c * 1.2, 1.0)), 1.0, ...baseColor.map(c => Math.min(c * 1.2, 1.0)), 1.0,
        ...baseColor.map(c => Math.min(c * 1.2, 1.0)), 1.0, ...baseColor.map(c => Math.min(c * 1.2, 1.0)), 1.0,
        // Bottom face - darker
        ...baseColor.map(c => c * 0.7), 1.0, ...baseColor.map(c => c * 0.7), 1.0,
        ...baseColor.map(c => c * 0.7), 1.0, ...baseColor.map(c => c * 0.7), 1.0,
        // Right face - slightly lighter
        ...baseColor.map(c => Math.min(c * 1.1, 1.0)), 1.0, ...baseColor.map(c => Math.min(c * 1.1, 1.0)), 1.0,
        ...baseColor.map(c => Math.min(c * 1.1, 1.0)), 1.0, ...baseColor.map(c => Math.min(c * 1.1, 1.0)), 1.0,
        // Left face - slightly darker
        ...baseColor.map(c => c * 0.9), 1.0, ...baseColor.map(c => c * 0.9), 1.0,
        ...baseColor.map(c => c * 0.9), 1.0, ...baseColor.map(c => c * 0.9), 1.0
    ]);
    
    // Indices of the vertices
    const indices = new Uint8Array([
        0, 1, 2,   0, 2, 3,    // front
        4, 5, 6,   4, 6, 7,    // back
        8, 9, 10,  8, 10, 11,  // top
        12, 13, 14, 12, 14, 15, // bottom
        16, 17, 18, 16, 18, 19, // right
        20, 21, 22, 20, 22, 23  // left
    ]);
    
    return { vertices, colors, indices };
}

// Create a cylinder (for coins)
function createCylinder(radius, height, segments, r, g, b) {
    const vertices = [];
    const colors = [];
    const indices = [];
    
    // Create the vertices for top and bottom faces
    // Center of top face
    vertices.push(0, height/2, 0);
    colors.push(r, g, b, 1.0);
    
    // Center of bottom face
    vertices.push(0, -height/2, 0);
    colors.push(r, g, b, 1.0);
    
    // Create vertices for the perimeter
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        
        // Top perimeter
        vertices.push(x, height/2, z);
        colors.push(r, g, b, 1.0);
        
        // Bottom perimeter
        vertices.push(x, -height/2, z);
        colors.push(r * 0.8, g * 0.8, b * 0.8, 1.0); // Slightly darker for bottom
    }
    
    // Create indices for top face (like a fan)
    for (let i = 0; i < segments; i++) {
        indices.push(
            0, // Center of top face
            2 + i * 2, // Current top perimeter point
            2 + ((i + 1) % segments) * 2 // Next top perimeter point
        );
    }
    
    // Create indices for bottom face (like a fan)
    for (let i = 0; i < segments; i++) {
        indices.push(
            1, // Center of bottom face
            3 + ((i + 1) % segments) * 2, // Next bottom perimeter point (reversed order)
            3 + i * 2 // Current bottom perimeter point
        );
    }
    
    // Create indices for the side faces
    for (let i = 0; i < segments; i++) {
        const current = 2 + i * 2;
        const next = 2 + ((i + 1) % segments) * 2;
        
        // First triangle
        indices.push(
            current,
            current + 1,
            next
        );
        
        // Second triangle
        indices.push(
            next,
            current + 1,
            next + 1
        );
    }
    
    return {
        vertices: new Float32Array(vertices),
        colors: new Float32Array(colors),
        indices: new Uint8Array(indices)
    };
}

// Lane class (3D version)
class Lane {
    constructor(position) {
        this.x = position;
        this.y = 0;
        this.z = -LANE_LENGTH / 2; // Center of the lane
        this.width = LANE_WIDTH;
        this.length = LANE_LENGTH;
        
        // Create lane geometry (a long rectangle)
        const w = this.width / 2;
        const l = this.length / 2;
        
        this.vertices = new Float32Array([
            // Top face only (visible from above)
            -w, 0, -l,  // bottom left
             w, 0, -l,  // bottom right
            -w, 0,  l,  // top left
             w, 0,  l   // top right
        ]);
        
        // Alternate lane colors for better visibility
        const laneColor = position === 0 ? 
            [0.5, 0.5, 0.5, 1.0] : // Middle lane: gray
            [0.4, 0.4, 0.4, 1.0];  // Side lanes: darker gray
        
        this.colors = new Float32Array([
            ...laneColor, ...laneColor, ...laneColor, ...laneColor
        ]);
        
        this.vertexBuffer = initArrayBufferForLaterUse(gl, this.vertices, 3, gl.FLOAT);
        this.colorBuffer = initArrayBufferForLaterUse(gl, this.colors, 4, gl.FLOAT);
    }
    
    draw() {
        modelMatrix.setTranslate(this.x, this.y, this.z);
        gl.uniformMatrix4fv(program.u_ModelMatrix, false, modelMatrix.elements);
        
        initAttributeVariable(gl, program.a_Position, this.vertexBuffer);
        initAttributeVariable(gl, program.a_Color, this.colorBuffer);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}

// Player class (3D version)
class Player {
    constructor(initialLane) {
        this.currentLane = initialLane; // 0, 1, or 2
        this.x = LANE_POSITIONS[this.currentLane];
        this.y = PLAYER_HEIGHT / 2; // Position player on the ground
        this.z = -2.0; // Fixed position on Z axis (closer to camera)
        
        // Create a colored cube for the player
        const cube = createCube(PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_DEPTH, 1.0, 0.2, 0.2); // Red cube
        
        this.vertexBuffer = initArrayBufferForLaterUse(gl, cube.vertices, 3, gl.FLOAT);
        this.colorBuffer = initArrayBufferForLaterUse(gl, cube.colors, 4, gl.FLOAT);
        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cube.indices, gl.STATIC_DRAW);
        this.numIndices = cube.indices.length;
    }
    
    move(direction) {
        if (gameState !== 'playing') return;
        if (direction === 'left' && this.currentLane > 0) {
            this.currentLane--;
        }
        if (direction === 'right' && this.currentLane < 2) {
            this.currentLane++;
        }
        this.x = LANE_POSITIONS[this.currentLane];
    }
    
    draw() {
        modelMatrix.setTranslate(this.x, this.y, this.z);
        gl.uniformMatrix4fv(program.u_ModelMatrix, false, modelMatrix.elements);
        
        initAttributeVariable(gl, program.a_Position, this.vertexBuffer);
        initAttributeVariable(gl, program.a_Color, this.colorBuffer);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements(gl.TRIANGLES, this.numIndices, gl.UNSIGNED_BYTE, 0);
    }
    
    // Get collision bounds for detection
    getBounds() {
        return {
            minX: this.x - PLAYER_WIDTH / 2,
            maxX: this.x + PLAYER_WIDTH / 2,
            minY: this.y - PLAYER_HEIGHT / 2,
            maxY: this.y + PLAYER_HEIGHT / 2,
            minZ: this.z - PLAYER_DEPTH / 2,
            maxZ: this.z + PLAYER_DEPTH / 2,
            lane: this.currentLane
        };
    }
}

// Train class (3D version)
class Train {
    constructor(laneIndex) {
        this.lane = laneIndex;
        this.x = LANE_POSITIONS[laneIndex];
        this.y = TRAIN_HEIGHT / 2; // Position train on the ground
        this.z = -LANE_LENGTH; // Start at the far end of the track
        this.speed = OBJECT_SPEED; // Use unified speed for all objects
        
        // Random color for the train (blue-ish)
        const r = Math.random() * 0.2;
        const g = Math.random() * 0.2 + 0.2;
        const b = Math.random() * 0.3 + 0.7;
        
        // Create a colored cube for the train
        const cube = createCube(TRAIN_WIDTH, TRAIN_HEIGHT, TRAIN_DEPTH, r, g, b);
        
        this.vertexBuffer = initArrayBufferForLaterUse(gl, cube.vertices, 3, gl.FLOAT);
        this.colorBuffer = initArrayBufferForLaterUse(gl, cube.colors, 4, gl.FLOAT);
        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cube.indices, gl.STATIC_DRAW);
        this.numIndices = cube.indices.length;
    }
    
    update(deltaTime) {
        // Move train toward the player (increasing Z)
        this.z += this.speed * deltaTime;
    }
    
    draw() {
        modelMatrix.setTranslate(this.x, this.y, this.z);
        gl.uniformMatrix4fv(program.u_ModelMatrix, false, modelMatrix.elements);
        
        initAttributeVariable(gl, program.a_Position, this.vertexBuffer);
        initAttributeVariable(gl, program.a_Color, this.colorBuffer);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements(gl.TRIANGLES, this.numIndices, gl.UNSIGNED_BYTE, 0);
    }
    
    // Get collision bounds for detection
    getBounds() {
        return {
            minX: this.x - TRAIN_WIDTH / 2,
            maxX: this.x + TRAIN_WIDTH / 2,
            minY: this.y - TRAIN_HEIGHT / 2,
            maxY: this.y + TRAIN_HEIGHT / 2,
            minZ: this.z - TRAIN_DEPTH / 2,
            maxZ: this.z + TRAIN_DEPTH / 2,
            lane: this.lane
        };
    }
}

// Coin class (3D version)
class Coin {
    constructor(laneIndex, zPosition) {
        this.lane = laneIndex;
        this.x = LANE_POSITIONS[laneIndex];
        this.y = COIN_RADIUS + 0.1; // Position coin slightly above the ground
        this.z = zPosition;
        this.rotationY = 0; // Current rotation angle
        this.collected = false;
        this.speed = OBJECT_SPEED; // Use unified speed for all objects
        
        // Create a gold coin (cylinder)
        const cylinder = createCylinder(COIN_RADIUS, COIN_HEIGHT, COIN_SEGMENTS, 1.0, 0.84, 0.0); // Gold color
        
        this.vertexBuffer = initArrayBufferForLaterUse(gl, cylinder.vertices, 3, gl.FLOAT);
        this.colorBuffer = initArrayBufferForLaterUse(gl, cylinder.colors, 4, gl.FLOAT);
        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cylinder.indices, gl.STATIC_DRAW);
        this.numIndices = cylinder.indices.length;
    }
    
    update(deltaTime) {
        // Move coin toward the player (increasing Z)
        this.z += this.speed * deltaTime;
        
        // Rotate the coin around Y axis
        this.rotationY += COIN_ROTATION_SPEED * deltaTime;
        if (this.rotationY >= 360) {
            this.rotationY -= 360;
        }
    }
    
    draw() {
        modelMatrix.setTranslate(this.x, this.y, this.z);
        modelMatrix.rotate(this.rotationY, 0, 1, 0); // Rotate around Y axis
        gl.uniformMatrix4fv(program.u_ModelMatrix, false, modelMatrix.elements);
        
        initAttributeVariable(gl, program.a_Position, this.vertexBuffer);
        initAttributeVariable(gl, program.a_Color, this.colorBuffer);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements(gl.TRIANGLES, this.numIndices, gl.UNSIGNED_BYTE, 0);
    }
    
    // Get collision bounds for detection
    getBounds() {
        return {
            minX: this.x - COIN_RADIUS,
            maxX: this.x + COIN_RADIUS,
            minY: this.y - COIN_RADIUS,
            maxY: this.y + COIN_RADIUS,
            minZ: this.z - COIN_RADIUS,
            maxZ: this.z + COIN_RADIUS,
            lane: this.lane
        };
    }
}

// Shader and buffer initialization functions
function compileShader(gl, vShaderText, fShaderText){
    var vertexShader = gl.createShader(gl.VERTEX_SHADER)
    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(vertexShader, vShaderText)
    gl.shaderSource(fragmentShader, fShaderText)
    gl.compileShader(vertexShader)
    if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)){
        console.error('Vertex shader compile error:', gl.getShaderInfoLog(vertexShader));
        return null;
    }
    gl.compileShader(fragmentShader)
    if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)){
        console.error('Fragment shader compile error:', gl.getShaderInfoLog(fragmentShader));
        return null;
    }
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
        console.error('Shader program link error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

function initAttributeVariable(gl, a_attribute, buffer){
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(a_attribute, buffer.num, buffer.type, false, 0, 0);
    gl.enableVertexAttribArray(a_attribute);
}

function initArrayBufferForLaterUse(gl, data, num, type) {
    var buffer = gl.createBuffer();
    if (!buffer) {
      console.error('Failed to create the buffer object');
      return null;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    buffer.num = num;
    buffer.type = type;
    return buffer;
}

// Game logic functions
function spawnTrain() {
    const laneIndex = Math.floor(Math.random() * 3);
    trains.push(new Train(laneIndex));
}

// Function to spawn a coin
function spawnCoin() {
    // Choose a random lane
    const laneIndex = Math.floor(Math.random() * 3);
    
    // Choose a random position along the track (far from player)
    // Use exactly the same starting position as trains for consistency
    const zPosition = -LANE_LENGTH;
    
    // Create a new coin
    coins.push(new Coin(laneIndex, zPosition));
}

function checkCollision() {
    if (!player) return false;
    
    const playerBounds = player.getBounds();
    
    for (let train of trains) {
        const trainBounds = train.getBounds();
        
        // Quick lane check first (optimization)
        if (playerBounds.lane !== trainBounds.lane) continue;
        
        // Check for overlap in all dimensions
        if (playerBounds.maxX > trainBounds.minX && playerBounds.minX < trainBounds.maxX &&
            playerBounds.maxY > trainBounds.minY && playerBounds.minY < trainBounds.maxY &&
            playerBounds.maxZ > trainBounds.minZ && playerBounds.minZ < trainBounds.maxZ) {
            return true; // Collision detected
        }
    }
    
    return false;
}

// Function to check for coin collisions
function checkCoinCollision() {
    if (!player) return;
    
    const playerBounds = player.getBounds();
    
    for (let i = coins.length - 1; i >= 0; i--) {
        if (coins[i].collected) continue;
        
        const coinBounds = coins[i].getBounds();
        
        // Quick lane check first (optimization)
        if (playerBounds.lane !== coinBounds.lane) continue;
        
        // Check for overlap in all dimensions
        if (playerBounds.maxX > coinBounds.minX && playerBounds.minX < coinBounds.maxX &&
            playerBounds.maxY > coinBounds.minY && playerBounds.minY < coinBounds.maxY &&
            playerBounds.maxZ > coinBounds.minZ && playerBounds.minZ < coinBounds.maxZ) {
            
            // Collect the coin
            coins[i].collected = true;
            coinCount++;
            
            // Update UI
            updateScoreUI();
            
            // Remove the coin
            coins.splice(i, 1);
        }
    }
}

// Function to update score UI
function updateScoreUI() {
    if (scoreDiv) {
        scoreDiv.textContent = `分數: ${score}`;
    }
    if (coinCountDiv) {
        coinCountDiv.textContent = `金幣: ${coinCount}`;
    }
}

function initGame() {
    score = 0;
    coinCount = 0;
    trains = [];
    coins = [];
    lastTrainSpawnTime = 0;
    lastCoinSpawnTime = 0;
    trainSpawnInterval = 2.0;
    
    // Create lanes
    lanes = [];
    for (let i = 0; i < 3; i++) {
        lanes.push(new Lane(LANE_POSITIONS[i]));
    }
    
    // Create player in the middle lane
    player = new Player(1);
    
    // Update UI
    updateScoreUI();
    
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    lastTimestamp = 0;
    tick(0); // Start the game loop
}

function startGame() {
    gameState = 'playing';
    startScreenDiv.style.display = 'none';
    gameOverScreenDiv.style.display = 'none';
    canvas.style.display = 'block';
    initGame();
}

function gameOver() {
    gameState = 'gameOverScreen';
    gameOverScreenDiv.style.display = 'block';
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// Main function (entry point from HTML)
function main() {
    // Get UI elements
    canvas = document.getElementById('webgl');
    startScreenDiv = document.getElementById('startScreen');
    gameOverScreenDiv = document.getElementById('gameOverScreen');
    startButton = document.getElementById('startButton');
    restartButton = document.getElementById('restartButton');
    scoreDiv = document.getElementById('score');
    coinCountDiv = document.getElementById('coinCount');
    
    if (!canvas) {
        console.error('Failed to retrieve the <canvas> element');
        return;
    }
    
    // Initialize WebGL context
    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
        console.error('Failed to get the rendering context for WebGL');
        return;
    }
    
    // Enable depth test
    gl.enable(gl.DEPTH_TEST);
    
    // Compile shaders and create program
    program = compileShader(gl, VSHADER_SOURCE, FSHADER_SOURCE);
    if (!program) {
        console.error('Failed to compile or link shaders.');
        return;
    }
    gl.useProgram(program);
    
    // Get attribute and uniform locations
    program.a_Position = gl.getAttribLocation(program, 'a_Position');
    program.a_Color = gl.getAttribLocation(program, 'a_Color');
    program.u_ModelMatrix = gl.getUniformLocation(program, 'u_ModelMatrix');
    program.u_ViewMatrix = gl.getUniformLocation(program, 'u_ViewMatrix');
    program.u_ProjMatrix = gl.getUniformLocation(program, 'u_ProjMatrix');
    
    if (program.a_Position < 0 || program.a_Color < 0 || 
        !program.u_ModelMatrix || !program.u_ViewMatrix || !program.u_ProjMatrix) {
        console.error('Failed to get the storage location of attribute or uniform variable');
        return;
    }
    
    // Set up perspective projection matrix
    projMatrix.setPerspective(45, canvas.width / canvas.height, 0.1, 100.0);
    gl.uniformMatrix4fv(program.u_ProjMatrix, false, projMatrix.elements);
    
    // Set up view matrix - position camera to see both the lanes and player clearly
    viewMatrix.setLookAt(
        0, 10, 5,    // Eye position (elevated and slightly behind the player)
        0, 0, -10,   // Look-at point (down the track)
        0, 1, 0      // Up direction
    );
    gl.uniformMatrix4fv(program.u_ViewMatrix, false, viewMatrix.elements);
    
    // Event listeners for UI
    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);
    
    // Keyboard input
    document.addEventListener('keydown', function(event) {
        if (gameState !== 'playing' || !player) return;
        if (event.key === 'ArrowLeft') {
            player.move('left');
        }
        if (event.key === 'ArrowRight') {
            player.move('right');
        }
    });
    
    // Initial clear
    gl.clearColor(0.2, 0.2, 0.2, 1.0); // Dark grey background
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

function tick(timestamp) {
    if (gameState !== 'playing') {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        return;
    }
    
    animationFrameId = requestAnimationFrame(tick);
    
    // Calculate delta time for smooth animation
    const deltaTime = timestamp && lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0.016; // in seconds
    lastTimestamp = timestamp;
    
    // Clear the canvas
    gl.clearColor(0.6, 0.8, 1.0, 1.0); // Sky blue background
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // Draw lanes
    for (let lane of lanes) {
        lane.draw();
    }
    
    // Spawn trains
    if (timestamp - lastTrainSpawnTime > trainSpawnInterval * 1000) {
        spawnTrain();
        lastTrainSpawnTime = timestamp;
        if (trainSpawnInterval > 0.5) { // Max spawn rate
            trainSpawnInterval -= 0.05;
        }
    }
    
    // Spawn coins
    if (timestamp - lastCoinSpawnTime > coinSpawnInterval * 1000) {
        spawnCoin();
        lastCoinSpawnTime = timestamp;
    }
    
    // Update and draw coins
    for (let i = coins.length - 1; i >= 0; i--) {
        coins[i].update(deltaTime);
        coins[i].draw();
        
        // Remove coins that have passed the player
        if (coins[i].z > 5) {
            coins.splice(i, 1);
        }
    }
    
    // Update and draw trains
    for (let i = trains.length - 1; i >= 0; i--) {
        trains[i].update(deltaTime);
        trains[i].draw();
        
        // Remove trains that have passed the player
        if (trains[i].z > 5) {
            trains.splice(i, 1);
            score++;
            updateScoreUI();
        }
    }
    
    // Draw player
    if (player) {
        player.draw();
    }
    
    // Check for coin collisions
    checkCoinCollision();
    
    // Check for train collisions
    if (checkCollision()) {
        gameOver();
        return;
    }
}
