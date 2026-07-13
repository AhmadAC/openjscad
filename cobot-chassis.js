// OpenJSCAD Script - Cobot Chassis & Lid
const { booleans, colors, extrusions, hulls, primitives, transforms } = jscadModeling;
const { intersect, subtract, union } = booleans;
const { hull } = hulls;
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
  // Applied ONLY to the front and back (Sides left flat for servo clearance)
  const chSize = 22.62; 
  const frontChamfer = translate([0, -64, bottomHeight], rotateX(Math.PI / 4, cuboid({ size: [80, chSize, chSize] })));
  const backChamfer = translate([0, 64, bottomHeight], rotateX(-Math.PI / 4, cuboid({ size: [80, chSize, chSize] })));
  solid = union(solid, frontChamfer, backChamfer);

  // 2. INNER CUTOUTS (Hollowing)
  const innerMainBase = roundedRectangle({ size: [overallWidth - wallThickness * 2, overallDepth - wallThickness * 2], roundRadius: cornerRadius - 1, segments: 32 });
  const innerMain = translate([0, 0, bottomHeight + wallThickness], extrudeLinear({height: mainHeight + 10}, innerMainBase));
  
  const innerBottomWidth = 80.0 - (wallThickness * 2); 
  const innerBottomDepth = 128.0 - (wallThickness * 2); 
  const innerBottom = translate([0, 0, (bottomHeight + 10) / 2 + 2], cuboid({size: [innerBottomWidth, innerBottomDepth, bottomHeight + 10]}));
  
  const hollow = union(innerMain, innerBottom);
  solid = subtract(solid, hollow);

  // 2.1 CORNER SUPPORT TABS FOR THE LID
  // Lowered by exactly 5mm. Center Z = 85.8, Height = 10.0 
  // This means the top surface is exactly at 90.8 (leaving 5.0mm for the lid to sit flush inside)
  const tabZ = totalHeight - 10.0; 
  const rawTabs = union(
      translate([-76, -76, tabZ], cuboid({size: [12.0, 12.0, 10.0]})),
      translate([ 76, -76, tabZ], cuboid({size: [12.0, 12.0, 10.0]})),
      translate([-76,  76, tabZ], cuboid({size: [12.0, 12.0, 10.0]})),
      translate([ 76,  76, tabZ], cuboid({size: [12.0, 12.0, 10.0]}))
  );
  
  // Intersect with 'innerMain' guarantees they perfectly conform to the inner curved walls
  const cornerTabs = intersect(rawTabs, innerMain);
  solid = union(solid, cornerTabs);

  // 2.5 ADD LID MOUNTING BLOCK (Hulled bracket to ensure it is fully anchored to the wall for 3D printing)
  // The topPlate centers on the lid screw hole, while the wallAnchor firmly embeds into the inner wall
  const topPlate = translate([0, 71.0, totalHeight - 7.5], cuboid({size: [12.0, 6.0, 5.0]}));
  const wallAnchor = translate([0, 78.0, totalHeight - 12.5], cuboid({size: [12.0, 4.0, 15.0]}));
  const mountBlock = hull(topPlate, wallAnchor); // Generates a smooth, printable ~38-degree overhang slope
  
  solid = union(solid, mountBlock);

  // 3. MAIN CHASSIS ASSEMBLY
  parts.add("CobotChassis", solid);
  parts.pos("CobotChassis", [0.00, 0.00, 0.00]);
  parts.rot("CobotChassis", [0.00, 0.00, 0.00]);
  parts.scale("CobotChassis", [1.00, 1.00, 1.00]);

  // 3.5 LID FASTENER HOLE IN CHASSIS (1.7mm Pilot for M2 thread)
  const lidPilotHole = cylinder({radius: 0.85, height: 15.0, segments: 16});
  parts.addHole("CobotChassis", "LidScrewHole", lidPilotHole);
  parts.pos("LidScrewHole", [0.00, 71.00, totalHeight - 10.0]); // Matches the center of the mountBlock's topPlate
  parts.rot("LidScrewHole", [0.00, 0.00, 0.00]);
  parts.scale("LidScrewHole", [1.00, 1.00, 1.00]);

  // 4. FRONT FACE: HC-SR04 & ESP32-S3 Camera
  parts.addHole("CobotChassis", "Ultrasonic", hcSr04Cutout());
  parts.pos("Ultrasonic", [0.00, -80.00, 60.00]);
  parts.rot("Ultrasonic", [0.00, 0.00, 0.00]);
  parts.scale("Ultrasonic", [1.00, 1.00, 1.00]);

  parts.addHole("CobotChassis", "Camera", esp32CameraCutout());
  parts.pos("Camera", [0.00, -80.00, 82.00]);
  parts.rot("Camera", [0.00, 0.00, 0.00]);
  parts.scale("Camera", [1.00, 1.00, 1.00]);

  // 5. SIDE-WALL MG90S SERVOS
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

  const chargePort = rotateX(Math.PI / 2, cylinder({radius: 3.5, height: 20.0, segments: 32}));
  parts.addHole("CobotChassis", "ChargePort", chargePort);
  parts.pos("ChargePort", [-60.00, 80.00, 45.00]); 
  parts.rot("ChargePort", [0.00, 0.00, 0.00]);
  parts.scale("ChargePort", [1.00, 1.00, 1.00]);

  parts.addHole("CobotChassis", "SwitchBack", cuboid({size: [8.4, 20.0, 8.4]}));
  parts.pos("SwitchBack", [35.00, 80.00, 60.00]); 
  parts.rot("SwitchBack", [0.00, 0.00, 0.00]);
  parts.scale("SwitchBack", [1.00, 1.00, 1.00]);

  // 7. GENERATE AND POSITION THE LID
  parts.add("CobotLid", buildLid());
  parts.pos("CobotLid", [170.00, 0.00, 0.00]); // Placed flat on Z=0
  parts.rot("CobotLid", [0.00, 0.00, 0.00]);
  parts.scale("CobotLid", [1.00, 1.00, 1.00]);

  return parts.render();
}

