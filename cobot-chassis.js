// OpenJSCAD Script - Cobot Chassis
const { booleans, colors, extrusions, primitives, transforms } = jscadModeling;
const { subtract, union } = booleans;
const { colorize } = colors;
const { extrudeLinear } = extrusions;
const { cuboid, cylinder, roundedRectangle } = primitives;
const { translate, rotateX, rotateY } = transforms;

function main(parts) {
  const overallWidth = 80.0;
  const overallDepth = 80.0; 
  const totalHeight = 47.9;
  
  const bottomHeight = 16.0;
  const mainHeight = totalHeight - bottomHeight;
  const wallThickness = 2.0;
  const cornerRadius = 6.0;

  // 1. OUTER SHELL
  const outerMainBase = roundedRectangle({ size: [overallWidth, overallDepth], roundRadius: cornerRadius, segments: 32 });
  const outerMain = translate([0, 0, bottomHeight], extrudeLinear({height: mainHeight}, outerMainBase));
  
  // Bottom undercarriage block: width 40, depth 64
  const outerBottom = translate([0, 0, bottomHeight / 2], cuboid({size: [40, 64, bottomHeight]}));
  let solid = union(outerMain, outerBottom);

  // Add 45-degree structural transition chamfers bridging the bottom base to the wider main body
  const chSize = 11.31; 
  const leftChamfer = translate([-20, 0, bottomHeight], rotateY(Math.PI / 4, cuboid({ size: [chSize, 64, chSize] })));
  const rightChamfer = translate([20, 0, bottomHeight], rotateY(-Math.PI / 4, cuboid({ size: [chSize, 64, chSize] })));
  const frontChamfer = translate([0, -32, bottomHeight], rotateX(Math.PI / 4, cuboid({ size: [40, chSize, chSize] })));
  const backChamfer = translate([0, 32, bottomHeight], rotateX(-Math.PI / 4, cuboid({ size: [40, chSize, chSize] })));
  solid = union(solid, leftChamfer, rightChamfer, frontChamfer, backChamfer);

  // 2. INNER CUTOUTS (Hollowing)
  const innerMainBase = roundedRectangle({ size: [overallWidth - wallThickness * 2, overallDepth - wallThickness * 2], roundRadius: cornerRadius - 1, segments: 32 });
  const innerMain = translate([0, 0, bottomHeight + wallThickness], extrudeLinear({height: mainHeight + 10}, innerMainBase));
  
  // Widened lower cavity. 
  const innerBottomWidth = 40.0 - (wallThickness * 2); 
  const innerBottomDepth = 64.0 - (wallThickness * 2); 
  const innerBottom = translate([0, 0, (bottomHeight + 10) / 2 + 2], cuboid({size: [innerBottomWidth, innerBottomDepth, bottomHeight + 10]}));
  
  let hollow = union(innerMain, innerBottom);
  solid = subtract(solid, hollow);

  // 3. HC-SR04 FRONT FACE HOLES
  const holeRadius = 8.2;
  const sensorLeft = translate([-12.75, -overallDepth / 2, bottomHeight + 14], rotateX(Math.PI / 2, cylinder({radius: holeRadius, height: 20, segments: 32})));
  const sensorRight = translate([12.75, -overallDepth / 2, bottomHeight + 14], rotateX(Math.PI / 2, cylinder({radius: holeRadius, height: 20, segments: 32})));
  solid = subtract(solid, sensorLeft, sensorRight);

  // 4. SUBTRACT 4x SIDE-WALL MG90S SERVOS
  const sg90_FL = translate([-12.50, -16.00, bottomHeight / 2], sg90Cutout());
  const sg90_RL = translate([-12.50, 16.00, bottomHeight / 2], sg90Cutout());
  const sg90_FR = translate([12.50, -16.00, bottomHeight / 2], sg90Cutout());
  const sg90_RR = translate([12.50, 16.00, bottomHeight / 2], sg90Cutout());
  solid = subtract(solid, sg90_FL, sg90_RL, sg90_FR, sg90_RR);

  // 5. BACK WALL CUTOUTS (Speaker + Snap-Fit Switch)
  // Height chosen to vertically center the 27.1mm speaker within the available upper space
  const backZCenter = 32.0; 
  
  // Speaker Cutout centered exactly where the USB-C was
  const speaker_Back = translate([0.00, 40.00, backZCenter], speakerCutout());
  
  // 8.4 x 8.4mm Snap fit Switch placed to the right side of the speaker
  const switch_Back = translate([24.00, 40.00, backZCenter], cuboid({size: [8.4, 15.0, 8.4]})); 
  
  solid = subtract(solid, speaker_Back, switch_Back);

  // 6. MAIN CHASSIS ASSEMBLY
  parts.add("CobotChassis", solid);
  parts.pos("CobotChassis", [0.00, 0.00, 0.00]);
  parts.rot("CobotChassis", [0.00, 0.00, 0.00]);
  parts.scale("CobotChassis", [1.00, 1.00, 1.00]);

  return parts.render();
}

// Sized Custom Macro Cuts (subtracted internally during script execution)
function hcSr04Cutout() { 
    return union(
        translate([-13, 0, 0], cylinder({radius: 8, height: 20})),
        translate([13, 0, 0], cylinder({radius: 8, height: 20}))
    ); 
}

function sg90Cutout() {
    // Exact Math implementation based on MG90S constraints:
    const slot = cuboid({size: [15.0, 24.23, 12.5]});
    
    // 1.95mm diameter cylinder for M2 Screws
    const screwRadius = 1.95 / 2;
    const screw = rotateY(Math.PI / 2, cylinder({radius: screwRadius, height: 25.0, segments: 32}));
    
    // Z-Offset required: MG90S mounting tabs are NOT centered vertically; they align with the spline.
    const zOffset = -1.95; 
    
    // Positioned exactly 28.3mm apart.
    const screw1 = translate([0, 14.15, zOffset], screw);
    const screw2 = translate([0, -14.15, zOffset], screw);
    
    return union(slot, screw1, screw2);
}

function speakerCutout() {
    // Main circular cutout for the speaker sound cone (22mm diameter for clearance)
    const soundHole = cylinder({radius: 11.0, height: 15.0, segments: 32});
    
    // Thread-in small holes for M2/M2.5 Screws in PLA (1.8mm diameter hole)
    const screwRadius = 0.9;
    const screw = cylinder({radius: screwRadius, height: 15.0, segments: 16});
    
    // 23mm spacing (center to center) means an 11.5mm offset in each quadrant
    const offset = 11.5; 
    const tl = translate([-offset, offset, 0], screw);
    const tr = translate([offset, offset, 0], screw);
    const bl = translate([-offset, -offset, 0], screw);
    const br = translate([offset, -offset, 0], screw);
    
    // Union the shape and rotate it so it faces through the Y axis (front/back of robot)
    return rotateX(Math.PI / 2, union(soundHole, tl, tr, bl, br));
}