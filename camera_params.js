const CAMERA_MODE = {
    THIRD_PERSON: 'thirdPerson',
    FIRST_PERSON: 'firstPerson'
};

const THIRD_PERSON_CAMERA = {
    eyeX: 0,
    eyeY: 10,
    eyeZ: 5,
    lookAtX: 0,
    lookAtY: 0,
    lookAtZ: -10,
    upX: 0,
    upY: 1,
    upZ: 0
};

const FIRST_PERSON_CAMERA = {
    offsetX: 0,
    offsetY: 0.8, 
    offsetZ: -0.5,  
    lookAtOffsetX: 0,
    lookAtOffsetY: 0.5,
    lookAtOffsetZ: -5, 
    upX: 0,
    upY: 1,
    upZ: 0
};

const PROJECTION_PARAMS = {
    fovy: 45,      
    near: 0.1,     
    far: 100.0     
};