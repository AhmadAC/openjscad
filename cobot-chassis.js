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
  
  const outerBottom = translate([0, 0, bottomHeight / 2], cuboid({size: [40, 64, bottomHeight]}));
  let solid = union(outerMain, outerBottom);

  const chSize = 11.31; 
  const leftChamfer = translate([-20, 0, bottomHeight], rotateY(Math.PI / 4, cuboid({ size: [chSize, 64, chSize] })));
  const rightChamfer = translate([20, 0, bottomHeight], rotateY(-Math.PI / 4, cuboid({ size: [chSize, 64, chSize] })));
  const frontChamfer = translate([0, -32, bottomHeight], rotateX(Math.PI / 4, cuboid({ size: [40, chSize, chSize] })));
  const backChamfer = translate([0, 32, bottomHeight], rotateX(-Math.PI / 4, cuboid({ size: [40, chSize, chSize] })));
  solid = union(solid, leftChamfer, rightChamfer, frontChamfer, backChamfer);

  // 2. INNER CUTOUTS
  const innerMainBase = roundedRectangle({ size: [overallWidth - wallThickness * 2, overallDepth - wallThickness * 2], roundRadius: cornerRadius - 1, segments: 32 });
  const innerMain = translate([0, 0, bottomHeight + wallThickness], extrudeLinear({height: mainHeight + 10}, innerMainBase));
  
  const innerBottomWidth = 40.0 - (wallThickness * 2); 
  const innerBottomDepth = 64.0 - (wallThickness * 2); 
  const innerBottom = translate([0, 0, (bottomHeight + 10) / 2 + 2], cuboid({size: [innerBottomWidth, innerBottomDepth, bottomHeight + 10]}));
  
  let hollow = union(innerMain, innerBottom);
  solid = subtract(solid, hollow);

  // 3. MAIN CHASSIS ASSEMBLY
  parts.add("CobotChassis", solid);
  parts.pos("CobotChassis", [0.00, 0.00, 0.00]);
  parts.rot("CobotChassis", [0.00, 0.00, 0.00]);
  parts.scale("CobotChassis", [1.00, 1.00, 1.00]);

  // 4. HC-SR04 FRONT FACE HOLES
  const holeRadius = 8.2;
  const sensorCylinder = rotateX(Math.PI / 2, cylinder({radius: holeRadius, height: 20, segments: 32}));
  
  parts.addHole("CobotChassis", "SensorLeft", sensorCylinder);
  parts.pos("SensorLeft", [-12.75, -40.00, 30.00]);
  parts.rot("SensorLeft", [0.00, 0.00, 0.00]);
  parts.scale("SensorLeft", [1.00, 1.00, 1.00]);

  parts.addHole("CobotChassis", "SensorRight", sensorCylinder);
  parts.pos("SensorRight", [12.75, -40.00, 30.00]);
  parts.rot("SensorRight", [0.00, 0.00, 0.00]);
  parts.scale("SensorRight", [1.00, 1.00, 1.00]);

  // 5. SIDE-WALL MG90S SERVOS
  const servoShape = sg90Cutout();

  parts.addHole("CobotChassis", "ServoFL", servoShape);
  parts.pos("ServoFL", [-12.50, -16.00, 8.00]);
  parts.rot("ServoFL", [0.00, 0.00, 0.00]);
  parts.scale("ServoFL", [1.00, 1.00, 1.00]);

  parts.addHole("CobotChassis", "ServoRL", servoShape);
  parts.pos("ServoRL", [-12.50, 16.00, 8.00]);
  parts.rot("ServoRL", [0.00, 0.00, 0.00]);
  parts.scale("ServoRL", [1.00, 1.00, 1.00]);

  parts.addHole("CobotChassis", "ServoFR", servoShape);
  parts.pos("ServoFR", [12.50, -16.00, 8.00]);
  parts.rot("ServoFR", [0.00, 0.00, 0.00]);
  parts.scale("ServoFR", [1.00, 1.00, 1.00]);

  parts.addHole("CobotChassis", "ServoRR", servoShape);
  parts.pos("ServoRR", [12.50, 16.00, 8.00]);
  parts.rot("ServoRR", [0.00, 0.00, 0.00]);
  parts.scale("ServoRR", [1.00, 1.00, 1.00]);

  // 6. BACK WALL CUTOUTS (Speaker + Snap-Fit Switch)
  // Look here! We added the meta attributes to tell the render to add the corner label.
  parts.addHole("CobotChassis", "SpeakerBack", speakerCutout(), { type: 'speaker', cornerR: 4.0 });
  parts.pos("SpeakerBack", [0.00, 40.00, 32.00]);
  parts.rot("SpeakerBack", [0.00, 0.00, 0.00]);
  parts.scale("SpeakerBack", [1.00, 1.00, 1.00]);

  parts.addHole("CobotChassis", "SwitchBack", cuboid({size: [8.4, 15.0, 8.4]}));
  parts.pos("SwitchBack", [24.00, 40.00, 32.00]);
  parts.rot("SwitchBack", [0.00, 0.00, 0.00]);
  parts.scale("SwitchBack", [1.00, 1.00, 1.00]);

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
    const slot = cuboid({size: [15.0, 24.23, 12.5]});
    const screwRadius = 1.95 / 2;
    const screw = rotateY(Math.PI / 2, cylinder({radius: screwRadius, height: 25.0, segments: 32}));
    const zOffset = -1.95; 
    const screw1 = translate([0, 14.15, zOffset], screw);
    const screw2 = translate([0, -14.15, zOffset], screw);
    return union(slot, screw1, screw2);
}

function speakerCutout() {
    // Exact sizing for Enclosed Speaker (e.g. 3W 4Ohm cavity speakers)
    const size = 28.0; 
    const depth = 20.0;
    
    // Main Square Block
    const mainBox = cuboid({size: [size, size, depth]});
    
    // Circular corners mapped to clear the screw-hole mounting tabs
    const cutRadius = 4.0;
    const cutCyl = cylinder({radius: cutRadius, height: depth + 2, segments: 32});
    
    const offset = size / 2;
    const tl = translate([-offset, offset, 0], cutCyl);
    const tr = translate([offset, offset, 0], cutCyl);
    const bl = translate([-offset, -offset, 0], cutCyl);
    const br = translate([offset, -offset, 0], cutCyl);
    
    // Subtract the cylinders to create the concave corners on the main shape
    const shape = subtract(mainBox, tl, tr, bl, br);
    
    // Rotate so it faces perfectly outward along the Y axis
    return rotateX(Math.PI / 2, shape);
}