// ------------------------------------
// CUSTOM MACRO CUTS & PART BUILDERS
// ------------------------------------

function buildLid() {
    const lidThick = 5.0; 
    
    // 1. Flush Solid Plate (Fits entirely INSIDE the chassis)
    // The chassis inner cavity is 156.0. We make the lid 155.4 for a perfect slide-in snap fit.
    const lidBase = roundedRectangle({ size: [155.4, 155.4], roundRadius: 10.7, segments: 32 });
    let lidSolid = translate([0, 0, lidThick / 2], extrudeLinear({height: lidThick}, lidBase));
    
    // 2. M2 Screw Pass-through and Countersink Hole
    const clearanceHole = cylinder({radius: 1.15, height: 15.0, segments: 16}); 
    const counterbore = translate([0, 0, lidThick - 1.0], cylinder({radius: 2.2, height: 3.0, segments: 32})); 
    
    const screwHole = translate([0, 71.0, 0], union(clearanceHole, counterbore));
    lidSolid = subtract(lidSolid, screwHole);
    
    return lidSolid;
}

function hcSr04Cutout() { 
    const eye = rotateX(Math.PI / 2, cylinder({radius: 8.2, height: 20, segments: 32}));
    const leftEye = translate([-12.75, 0, 0], eye);
    const rightEye = translate([12.75, 0, 0], eye);
    
    const pocket = translate([0, 2.0, 0], cuboid({size: [46.0, 2.0, 21.0]}));
    return union(leftEye, rightEye, pocket);
}

function esp32CameraCutout() {
    const lens = cuboid({size: [8.6, 20.0, 8.6]});
    const pocket = translate([0, 2.0, 0], cuboid({size: [22.0, 2.0, 19.0]}));
    return union(lens, pocket);
}

function sg90Cutout() {
    const slot = cuboid({size: [20.0, 23.2, 12.5]});
    const screwRadius = 0.85; 
    const screw = rotateY(Math.PI / 2, cylinder({radius: screwRadius, height: 25.0, segments: 32}));
    const screw1 = translate([0, 14.15, 0], screw);
    const screw2 = translate([0, -14.15, 0], screw);
    return union(slot, screw1, screw2);
}

function speakerCutout() {
    const centerHole = cylinder({radius: 12.5, height: 20.0, segments: 64});
    const screwRadius = 0.8; 
    const screwCyl = cylinder({radius: screwRadius, height: 20.0, segments: 16});
    const screwOffset = 11.5;
    const stl = translate([-screwOffset, screwOffset, 0], screwCyl);
    const str = translate([screwOffset, screwOffset, 0], screwCyl);
    const sbl = translate([-screwOffset, -screwOffset, 0], screwCyl);
    const sbr = translate([screwOffset, -screwOffset, 0], screwCyl);
    const shape = union(centerHole, stl, str, sbl, sbr);
    return rotateX(Math.PI / 2, shape);
}