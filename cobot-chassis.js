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
  const cornerRadius = 12.0; 

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

  // 2. INNER CUTOUTS
  const innerMainBase = roundedRectangle({ size: [overallWidth - wallThickness * 2, overallDepth - wallThickness * 2], roundRadius: cornerRadius - 1, segments: 32 });
  const innerMain = translate([0, 0, bottomHeight + wallThickness], extrudeLinear({height: mainHeight + 10}, innerMainBase));
  
  const innerBottomWidth = 80.0 - (wallThickness * 2); 
  const innerBottomDepth = 128.0 - (wallThickness * 2); 
  // Floor ends up exactly 2.0mm thick (Z=0 to Z=2)
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
  parts.pos("SensorLeft", [-12.75, -80.00, 60.00]);
  parts.rot("SensorLeft", [0.00, 0.00, 0.00]);
  parts.scale("SensorLeft", [1.00, 1.00, 1.00]);

  parts.addHole("CobotChassis", "SensorRight", sensorCylinder);
  parts.pos("SensorRight", [12.75, -80.00, 60.00]);
  parts.rot("SensorRight", [0.00, 0.00, 0.00]);
  parts.scale("SensorRight", [1.00, 1.00, 1.00]);

  // 5. SIDE-WALL MG90S SERVOS (Flush to Z=2.0 inner floor)
  const servoShape = sg90Cutout();

  parts.addHole("CobotChassis", "ServoFL", servoShape);
  parts.pos("ServoFL", [-32.50, -45.00, 8.25]);
  parts.rot("ServoFL", [0.00, 0.00, 0.00]);
  parts.scale("ServoFL", [1.00, 1.00, 1.00]);

  parts.addHole("CobotChassis", "ServoRL", servoShape);
  parts.pos("ServoRL", [-32.50, 45.00, 8.25]);
  parts.rot("ServoRL", [0.00, 0.00, 0.00]);
  parts.scale("ServoRL", [1.00, 1.00, 1.00]);

  parts.addHole("CobotChassis", "ServoFR", servoShape);
  parts.pos("ServoFR", [32.50, -45.00, 8.25]);
  parts.rot("ServoFR", [0.00, 0.00, 0.00]);
  parts.scale("ServoFR", [1.00, 1.00, 1.00]);

  parts.addHole("CobotChassis", "ServoRR", servoShape);
  parts.pos("ServoRR", [32.50, 45.00, 8.25]);
  parts.rot("ServoRR", [0.00, 0.00, 0.00]);
  parts.scale("ServoRR", [1.00, 1.00, 1.00]);

  // 6. BACK WALL CUTOUTS (Speaker, Switch, USB-C Charge Port)
  parts.addHole("CobotChassis", "SpeakerBack", speakerCutout());
  parts.pos("SpeakerBack", [0.00, 80.00, 60.00]);
  parts.rot("SpeakerBack", [0.00, 0.00, 0.00]);
  parts.scale("SpeakerBack", [1.00, 1.00, 1.00]);

  // Left Side: 7mm Circular Hole for Magnetic USB-C Cable (Radius = 3.5mm)
  const chargePort = rotateX(Math.PI / 2, cylinder({radius: 3.5, height: 20.0, segments: 32}));
  parts.addHole("CobotChassis", "ChargePort", chargePort);
  parts.pos("ChargePort", [-35.00, 80.00, 60.00]); // Mirrored symmetrically to the power switch
  parts.rot("ChargePort", [0.00, 0.00, 0.00]);
  parts.scale("ChargePort", [1.00, 1.00, 1.00]);

  // Right Side: Snap-Fit Power Switch (8.4 x 8.4mm hole)
  parts.addHole("CobotChassis", "SwitchBack", cuboid({size: [8.4, 20.0, 8.4]}));
  parts.pos("SwitchBack", [35.00, 80.00, 60.00]); 
  parts.rot("SwitchBack", [0.00, 0.00, 0.00]);
  parts.scale("SwitchBack", [1.00, 1.00, 1.00]);

  return parts.render();
}

// Custom Macro Cuts 
function hcSr04Cutout() { 
    return union(
        translate([-13, 0, 0], cylinder({radius: 8, height: 20})),
        translate([13, 0, 0], cylinder({radius: 8, height: 20}))
    ); 
}

function sg90Cutout() {
    const slot = cuboid({size: [20.0, 23.2, 12.5]});
    const screwRadius = 1.0;
    const screw = rotateY(Math.PI / 2, cylinder({radius: screwRadius, height: 25.0, segments: 32}));
    const screw1 = translate([0, 14.15, 0], screw);
    const screw2 = translate([0, -14.15, 0], screw);
    
    return union(slot, screw1, screw2);
}

function speakerCutout() {
    // 2831 Speaker Specs: Body 27.1mm x 27.1mm
    // Hole sized slightly larger for tolerance (27.5mm)
    const size = 27.5; 
    const depth = 20.0;
    const mainBox = cuboid({size: [size, size, depth]});
    
    // We subtract cylinders from the corners of this cut-block.
    // This LEAVES plastic in the corners of the chassis wall for mounting tabs.
    const cutRadius = 4.5;
    const cutCyl = cylinder({radius: cutRadius, height: depth + 2, segments: 32});
    
    const offset = size / 2; // 13.75mm offset
    const tl = translate([-offset, offset, 0], cutCyl);
    const tr = translate([offset, offset, 0], cutCyl);
    const bl = translate([-offset, -offset, 0], cutCyl);
    const br = translate([offset, -offset, 0], cutCyl);
    
    let shape = subtract(mainBox, tl, tr, bl, br);
    
    // Now we ADD small M2 screw-hole cylinders to those exact corners.
    // This will drill a 2mm diameter hole into the mounting tabs we just preserved.
    const screwRadius = 1.0; // 2mm diameter for M2 screws
    const screwCyl = cylinder({radius: screwRadius, height: depth + 4, segments: 16});
    
    // Diagram strictly defines center-to-center screw spacing as 23mm (11.5mm offset).
    const screwOffset = 11.5;
    const stl = translate([-screwOffset, screwOffset, 0], screwCyl);
    const str = translate([screwOffset, screwOffset, 0], screwCyl);
    const sbl = translate([-screwOffset, -screwOffset, 0], screwCyl);
    const sbr = translate([screwOffset, -screwOffset, 0], screwCyl);
    
    shape = union(shape, stl, str, sbl, sbr);
    
    return rotateX(Math.PI / 2, shape);
}