let skyboxProgram;
let skybox;
let laneTextureOffset = 0.0;
const laneScrollSpeed = -0.005;
let bgm, coinSound, deathSound;

// 繪製物體的反射
function drawReflection(object, reflectionAlpha = 0.3) {
    // 保存當前的混合模式和深度測試狀態
    const blendEnabled = gl.isEnabled(gl.BLEND);
    const depthTestEnabled = gl.isEnabled(gl.DEPTH_TEST);
    const currentBlendSrcFunc = gl.getParameter(gl.BLEND_SRC_RGB);
    const currentBlendDstFunc = gl.getParameter(gl.BLEND_DST_RGB);
    
    // 啟用混合模式，使反射半透明
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // 創建反射的模型矩陣
    const reflectionMatrix = new Matrix4();
    
    // 1. 平移到物體位置
    reflectionMatrix.setTranslate(object.x, 0, object.z);
    
    // 2. 在Y軸上進行鏡像反射（Y座標取負值）
    reflectionMatrix.scale(1.0, -1.0, 1.0);
    
    // 3. 稍微提高一點點，避免z-fighting
    reflectionMatrix.translate(0, -0.01, 0);
    
    // 4. 如果物體有旋轉（如金幣），也要套用
    if (object instanceof Coin) {
        reflectionMatrix.rotate(object.rotationY, 0, 1, 0);
    }
    
    // 設置反射的模型矩陣
    gl.uniformMatrix4fv(program.u_ModelMatrix, false, reflectionMatrix.elements);
    
    // 創建一個半透明的顏色緩衝區
    const reflectionColors = new Float32Array(object.colorBuffer.num * 4 * 24); // 假設每個物體最多有24個頂點
    
    // 針對不同物體設定不同的反射顏色
    let colorValue = 0.5; // 預設反射顏色值
    
    // 如果是玩家(Player)，使用更暗的顏色以去除白色區塊
    if (object instanceof Player) {
    colorValue = 0.08; // 更黑
    reflectionAlpha = 0.01; // 更透明
    reflectionMatrix.scale(0.8, -0.3, 0.8); 
}
    
    for (let i = 0; i < reflectionColors.length; i += 4) {
        reflectionColors[i] = colorValue;     // R - 減弱的顏色
        reflectionColors[i+1] = colorValue;   // G - 減弱的顏色
        reflectionColors[i+2] = colorValue;   // B - 減弱的顏色
        reflectionColors[i+3] = reflectionAlpha;  // A - 半透明
    }
    
    // 創建反射的顏色緩衝區
    const reflectionColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, reflectionColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, reflectionColors, gl.STATIC_DRAW);
    reflectionColorBuffer.num = object.colorBuffer.num;
    reflectionColorBuffer.type = object.colorBuffer.type;
    
    // 設置頂點和顏色屬性
    initAttributeVariable(gl, program.a_Position, object.vertexBuffer);
    initAttributeVariable(gl, program.a_Color, reflectionColorBuffer);
    
    // 如果有法向量緩衝區，也要設置
    if (program.a_Normal !== -1 && object.normalBuffer) {
        initAttributeVariable(gl, program.a_Normal, object.normalBuffer);
    }
    
    // 關閉紋理
    if (program.u_UseTexture !== undefined && program.u_UseTexture !== -1) {
        gl.uniform1i(program.u_UseTexture, 0);
    }
    
    // 繪製反射
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, object.indexBuffer);
    gl.drawElements(gl.TRIANGLES, object.numIndices, gl.UNSIGNED_BYTE, 0);
    
    // 恢復原來的混合模式和深度測試狀態
    if (!blendEnabled) {
        gl.disable(gl.BLEND);
    } else {
        gl.blendFunc(currentBlendSrcFunc, currentBlendDstFunc);
    }
    
    // 清理
    gl.deleteBuffer(reflectionColorBuffer);
}

var VSHADER_SOURCE = `
    attribute vec4 a_Position;
    attribute vec4 a_Color;
    attribute vec3 a_Normal;
    attribute vec2 a_TexCoord;
    uniform mat4 u_ModelMatrix;
    uniform mat4 u_ViewMatrix;
    uniform mat4 u_ProjMatrix;
    uniform vec3 u_LightPosition;
    uniform vec3 u_ViewPosition;
    uniform float u_Ka;
    uniform float u_Kd;
    uniform float u_Ks;
    uniform float u_Shininess;
    varying vec4 v_Color;
    varying vec2 v_TexCoord;   
    varying float v_UseTexture;
    
    void main() {
        vec3 ambientLightColor = a_Color.rgb;
        vec3 diffuseLightColor = a_Color.rgb;
        vec3 specularLightColor = vec3(1.0, 1.0, 1.0); 

        gl_Position = u_ProjMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;
        vec3 ambient = ambientLightColor * u_Ka;
        
        vec3 positionInWorld = (u_ModelMatrix * a_Position).xyz;
        
        mat4 normalMatrix = mat4(
            vec4(u_ModelMatrix[0].xyz, 0.0),
            vec4(u_ModelMatrix[1].xyz, 0.0),
            vec4(u_ModelMatrix[2].xyz, 0.0),
            vec4(0.0, 0.0, 0.0, 1.0)
        );
        vec3 normal = normalize((normalMatrix * vec4(a_Normal, 0.0)).xyz);
        
        vec3 lightDirection = normalize(u_LightPosition - positionInWorld);
        
        float nDotL = max(dot(normal, lightDirection), 0.0);
        
        vec3 diffuse = diffuseLightColor * u_Kd * nDotL;

        vec3 specular = vec3(0.0, 0.0, 0.0);
        if(nDotL > 0.0) {
            vec3 R = reflect(-lightDirection, normal);
            // V: the vector, point to viewer       
            vec3 V = normalize(u_ViewPosition - positionInWorld); 
            float specAngle = clamp(dot(R, V), 0.0, 1.0);
            specular = u_Ks * pow(specAngle, u_Shininess) * specularLightColor; 
        }
        
        v_Color = vec4(ambient + diffuse + specular, 1.0);
        
        v_TexCoord = a_TexCoord;
        
        v_UseTexture = 1.0;
    }
`;

