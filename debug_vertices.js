function debugRobotVertices() {
    const robot = createRobot(PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_DEPTH);
    
    const headVertexCount = 24; 
    const bodyVertexCount = 24;
    const leftArmVertexCount = 24;
    const rightArmVertexCount = 24;
    const leftLegVertexCount = 24;
    const rightLegVertexCount = 24;
    
    const headVertexRange = [0, headVertexCount - 1];
    const bodyVertexRange = [headVertexCount, headVertexCount + bodyVertexCount - 1];
    const leftArmVertexRange = [bodyVertexRange[1] + 1, bodyVertexRange[1] + leftArmVertexCount];
    const rightArmVertexRange = [leftArmVertexRange[1] + 1, leftArmVertexRange[1] + rightArmVertexCount];
    const leftLegVertexRange = [rightArmVertexRange[1] + 1, rightArmVertexRange[1] + leftLegVertexCount];
    const rightLegVertexRange = [leftLegVertexRange[1] + 1, leftLegVertexRange[1] + rightLegVertexCount];
    
    console.log("Robot Vertex Ranges:");
    console.log(`Head: ${headVertexRange[0]} - ${headVertexRange[1]}`);
    console.log(`Body: ${bodyVertexRange[0]} - ${bodyVertexRange[1]}`);
    console.log(`Left Arm: ${leftArmVertexRange[0]} - ${leftArmVertexRange[1]}`);
    console.log(`Right Arm: ${rightArmVertexRange[0]} - ${rightArmVertexRange[1]}`);
    console.log(`Left Leg: ${leftLegVertexRange[0]} - ${leftLegVertexRange[1]}`);
    console.log(`Right Leg: ${rightLegVertexRange[0]} - ${rightLegVertexRange[1]}`);
    
    return {
        head: headVertexRange,
        body: bodyVertexRange,
        leftArm: leftArmVertexRange,
        rightArm: rightArmVertexRange,
        leftLeg: leftLegVertexRange,
        rightLeg: rightLegVertexRange
    };
}
