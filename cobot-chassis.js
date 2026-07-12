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
  const innerBottom = translate([0, 0, (bottomHeight + 10) / 2 + 2], cuboid({size: [innerBottomWidth, innerBottomDepth, bottomHeight + 10]}));
  
  let hollow = union(innerMain, innerBottom);
  solid = subtract(solid, hollow);

  // 3. MAIN CHASSIS ASSEMBLY
  parts.add("CobotChassis", solid);
  parts.pos("CobotChassis", [0.00, 0.00, 0.00]);
  parts.rot("CobotChassis", [0.00, 0.00, 0.00]);
  parts.scale("CobotChassis", [1.00, 1.00, 1.00]);

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

  return parts.render();
}

// ------------------------------------
// CUSTOM MACRO CUTS
// ------------------------------------

function hcSr04Cutout() { 
    // Two circular "eyes" for the 16mm ultrasonic cylinders
    const eye = rotateX(Math.PI / 2, cylinder({radius: 8.2, height: 20, segments: 32}));
    const leftEye = translate([-12.75, 0, 0], eye);
    const rightEye = translate([12.75, 0, 0], eye);
    
    // Internal Alignment Pocket: Sized to 46x21mm (for your 45x20mm board)
    // Cut exactly 1mm deep into the inner face of the 2mm front wall.
    const pocket = translate([0, 2.0, 0], cuboid({size: [46.0, 2.0, 21.0]}));
    
    return union(leftEye, rightEye, pocket);
}

function esp32CameraCutout() {
    // Snap-fit hole for the 8.5x8.5mm OV3660 camera head
    const lens = cuboid({size: [8.6, 20.0, 8.6]});
    
    // Internal Alignment Pocket: Sized to 22x19mm (for the 21x17.8mm XIAO Sense board)
    // Cut exactly 1mm deep into the inner face of the 2mm front wall.
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