var FSHADER_SOURCE = `
    precision mediump float;
    uniform sampler2D u_Sampler;  
    uniform bool u_UseTexture;    
    varying vec4 v_Color;
    varying vec2 v_TexCoord;     
    varying float v_UseTexture; 
    uniform float u_TexOffset;
    
    void main() {
        if (u_UseTexture) {
            vec4 texColor = texture2D(u_Sampler, v_TexCoord + vec2(0.0, u_TexOffset));
            gl_FragColor = texColor * v_Color;
        } else {
            gl_FragColor = v_Color;
        }
    }
`;

var SKYBOX_VSHADER_SOURCE = `
    attribute vec4 a_Position;
    attribute vec2 a_TexCoord;
    uniform mat4 u_ViewMatrix;
    uniform mat4 u_ProjMatrix;
    varying vec2 v_TexCoord;
    
    void main() {
        mat4 viewMatrixWithoutTranslation = mat4(
            vec4(u_ViewMatrix[0].xyz, 0.0),
            vec4(u_ViewMatrix[1].xyz, 0.0),
            vec4(u_ViewMatrix[2].xyz, 0.0),
            vec4(0.0, 0.0, 0.0, 1.0)
        );
        
        gl_Position = u_ProjMatrix * viewMatrixWithoutTranslation * a_Position;
        
        gl_Position.z = gl_Position.w;
        
        v_TexCoord = a_TexCoord;
    }
`;

