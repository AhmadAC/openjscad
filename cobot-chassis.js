// OpenJSCAD Script - Cobot Chassis
const { booleans, colors, extrusions, primitives, transforms } = jscadModeling;
const { subtract, union } = booleans;
const { colorize } = colors;
const { extrudeLinear } = extrusions;
const { cuboid, cylinder, roundedRectangle } = primitives;
const { translate, rotateX, rotateY } = transforms;

function main(parts) {
  // --- DOUBLED CHASSIS DIMENSIONS ---
  const overallWidth = 160.0;
  const overallDepth = 160.0; 
  const totalHeight = 95.8;
  
  const bottomHeight = 32.0;
  const mainHeight = totalHeight - bottomHeight;
  const wallThickness = 2.0; 
  const cornerRadius = 12.0; // Scaled up to keep proportions

  // 1. OUTER SHELL
  const outerMainBase = roundedRectangle({ size: [overallWidth, overallDepth], roundRadius: cornerRadius, segments: 32 });
  const outerMain = translate([0, 0, bottomHeight], extrudeLinear({height: mainHeight}, outerMainBase));
  
  const outerBottom = translate([0, 0, bottomHeight / 2], cuboid({size: [80, 128, bottomHeight]}));
  let solid = union(outerMain, outerBottom);

  // Scaled 45-degree structural transition chamfers bridging the bottom base to the wider main body
  const chSize = 22.62; 
  const leftChamfer = translate([-40, 0, bottomHeight], rotateY(Math.PI / 4, cuboid({ size: [chSize, 128, chSize] })));
  const rightChamfer = translate([40, 0, bottomHeight], rotateY(-Math.PI / 4, cuboid({ size: [chSize, 128, chSize] })));
  const frontChamfer = translate([0, -64, bottomHeight], rotateX(Math.PI / 4, cuboid({ size: [80, chSize, chSize] })));
  const backChamfer = translate([0, 64, bottomHeight], rotateX(-Math.PI / 4, cuboid({ size: [80, chSize, chSize] })));
  solid = union(solid, leftChamfer, rightChamfer, frontChamfer, backChamfer);

  // 2. INNER CUTOUTS (Hollowing is left as baked CSG to form the shell)
  const innerMainBase = roundedRectangle({ size: [overallWidth - wallThickness * 2, overallDepth - wallThickness * 2], roundRadius: cornerRadius - 1, segments: 32 });
  const innerMain = translate([0, 0, bottomHeight + wallThickness], extrudeLinear({height: mainHeight + 10}, innerMainBase));
  
  const innerBottomWidth = 80.0 - (wallThickness * 2); 
  const innerBottomDepth = 128.0 - (wallThickness * 2); 
  const innerBottom = translate([0, 0, (bottomHeight + 10) / 2 + 2], cuboid({size: [innerBottomWidth, innerBottomDepth, bottomHeight + 10]}));
  
  let hollow = union(innerMain, innerBottom);
  solid = subtract(solid, hollow);

  // 3. MAIN CHASSIS ASSEMBLY
  parts.add("CobotChassis", solid);
  parts.pos("CobotChassis", [0.00, 0.00, 0.00]);
  parts.rot("CobotChassis", [0.00, 0.00, 0.00]);
  parts.scale("CobotChassis", [1.00, 1.00, 1.00]);

  // 4. HC-SR04 FRONT FACE HOLES (Kept Original Size, shifted to new Front Wall)
  const holeRadius = 8.2;
  const sensorCylinder = rotateX(Math.PI / 2, cylinder({radius: holeRadius, height: 20, segments: 32}));
  
  parts.addHole("CobotChassis", "SensorLeft", sensorCylinder);
  parts.pos("SensorLeft", [-12.75, -80.00, 60.00]);
  parts.rot("SensorLeft", [0.00, 0.00, 0.00]);
  parts.scale("SensorLeft", [1.00, 1.00, 1.00]);

  parts.addHole("CobotChassis", "SensorRight", sensorCylinder);
  parts.pos("SensorRight", [12.75, -80.00, 60.00]);
  parts.rot("SensorRight", [0.00, 0.00, 0.00]);
  parts.scale("SensorRight", [1.00, 1.00, 1.00]);

  // 5. SIDE-WALL MG90S SERVOS (Corrected dimensions, spread 90mm apart horizontally!)
  const servoShape = sg90Cutout();

  parts.addHole("CobotChassis", "ServoFL", servoShape);
  parts.pos("ServoFL", [-32.50, -45.00, 16.00]);
  parts.rot("ServoFL", [0.00, 0.00, 0.00]);
  parts.scale("ServoFL", [1.00, 1.00, 1.00]);

  parts.addHole("CobotChassis", "ServoRL", servoShape);
  parts.pos("ServoRL", [-32.50, 45.00, 16.00]);
  parts.rot("ServoRL", [0.00, 0.00, 0.00]);
  parts.scale("ServoRL", [1.00, 1.00, 1.00]);

  parts.addHole("CobotChassis", "ServoFR", servoShape);
  parts.pos("ServoFR", [32.50, -45.00, 16.00]);
  parts.rot("ServoFR", [0.00, 0.00, 0.00]);
  parts.scale("ServoFR", [1.00, 1.00, 1.00]);

  parts.addHole("CobotChassis", "ServoRR", servoShape);
  parts.pos("ServoRR", [32.50, 45.00, 16.00]);
  parts.rot("ServoRR", [0.00, 0.00, 0.00]);
  parts.scale("ServoRR", [1.00, 1.00, 1.00]);

  // 6. BACK WALL CUTOUTS (Speaker + Snap-Fit Switch shifted to new Back Wall)
  parts.addHole("CobotChassis", "SpeakerBack", speakerCutout(), { type: 'speaker', cornerR: 4.0 });
  parts.pos("SpeakerBack", [0.00, 80.00, 60.00]);
  parts.rot("SpeakerBack", [0.00, 0.00, 0.00]);
  parts.scale("SpeakerBack", [1.00, 1.00, 1.00]);

  // Strictly 8.4 x 8.4mm hole on the face, with a 20mm depth to cleanly cut the wall
  parts.addHole("CobotChassis", "SwitchBack", cuboid({size: [8.4, 20.0, 8.4]}));
  parts.pos("SwitchBack", [35.00, 80.00, 60.00]); // Shifted further right to clear the speaker
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
    // MG90S Specs from schematic: Body 22.8L x 12.1W
    // Added 0.4mm tolerance for easy 3D printing fit: 23.2 x 12.5
    // X is 20.0 to ensure a clean boolean cut through the chassis wall.
    const slot = cuboid({size: [20.0, 23.2, 12.5]});
    
    // Schematic shows Φ2.2 for the servo tabs. 
    // We use a 2.0mm diameter (1.0 radius) to allow M2 screws to thread securely into the plastic.
    const screwRadius = 1.0;
    const screw = rotateY(Math.PI / 2, cylinder({radius: screwRadius, height: 25.0, segments: 32}));
    
    // Center-to-center screw spacing is exactly 28.3mm (14.15mm offset from center)
    const screw1 = translate([0, 14.15, 0], screw);
    const screw2 = translate([0, -14.15, 0], screw);
    
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