var SKYBOX_FSHADER_SOURCE = `
    precision mediump float;
    uniform sampler2D u_Sampler;
    varying vec2 v_TexCoord;
    
    void main() {
        gl_FragColor = texture2D(u_Sampler, v_TexCoord);
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
let cameraModeDiv; // UI element for camera mode display

// Camera state
let cameraMode = CAMERA_MODE.THIRD_PERSON;

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

function loadTextureForObject(gl, url, callback) {
    const texture = gl.createTexture();
    const image = new Image();
    
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        // 上下翻轉圖像
        //gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        gl.bindTexture(gl.TEXTURE_2D, null);
        
        console.log('紋理載入成功：' + url);
        
        if (callback) callback(texture);
    };
    
    image.onerror = function() {
        console.error('無法加載紋理：' + url);
        if (callback) callback(null);
    };
    
    image.src = url;
    
    return texture;
}

function createSkybox(size) {
    const vertices = new Float32Array([
        // 正面 (z正方向) - posz.jpg
        -size,  size, size,    // 左上
         size,  size, size,    // 右上
        -size, -size, size,    // 左下
         size, -size, size,    // 右下
        
        // 背面 (z負方向) - negz.jpg
         size,  size, -size,   // 右上
        -size,  size, -size,   // 左上
         size, -size, -size,   // 右下
        -size, -size, -size,   // 左下
        
        // 頂面 (y正方向) - posy.jpg
        -size, size,  size,    // 左前
         size, size,  size,    // 右前
        -size, size, -size,    // 左後
         size, size, -size,    // 右後
        
        // 底面 (y負方向) - negy.jpg
        -size, -size,  size,   // 左前
         size, -size,  size,   // 右前
        -size, -size, -size,   // 左後
         size, -size, -size,   // 右後
        
        // 右面 (x正方向) - posx.jpg
        size,  size,  size,    // 右上前
        size,  size, -size,    // 右上後
        size, -size,  size,    // 右下前
        size, -size, -size,    // 右下後
        
        // 左面 (x負方向) - negx.jpg
        -size,  size, -size,   // 左上後
        -size,  size,  size,   // 左上前
        -size, -size, -size,   // 左下後
        -size, -size,  size    // 左下前
    ]);
    
    const texCoords = new Float32Array([
        // 正面 (z正方向)
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        1.0, 1.0,
        
        // 背面 (z負方向)
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        1.0, 1.0,
        
        // 頂面 (y正方向)
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        1.0, 1.0,
        
        // 底面 (y負方向)
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        1.0, 1.0,
        
        // 右面 (x正方向)
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        1.0, 1.0,
        
        // 左面 (x負方向)
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        1.0, 1.0
    ]);
    
    const indices = new Uint8Array([
        0, 1, 2,    1, 3, 2,    // 正面
        4, 5, 6,    5, 7, 6,    // 背面
        8, 9, 10,   9, 11, 10,  // 頂面
        12, 13, 14, 13, 15, 14, // 底面
        16, 17, 18, 17, 19, 18, // 右面
        20, 21, 22, 21, 23, 22  // 左面
    ]);
    
    return {
        vertices: vertices,
        texCoords: texCoords,
        indices: indices
    };
}

function loadSkyboxTextures(gl, program) {
    const textures = {
        posx: gl.createTexture(),
        negx: gl.createTexture(),
        posy: gl.createTexture(),
        negy: gl.createTexture(),
        posz: gl.createTexture(),
        negz: gl.createTexture()
    };
    
    let loadedTextures = 0;
    
    function onTextureLoaded() {
        loadedTextures++;
        if (loadedTextures === 6) {
            console.log("所有天空盒紋理加載完成");
        }
    }
    
    loadTexture(gl, textures.posx, 'skybox/posx.jpg', onTextureLoaded);
    loadTexture(gl, textures.negx, 'skybox/negx.jpg', onTextureLoaded);
    loadTexture(gl, textures.posy, 'skybox/posy.jpg', onTextureLoaded);
    loadTexture(gl, textures.negy, 'skybox/negy.jpg', onTextureLoaded);
    loadTexture(gl, textures.posz, 'skybox/posz.jpg', onTextureLoaded);
    loadTexture(gl, textures.negz, 'skybox/negz.jpg', onTextureLoaded);
    
    return textures;
}

function loadTexture(gl, texture, url, callback) {
    const image = new Image();
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        // 上下翻轉圖像，因為WebGL的紋理座標系與圖像座標系不同
        //gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        
        gl.bindTexture(gl.TEXTURE_2D, null);
        
        if (callback) callback();
    };
    
    image.onerror = function() {
        console.error('無法加載紋理：' + url);
    };
    image.src = url;
}

class Skybox {
    constructor(gl, skyboxProgram, viewMatrix, projMatrix) {
        const skyboxSize = 20.0; 
        const skyboxGeometry = createSkybox(skyboxSize);
        
        this.vertexBuffer = initArrayBufferForLaterUse(gl, skyboxGeometry.vertices, 3, gl.FLOAT);
        this.texCoordBuffer = initArrayBufferForLaterUse(gl, skyboxGeometry.texCoords, 2, gl.FLOAT);
        
        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, skyboxGeometry.indices, gl.STATIC_DRAW);
        this.numIndices = skyboxGeometry.indices.length;
        
        this.textures = loadSkyboxTextures(gl, skyboxProgram);
        
        this.program = skyboxProgram;
        this.viewMatrix = viewMatrix;
        this.projMatrix = projMatrix;
    }
    
    draw(gl) {
        const currentProgram = gl.getParameter(gl.CURRENT_PROGRAM);
        const depthTestEnabled = gl.isEnabled(gl.DEPTH_TEST);
        
        gl.useProgram(this.program);
        
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'u_ViewMatrix'), false, this.viewMatrix.elements);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'u_ProjMatrix'), false, this.projMatrix.elements);
        
        initAttributeVariable(gl, gl.getAttribLocation(this.program, 'a_Position'), this.vertexBuffer);
        initAttributeVariable(gl, gl.getAttribLocation(this.program, 'a_TexCoord'), this.texCoordBuffer);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        
        gl.depthMask(false);
        
        const faceNames = ['posx', 'negx', 'posy', 'negy', 'posz', 'negz'];
        
        for (let i = 0; i < 6; i++) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.textures[faceNames[i]]);
            gl.uniform1i(gl.getUniformLocation(this.program, 'u_Sampler'), 0);
            
            const startIndex = i * 6; 
            gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_BYTE, startIndex);
        }
        
        gl.depthMask(true);
        
        if (depthTestEnabled) {
            gl.enable(gl.DEPTH_TEST);
        } else {
            gl.disable(gl.DEPTH_TEST);
        }
        gl.useProgram(currentProgram);
    }
}

function createCube(width, height, depth, r, g, b) {
    const w = width / 2, h = height / 2, d = depth / 2;

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

    const baseColor = [r, g, b];
    const colors = new Float32Array([
        // Front
        ...baseColor, 1.0, ...baseColor, 1.0, ...baseColor, 1.0, ...baseColor, 1.0,
        // Back
        ...baseColor.map(c => c * 0.8), 1.0, ...baseColor.map(c => c * 0.8), 1.0,
        ...baseColor.map(c => c * 0.8), 1.0, ...baseColor.map(c => c * 0.8), 1.0,
        // Top
        ...baseColor.map(c => Math.min(c * 1.2, 1.0)), 1.0, ...baseColor.map(c => Math.min(c * 1.2, 1.0)), 1.0,
        ...baseColor.map(c => Math.min(c * 1.2, 1.0)), 1.0, ...baseColor.map(c => Math.min(c * 1.2, 1.0)), 1.0,
        // Bottom
        ...baseColor.map(c => c * 0.7), 1.0, ...baseColor.map(c => c * 0.7), 1.0,
        ...baseColor.map(c => c * 0.7), 1.0, ...baseColor.map(c => c * 0.7), 1.0,
        // Right
        ...baseColor.map(c => Math.min(c * 1.1, 1.0)), 1.0, ...baseColor.map(c => Math.min(c * 1.1, 1.0)), 1.0,
        ...baseColor.map(c => Math.min(c * 1.1, 1.0)), 1.0, ...baseColor.map(c => Math.min(c * 1.1, 1.0)), 1.0,
        // Left
        ...baseColor.map(c => c * 0.9), 1.0, ...baseColor.map(c => c * 0.9), 1.0,
        ...baseColor.map(c => c * 0.9), 1.0, ...baseColor.map(c => c * 0.9), 1.0
    ]);

    const normals = new Float32Array([
        // Front face normals (0, 0, 1)
        0, 0, 1,   0, 0, 1,   0, 0, 1,   0, 0, 1,
        // Back face normals (0, 0, -1)
        0, 0, -1,  0, 0, -1,  0, 0, -1,  0, 0, -1,
        // Top face normals (0, 1, 0)
        0, 1, 0,   0, 1, 0,   0, 1, 0,   0, 1, 0,
        // Bottom face normals (0, -1, 0)
        0, -1, 0,  0, -1, 0,  0, -1, 0,  0, -1, 0,
        // Right face normals (1, 0, 0)
        1, 0, 0,   1, 0, 0,   1, 0, 0,   1, 0, 0,
        // Left face normals (-1, 0, 0)
        -1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0
    ]);

    const indices = new Uint8Array([
        0, 1, 2,   0, 2, 3,    // front
        4, 5, 6,   4, 6, 7,    // back
        8, 9, 10,  8, 10, 11,  // top
        12, 13, 14, 12, 14, 15, // bottom
        16, 17, 18, 16, 18, 19, // right
        20, 21, 22, 20, 22, 23  // left
    ]);

    return { vertices, colors, normals, indices };
}

// Create a robot model (for player)
function createRobot(width, height, depth) {
    // Robot dimensions
    const headSize = width * 0.7;
    const bodyWidth = width;
    const bodyHeight = height * 0.5;
    const bodyDepth = depth * 0.6;
    const limbWidth = width * 0.25;
    const limbHeight = height * 0.4;
    const limbDepth = depth * 0.25;
    
    // Colors - black with gray details
    const mainColor = [0.1, 0.1, 0.1]; // Black
    const detailColor = [0.3, 0.3, 0.3]; // Dark gray
    const jointColor = [0.5, 0.5, 0.5]; // Medium gray
    
    // Vertices array for all parts
    let vertices = [];
    let colors = [];
    let indices = [];
    let normals = [];
    let indexOffset = 0;
    
    // Head - a cube at the top
    const headY = bodyHeight + headSize/2;
    const headCube = createCube(headSize, headSize, headSize, mainColor[0], mainColor[1], mainColor[2]);
    
    // Adjust head position
    for (let i = 0; i < headCube.vertices.length; i += 3) {
        vertices.push(headCube.vertices[i], headCube.vertices[i+1] + headY, headCube.vertices[i+2]);
        normals.push(headCube.normals[i], headCube.normals[i+1], headCube.normals[i+2]);
    }
    colors.push(...headCube.colors);
    
    // Adjust indices for head
    for (let i = 0; i < headCube.indices.length; i++) {
        indices.push(headCube.indices[i] + indexOffset);
    }
    indexOffset += headCube.vertices.length / 3;
    
    // Body - a larger cube in the middle
    const bodyCube = createCube(bodyWidth, bodyHeight, bodyDepth, detailColor[0], detailColor[1], detailColor[2]);
    
    // Adjust body position
    for (let i = 0; i < bodyCube.vertices.length; i += 3) {
        vertices.push(bodyCube.vertices[i], bodyCube.vertices[i+1] + bodyHeight/2, bodyCube.vertices[i+2]);
        normals.push(bodyCube.normals[i], bodyCube.normals[i+1], bodyCube.normals[i+2]);
    }
    colors.push(...bodyCube.colors);
    
    // Adjust indices for body
    for (let i = 0; i < bodyCube.indices.length; i++) {
        indices.push(bodyCube.indices[i] + indexOffset);
    }
    indexOffset += bodyCube.vertices.length / 3;
    
    // Left arm
    const leftArmCube = createCube(limbWidth, limbHeight, limbDepth, mainColor[0], mainColor[1], mainColor[2]);
    const leftArmX = -(bodyWidth/2 + limbWidth/2);
    const leftArmY = bodyHeight - limbHeight/2;
    
    // Adjust left arm position
    for (let i = 0; i < leftArmCube.vertices.length; i += 3) {
        vertices.push(leftArmCube.vertices[i] + leftArmX, leftArmCube.vertices[i+1] + leftArmY, leftArmCube.vertices[i+2]);
        normals.push(leftArmCube.normals[i], leftArmCube.normals[i+1], leftArmCube.normals[i+2]);
    }
    colors.push(...leftArmCube.colors);
    
    // Adjust indices for left arm
    for (let i = 0; i < leftArmCube.indices.length; i++) {
        indices.push(leftArmCube.indices[i] + indexOffset);
    }
    indexOffset += leftArmCube.vertices.length / 3;
    
    // Right arm
    const rightArmCube = createCube(limbWidth, limbHeight, limbDepth, mainColor[0], mainColor[1], mainColor[2]);
    const rightArmX = bodyWidth/2 + limbWidth/2;
    const rightArmY = bodyHeight - limbHeight/2;
    
    // Adjust right arm position
    for (let i = 0; i < rightArmCube.vertices.length; i += 3) {
        vertices.push(rightArmCube.vertices[i] + rightArmX, rightArmCube.vertices[i+1] + rightArmY, rightArmCube.vertices[i+2]);
        normals.push(rightArmCube.normals[i], rightArmCube.normals[i+1], rightArmCube.normals[i+2]);
    }
    colors.push(...rightArmCube.colors);
    
    // Adjust indices for right arm
    for (let i = 0; i < rightArmCube.indices.length; i++) {
        indices.push(rightArmCube.indices[i] + indexOffset);
    }
    indexOffset += rightArmCube.vertices.length / 3;
    
    // Left leg
    const leftLegCube = createCube(limbWidth, limbHeight, limbDepth, mainColor[0], mainColor[1], mainColor[2]);
    const leftLegX = -bodyWidth/4;
    const leftLegY = -limbHeight/2;
    
    // Adjust left leg position
    for (let i = 0; i < leftLegCube.vertices.length; i += 3) {
        vertices.push(leftLegCube.vertices[i] + leftLegX, leftLegCube.vertices[i+1] + leftLegY, leftLegCube.vertices[i+2]);
        normals.push(leftLegCube.normals[i], leftLegCube.normals[i+1], leftLegCube.normals[i+2]);
    }
    colors.push(...leftLegCube.colors);
    
    // Adjust indices for left leg
    for (let i = 0; i < leftLegCube.indices.length; i++) {
        indices.push(leftLegCube.indices[i] + indexOffset);
    }
    indexOffset += leftLegCube.vertices.length / 3;
    
    // Right leg
    const rightLegCube = createCube(limbWidth, limbHeight, limbDepth, mainColor[0], mainColor[1], mainColor[2]);
    const rightLegX = bodyWidth/4;
    const rightLegY = -limbHeight/2;
    
    // Adjust right leg position
    for (let i = 0; i < rightLegCube.vertices.length; i += 3) {
        vertices.push(rightLegCube.vertices[i] + rightLegX, rightLegCube.vertices[i+1] + rightLegY, rightLegCube.vertices[i+2]);
        normals.push(rightLegCube.normals[i], rightLegCube.normals[i+1], rightLegCube.normals[i+2]);
    }
    colors.push(...rightLegCube.colors);
    
    // Adjust indices for right leg
    for (let i = 0; i < rightLegCube.indices.length; i++) {
        indices.push(rightLegCube.indices[i] + indexOffset);
    }
    
    return {
        vertices: new Float32Array(vertices),
        colors: new Float32Array(colors),
        normals: new Float32Array(normals),
        indices: new Uint8Array(indices)
    };
}

// Create a cylinder (for coins)
function createCylinder(radius, height, segments, r, g, b) {
    const vertices = [];
    const colors = [];
    const indices = [];
    const normals = [];
    
    // Create the vertices for top and bottom faces
    // Center of top face
    vertices.push(0, height/2, 0);
    colors.push(r, g, b, 1.0);
    normals.push(0, 1, 0); // 頂部中心點法向量指向上方
    
    // Center of bottom face
    vertices.push(0, -height/2, 0);
    colors.push(r, g, b, 1.0);
    normals.push(0, -1, 0); // 底部中心點法向量指向下方
    
    // Create vertices for the perimeter
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        
        // Top perimeter
        vertices.push(x, height/2, z);
        colors.push(r, g, b, 1.0);
        normals.push(0, 1, 0); // 頂部邊緣法向量指向上方
        
        // Bottom perimeter
        vertices.push(x, -height/2, z);
        colors.push(r * 0.8, g * 0.8, b * 0.8, 1.0); // Slightly darker for bottom
        normals.push(0, -1, 0); // 底部邊緣法向量指向下方
        
        // 側面法向量 - 指向外側
        const nx = Math.cos(angle);
        const nz = Math.sin(angle);
        
        // 為側面添加頂部和底部頂點（用於繪製側面）
        vertices.push(x, height/2, z);
        colors.push(r * 0.9, g * 0.9, b * 0.9, 1.0);
        normals.push(nx, 0, nz);
        
        vertices.push(x, -height/2, z);
        colors.push(r * 0.7, g * 0.7, b * 0.7, 1.0);
        normals.push(nx, 0, nz);
    }
    
    // Create indices for top face (like a fan)
    for (let i = 0; i < segments; i++) {
        indices.push(
            0, // Center of top face
            2 + i * 4, // Current top perimeter point
            2 + ((i + 1) % segments) * 4 // Next top perimeter point
        );
    }
    
    // Create indices for bottom face (like a fan)
    for (let i = 0; i < segments; i++) {
        indices.push(
            1, // Center of bottom face
            3 + ((i + 1) % segments) * 4, // Next bottom perimeter point (reversed order)
            3 + i * 4 // Current bottom perimeter point
        );
    }
    
    // Create indices for the side faces
    for (let i = 0; i < segments; i++) {
        const current = 4 + i * 4;
        const next = 4 + ((i + 1) % segments) * 4;
        
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
        normals: new Float32Array(normals),
        indices: new Uint8Array(indices)
    };
}

// Lane class (3D version)
class Lane {
    constructor(position, textureUrl) {
        console.log('[Lane] this:', this, 'textureUrl:', textureUrl);

        this.x = position;
        this.y = 0;
        this.z = -LANE_LENGTH / 2; // Center of the lane
        this.width = LANE_WIDTH;
        this.length = LANE_LENGTH;
        this.texture = null;
        this.hasTexture = false;
        
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
        
        const repeatX = 1.0;      
        const repeatZ = 5.0;  
        
        this.texCoords = new Float32Array([
            0.0, 0.0,              // 左下
            repeatX, 0.0,          // 右下
            0.0, repeatZ,          // 左上
            repeatX, repeatZ       // 右上
        ]);
        
        // Alternate lane colors for better visibility
        const laneColor = position === 0 ? 
            [0.5, 0.5, 0.5, 1.0] : // Middle lane: gray
            [0.4, 0.4, 0.4, 1.0];  // Side lanes: darker gray
        
        this.colors = new Float32Array([
            ...laneColor, ...laneColor, ...laneColor, ...laneColor
        ]);
        
        // 添加法向量 - 跑道面向上方
        this.normals = new Float32Array([
            0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0
        ]);
        
        this.vertexBuffer = initArrayBufferForLaterUse(gl, this.vertices, 3, gl.FLOAT);
        this.colorBuffer = initArrayBufferForLaterUse(gl, this.colors, 4, gl.FLOAT);
        this.normalBuffer = initArrayBufferForLaterUse(gl, this.normals, 3, gl.FLOAT);
        this.texCoordBuffer = initArrayBufferForLaterUse(gl, this.texCoords, 2, gl.FLOAT);
        
        if (textureUrl) {
            const self = this;
            this.texture = loadTextureForObject(gl, textureUrl, function(texture) {
                if (texture) {
                    self.hasTexture = true;
                    self.texture = texture;
                    console.log('Lane texture 載入完成');
                }
            });
        }
    }
    
    draw() {
        modelMatrix.setTranslate(this.x, this.y, this.z);
        gl.uniformMatrix4fv(program.u_ModelMatrix, false, modelMatrix.elements);
        gl.uniform1f(program.u_TexOffset, laneTextureOffset);
        
        initAttributeVariable(gl, program.a_Position, this.vertexBuffer);
        initAttributeVariable(gl, program.a_Color, this.colorBuffer);
        initAttributeVariable(gl, program.a_Normal, this.normalBuffer);
        
        if (program.a_TexCoord !== undefined && program.a_TexCoord !== -1) {
            initAttributeVariable(gl, program.a_TexCoord, this.texCoordBuffer);
            
            if (this.hasTexture && this.texture) {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, this.texture);
                console.log('BOUND TEX2D =', gl.getParameter(gl.TEXTURE_BINDING_2D));
                gl.uniform1i(program.u_Sampler, 0);
                gl.uniform1i(program.u_UseTexture, 1);
            } else {
                // 不使用紋理
                //console.log('No texture for lane, using color only');
                gl.uniform1i(program.u_UseTexture, 0);
            }
        }
        
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        
        if (program.u_UseTexture !== undefined && program.u_UseTexture !== -1) {
            gl.uniform1i(program.u_UseTexture, 0);
        }
        console.log(gl.getParameter(gl.ACTIVE_TEXTURE))
    }
}

// Player class (3D version with robot model and animation)
class Player {
    constructor(initialLane) {
        this.currentLane = initialLane; // 0, 1, or 2
        this.x = LANE_POSITIONS[this.currentLane];
        this.y = PLAYER_HEIGHT / 2; // Position player on the ground
        this.z = -2.0; // Fixed position on Z axis (closer to camera)
        
        // Animation properties
        this.runningTime = 0;
        this.runningSpeed = 5.0; // Animation speed
        this.legAngle = 0;
        this.armAngle = 0;
        this.isMoving = false;
        this.lastLane = initialLane;
        
        // Create a robot model for the player
        const robot = createRobot(PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_DEPTH);
        
        this.vertexBuffer = initArrayBufferForLaterUse(gl, robot.vertices, 3, gl.FLOAT);
        this.colorBuffer = initArrayBufferForLaterUse(gl, robot.colors, 4, gl.FLOAT);
        this.normalBuffer = initArrayBufferForLaterUse(gl, robot.normals, 3, gl.FLOAT);
        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, robot.indices, gl.STATIC_DRAW);
        this.numIndices = robot.indices.length;
        
        // Store original vertices for animation
        this.originalVertices = new Float32Array(robot.vertices);
        
        // Calculate vertex indices for each body part based on the createRobot function
        // Each cube has 24 vertices (4 vertices per face * 6 faces)
        const verticesPerCube = 24 * 3; // 24 vertices * 3 coordinates per vertex
        
        // Head vertices (first cube in the model)
        const headStart = 0;
        const headEnd = verticesPerCube;
        
        // Body vertices (second cube)
        const bodyStart = headEnd;
        const bodyEnd = bodyStart + verticesPerCube;
        
        // Left arm vertices (third cube)
        const leftArmStart = bodyEnd;
        const leftArmEnd = leftArmStart + verticesPerCube;
        
        // Right arm vertices (fourth cube)
        const rightArmStart = leftArmEnd;
        const rightArmEnd = rightArmStart + verticesPerCube;
        
        // Left leg vertices (fifth cube)
        const leftLegStart = rightArmEnd;
        const leftLegEnd = leftLegStart + verticesPerCube;
        
        // Right leg vertices (sixth cube)
        const rightLegStart = leftLegEnd;
        const rightLegEnd = rightLegStart + verticesPerCube;
        
        // Store indices for animation
        this.leftArmIndices = [];
        this.rightArmIndices = [];
        this.leftLegIndices = [];
        this.rightLegIndices = [];
        
        // Populate the indices arrays
        for (let i = leftArmStart; i < leftArmEnd; i += 3) {
            this.leftArmIndices.push(i);
        }
        
        for (let i = rightArmStart; i < rightArmEnd; i += 3) {
            this.rightArmIndices.push(i);
        }
        
        for (let i = leftLegStart; i < leftLegEnd; i += 3) {
            this.leftLegIndices.push(i);
        }
        
        for (let i = rightLegStart; i < rightLegEnd; i += 3) {
            this.rightLegIndices.push(i);
        }
        
        // Log the indices for debugging
        console.log("Left Arm Indices:", this.leftArmIndices.length);
        console.log("Right Arm Indices:", this.rightArmIndices.length);
        console.log("Left Leg Indices:", this.leftLegIndices.length);
        console.log("Right Leg Indices:", this.rightLegIndices.length);
    }
    
    move(direction) {
        if (gameState !== 'playing') return;
        
        this.lastLane = this.currentLane;
        
        if (direction === 'left' && this.currentLane > 0) {
            this.currentLane--;
            this.isMoving = true;
        }
        if (direction === 'right' && this.currentLane < 2) {
            this.currentLane++;
            this.isMoving = true;
        }
        this.x = LANE_POSITIONS[this.currentLane];
    }
    
    update(deltaTime) {
        // Update running animation
        this.runningTime += deltaTime;
        
        // Calculate leg angles for running animation
        this.legAngle = Math.sin(this.runningTime * this.runningSpeed) * 30; // 30 degrees max angle
        this.armAngle = -Math.sin(this.runningTime * this.runningSpeed) * 15; // 15 degrees max angle, opposite to legs
        
        // Update animation state
        if (this.lastLane !== this.currentLane) {
            this.isMoving = true;
        } else {
            this.isMoving = false;
        }
        this.lastLane = this.currentLane;
        
        // Apply animation to vertices
        this.animateLegs();
    }
    
    animateLegs() {
        // Create a new array for the animated vertices
        const animatedVertices = new Float32Array(this.originalVertices);
        
        // Apply rotation to left leg
        const leftLegAngle = this.legAngle;
        for (let i of this.leftLegIndices) {
            // Get the vertex position relative to the leg pivot point
            const x = this.originalVertices[i];
            const y = this.originalVertices[i+1];
            const z = this.originalVertices[i+2];
            
            // Apply rotation around X axis (for forward/backward movement)
            const rad = leftLegAngle * Math.PI / 180;
            const newY = y * Math.cos(rad) - z * Math.sin(rad);
            const newZ = y * Math.sin(rad) + z * Math.cos(rad);
            
            // Update the vertex position
            animatedVertices[i] = x;
            animatedVertices[i+1] = newY;
            animatedVertices[i+2] = newZ;
        }
        
        // Apply rotation to right leg (opposite angle)
        const rightLegAngle = -this.legAngle;
        for (let i of this.rightLegIndices) {
            // Get the vertex position relative to the leg pivot point
            const x = this.originalVertices[i];
            const y = this.originalVertices[i+1];
            const z = this.originalVertices[i+2];
            
            // Apply rotation around X axis (for forward/backward movement)
            const rad = rightLegAngle * Math.PI / 180;
            const newY = y * Math.cos(rad) - z * Math.sin(rad);
            const newZ = y * Math.sin(rad) + z * Math.cos(rad);
            
            // Update the vertex position
            animatedVertices[i] = x;
            animatedVertices[i+1] = newY;
            animatedVertices[i+2] = newZ;
        }
        
        // Apply rotation to left arm (synchronized with right leg)
        const leftArmAngle = rightLegAngle * 0.7; // Slightly less rotation than legs
        for (let i of this.leftArmIndices) {
            // Get the vertex position relative to the arm pivot point
            const x = this.originalVertices[i];
            const y = this.originalVertices[i+1];
            const z = this.originalVertices[i+2];
            
            // Apply rotation around X axis (for forward/backward movement)
            const rad = leftArmAngle * Math.PI / 180;
            const newY = y * Math.cos(rad) - z * Math.sin(rad);
            const newZ = y * Math.sin(rad) + z * Math.cos(rad);
            
            // Update the vertex position
            animatedVertices[i] = x;
            animatedVertices[i+1] = newY;
            animatedVertices[i+2] = newZ;
        }
        
        // Apply rotation to right arm (synchronized with left leg)
        const rightArmAngle = leftLegAngle * 0.7; // Slightly less rotation than legs
        for (let i of this.rightArmIndices) {
            // Get the vertex position relative to the arm pivot point
            const x = this.originalVertices[i];
            const y = this.originalVertices[i+1];
            const z = this.originalVertices[i+2];
            
            // Apply rotation around X axis (for forward/backward movement)
            const rad = rightArmAngle * Math.PI / 180;
            const newY = y * Math.cos(rad) - z * Math.sin(rad);
            const newZ = y * Math.sin(rad) + z * Math.cos(rad);
            
            // Update the vertex position
            animatedVertices[i] = x;
            animatedVertices[i+1] = newY;
            animatedVertices[i+2] = newZ;
        }
        
        // Update the vertex buffer with the animated vertices
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, animatedVertices, gl.DYNAMIC_DRAW);
    }
    
    draw() {
        modelMatrix.setTranslate(this.x, this.y, this.z);
        gl.uniformMatrix4fv(program.u_ModelMatrix, false, modelMatrix.elements);
        
        initAttributeVariable(gl, program.a_Position, this.vertexBuffer);
        initAttributeVariable(gl, program.a_Color, this.colorBuffer);
        initAttributeVariable(gl, program.a_Normal, this.normalBuffer);
        
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
        this.normalBuffer = initArrayBufferForLaterUse(gl, cube.normals, 3, gl.FLOAT);   // 新增
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
            coinSound.play();
            coinCount++;
            
            // Update UI
            updateUI();
            
            // Remove the coin
            coins.splice(i, 1);
        }
    }
}

// Function to update UI
function updateUI() {
    // Update score and coin count
    if (scoreDiv) {
        scoreDiv.textContent = `分數: ${score}`;
    }
    if (coinCountDiv) {
        coinCountDiv.textContent = `金幣: ${coinCount}`;
    }
    
    // Update camera mode display
    if (cameraModeDiv) {
        cameraModeDiv.textContent = `視角: ${cameraMode === CAMERA_MODE.FIRST_PERSON ? '第一人稱' : '第三人稱'}`;
    }
}

// Function to toggle camera mode
function toggleCameraMode() {
    cameraMode = cameraMode === CAMERA_MODE.THIRD_PERSON ? 
                 CAMERA_MODE.FIRST_PERSON : 
                 CAMERA_MODE.THIRD_PERSON;
    
    if (player) {
        if (cameraMode === CAMERA_MODE.FIRST_PERSON) {
            viewMatrix.setLookAt(
                player.x + FIRST_PERSON_CAMERA.offsetX,
                player.y + FIRST_PERSON_CAMERA.offsetY,
                player.z + FIRST_PERSON_CAMERA.offsetZ,
                player.x + FIRST_PERSON_CAMERA.lookAtOffsetX,
                player.y + FIRST_PERSON_CAMERA.lookAtOffsetY,
                player.z + FIRST_PERSON_CAMERA.lookAtOffsetZ,
                FIRST_PERSON_CAMERA.upX,
                FIRST_PERSON_CAMERA.upY,
                FIRST_PERSON_CAMERA.upZ
            );
        } else {
            viewMatrix.setLookAt(
                THIRD_PERSON_CAMERA.eyeX,
                THIRD_PERSON_CAMERA.eyeY,
                THIRD_PERSON_CAMERA.eyeZ,
                THIRD_PERSON_CAMERA.lookAtX,
                THIRD_PERSON_CAMERA.lookAtY,
                THIRD_PERSON_CAMERA.lookAtZ,
                THIRD_PERSON_CAMERA.upX,
                THIRD_PERSON_CAMERA.upY,
                THIRD_PERSON_CAMERA.upZ
            );
        }
        gl.uniformMatrix4fv(program.u_ViewMatrix, false, viewMatrix.elements);
    }
    
    updateUI();
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
    /*lanes = [];
    for (let i = 0; i < 3; i++) {
        lanes.push(new Lane(LANE_POSITIONS[i]));
    }*/
    
    // Create player in the middle lane
    player = new Player(1);
    
    // Update UI
    updateUI();
    
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    lastTimestamp = 0;
    tick(0); // Start the game loop
}

function startGame() {
    gameState = 'playing';
    bgm.play();
    startScreenDiv.style.display = 'none';
    gameOverScreenDiv.style.display = 'none';
    canvas.style.display = 'block';
    initGame();
}

function gameOver() {
    gameState = 'gameOverScreen';
    deathSound.play();
    bgm.pause();
    gameOverScreenDiv.style.display = 'block';
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// Main function (entry point from HTML)
function main() {
    // Get UI elements
    bgm = new Audio('music.mp3');
    bgm.loop = true;
    bgm.volume = 0.5;

    coinSound = new Audio('coin.mp3');
    coinSound.volume = 1.0;

    deathSound = new Audio('death.mp3');
    coinSound.volume = 1.0;

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

    skyboxProgram = compileShader(gl, SKYBOX_VSHADER_SOURCE, SKYBOX_FSHADER_SOURCE);
    if (!skyboxProgram) {
        console.error('Failed to compile or link skybox shaders.');
        return;
    }

    skybox = new Skybox(gl, skyboxProgram, viewMatrix, projMatrix);

    // Get attribute and uniform locations
    program.a_Position = gl.getAttribLocation(program, 'a_Position');
    program.a_Color = gl.getAttribLocation(program, 'a_Color');
    program.a_Normal = gl.getAttribLocation(program, 'a_Normal');
    program.u_ModelMatrix = gl.getUniformLocation(program, 'u_ModelMatrix');
    program.u_ViewMatrix = gl.getUniformLocation(program, 'u_ViewMatrix');
    program.u_ProjMatrix = gl.getUniformLocation(program, 'u_ProjMatrix');
    program.u_LightPosition = gl.getUniformLocation(program, 'u_LightPosition');
    program.u_ViewPosition = gl.getUniformLocation(program, 'u_ViewPosition');
    program.u_Ka = gl.getUniformLocation(program, 'u_Ka'); 
    program.u_Kd = gl.getUniformLocation(program, 'u_Kd');
    program.u_Ks = gl.getUniformLocation(program, 'u_Ks');
    program.u_Shininess = gl.getUniformLocation(program, 'u_Shininess');
    program.a_TexCoord = gl.getAttribLocation(program, 'a_TexCoord');
    program.u_Sampler = gl.getUniformLocation(program, 'u_Sampler');
    program.u_UseTexture = gl.getUniformLocation(program, 'u_UseTexture');
    program.u_TexOffset = gl.getUniformLocation(program, 'u_TexOffset');
    
    if (program.a_Position < 0 || program.a_Color < 0 || program.a_Normal < 0 ||
        !program.u_ModelMatrix || !program.u_ViewMatrix || !program.u_ProjMatrix) {
        console.error('Failed to get the storage location of attribute or uniform variable');
        return;
    }
    
    // Set up perspective projection matrix
    projMatrix.setPerspective(PROJECTION_PARAMS.fovy, canvas.width / canvas.height, PROJECTION_PARAMS.near, PROJECTION_PARAMS.far);
    gl.uniformMatrix4fv(program.u_ProjMatrix, false, projMatrix.elements);
    
    // Set initial camera mode to third person
    updateCameraView();
    
    // Function to update camera view based on current mode
    function updateCameraView() {
        if (cameraMode === CAMERA_MODE.THIRD_PERSON) {
            // Third person camera
            viewMatrix.setLookAt(
                THIRD_PERSON_CAMERA.eyeX, 
                THIRD_PERSON_CAMERA.eyeY, 
                THIRD_PERSON_CAMERA.eyeZ,
                THIRD_PERSON_CAMERA.lookAtX, 
                THIRD_PERSON_CAMERA.lookAtY, 
                THIRD_PERSON_CAMERA.lookAtZ,
                THIRD_PERSON_CAMERA.upX, 
                THIRD_PERSON_CAMERA.upY, 
                THIRD_PERSON_CAMERA.upZ
            );
        } else {
            // First person camera - will be updated in tick() based on player position
            // Initial setup just to have something valid
            viewMatrix.setLookAt(
                0, 2, 0,    // Will be overridden in tick()
                0, 2, -10,  // Will be overridden in tick()
                0, 1, 0     // Up direction
            );
        }
        gl.uniformMatrix4fv(program.u_ViewMatrix, false, viewMatrix.elements);
    }
    
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
        if (event.key === 'v' || event.key === 'V') {
            toggleCameraMode();
        }
    });
    
    // Initial clear
    gl.clearColor(0.2, 0.2, 0.2, 1.0); // Dark grey background
    const lightX = 0.0, lightY = 12.0, lightZ = 7.0;
    gl.uniform3f(program.u_LightPosition, lightX, lightY, lightZ);
    gl.uniform3f(program.u_ViewPosition, 0.0, 5.0, 5.0); // Camera position
    gl.uniform1f(program.u_Ka, 0.4);
    gl.uniform1f(program.u_Kd, 2.0);
    gl.uniform1f(program.u_Ks, 2.0);
    gl.uniform1f(program.u_Shininess, 128.0);
    lanes = [
        new Lane(LANE_POSITIONS[0], 'floor.png'),
        new Lane(LANE_POSITIONS[1], 'floor.png'),
        new Lane(LANE_POSITIONS[2], 'floor.png')
    ];
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

function tick(timestamp) {
    if (gameState !== 'playing') {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        return;
    }

    gl.clearColor(0.6, 0.8, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);

    skybox.draw(gl); 
    gl.depthMask(true);
    gl.depthFunc(gl.LESS);

    laneTextureOffset += laneScrollSpeed;
    if (laneTextureOffset > 1.0) laneTextureOffset -= 1.0;
    
    animationFrameId = requestAnimationFrame(tick);
    
    // Calculate delta time for smooth animation
    const deltaTime = timestamp && lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0.016; // in seconds
    lastTimestamp = timestamp;
    
    // Update camera view based on current mode
    if (player) {
        if (cameraMode === CAMERA_MODE.FIRST_PERSON) {
            // First person camera - position at player's head and look forward
            viewMatrix.setLookAt(
                player.x + FIRST_PERSON_CAMERA.offsetX,
                player.y + FIRST_PERSON_CAMERA.offsetY,
                player.z + FIRST_PERSON_CAMERA.offsetZ,
                player.x + FIRST_PERSON_CAMERA.lookAtOffsetX,
                player.y + FIRST_PERSON_CAMERA.lookAtOffsetY,
                player.z + FIRST_PERSON_CAMERA.lookAtOffsetZ,
                FIRST_PERSON_CAMERA.upX,
                FIRST_PERSON_CAMERA.upY,
                FIRST_PERSON_CAMERA.upZ
            );
        } else {
            // Third person camera - use fixed position
            viewMatrix.setLookAt(
                THIRD_PERSON_CAMERA.eyeX,
                THIRD_PERSON_CAMERA.eyeY,
                THIRD_PERSON_CAMERA.eyeZ,
                THIRD_PERSON_CAMERA.lookAtX,
                THIRD_PERSON_CAMERA.lookAtY,
                THIRD_PERSON_CAMERA.lookAtZ,
                THIRD_PERSON_CAMERA.upX,
                THIRD_PERSON_CAMERA.upY,
                THIRD_PERSON_CAMERA.upZ
            );
        }
        gl.uniformMatrix4fv(program.u_ViewMatrix, false, viewMatrix.elements);
    }
    
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
    
    // 先繪製所有物體的反射
    // 繪製coins的反射
    for (let i = coins.length - 1; i >= 0; i--) {
        if (coins[i].z > 5) continue; // 跳過已經超出視野的金幣
        drawReflection(coins[i], 0.5); // 金幣反射透明度較高
    }
    
    // 繪製trains的反射
    /*for (let i = trains.length - 1; i >= 0; i--) {
        if (trains[i].z > 5) continue; // 跳過已經超出視野的火車
        drawReflection(trains[i], 0.3);
    }*/
    
    // 繪製player的反射
    if (player) {
        drawReflection(player, 0.4); // 玩家反射透明度適中
    }
    
    // 更新和繪製coins
    for (let i = coins.length - 1; i >= 0; i--) {
        coins[i].update(deltaTime);
        coins[i].draw();
        
        // Remove coins that have passed the player
        if (coins[i].z > 5) {
            coins.splice(i, 1);
        }
    }
    
    // 更新和繪製trains
    for (let i = trains.length - 1; i >= 0; i--) {
        trains[i].update(deltaTime);
        trains[i].draw();
        
        // Remove trains that have passed the player
        if (trains[i].z > 5) {
            trains.splice(i, 1);
            score++;
            //updateScoreUI();
        }
    }
    
    // 更新和繪製player
    if (player) {
        player.update(deltaTime);
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
