// js/jscad.js
export class PartList {
    constructor() { 
        this.items = {}; 
        this.holes = {}; 
    }
    
    // Accept a meta object argument and store it
    add(id, geom, meta={}) { 
        this.items[id] = { geom, pos: [0,0,0], rot: [0,0,0], scl: [1,1,1], hollow: 0, holes: [], meta }; 
    }
    pos(id, arr) { if(this.items[id]) this.items[id].pos = arr; else if(this.holes[id]) this.holes[id].pos = arr; }
    rot(id, arr) { if(this.items[id]) this.items[id].rot = arr; else if(this.holes[id]) this.holes[id].rot = arr; }
    scale(id, arr) { if(this.items[id]) this.items[id].scl = arr; else if(this.holes[id]) this.holes[id].scl = arr; }
    hollow(id, thickness) { if(this.items[id]) this.items[id].hollow = thickness; }
    
    // Accept meta object on holes as well
    addHole(partId, holeId, geom, meta={}) {
        if(this.items[partId]) {
            this.items[partId].holes.push(holeId);
            this.holes[holeId] = { parent: partId, geom, pos: [0,0,0], rot: [0,0,0], scl: [1,1,1], meta };
        }
    }
    
    render() {
        const { transforms, booleans } = window.jscadModeling;
        let results = [];
        
        for (let id in this.items) {
            let p = this.items[id];
            let finalGeom = p.geom;

            // Apply Hollow
            if (p.hollow > 0) {
                let inner = transforms.scale([p.hollow, p.hollow, p.hollow], p.geom);
                finalGeom = booleans.subtract(finalGeom, inner);
            }

            // Subtract Holes (local space mapping)
            for (let hid of p.holes) {
                let h = this.holes[hid];
                let holeGeom = h.geom;
                holeGeom = transforms.scale(h.scl, holeGeom);
                holeGeom = transforms.rotate(h.rot, holeGeom);
                holeGeom = transforms.translate(h.pos, holeGeom);
                finalGeom = booleans.subtract(finalGeom, holeGeom);
            }
            // Pass meta out to the renderer
            results.push({ id, type: 'part', geom: finalGeom, pos: p.pos, rot: p.rot, scl: p.scl, meta: p.meta });
        }
        
        for (let hid in this.holes) {
            let h = this.holes[hid];
            // Pass meta out to the renderer
            results.push({ id: hid, type: 'hole', parentId: h.parent, geom: h.geom, pos: h.pos, rot: h.rot, scl: h.scl, meta: h.meta });
        }
        return results;
    }
}

export function jscadToThreeGeometry(jscadObj) {
    const { geom3 } = window.jscadModeling.geometries;
    const geometries = Array.isArray(jscadObj) ? jscadObj : [jscadObj];
    const positions = [];

    geometries.forEach(g => {
        if (!geom3.isA(g)) return; 
        const polygons = geom3.toPolygons(g);
        
        polygons.forEach(p => {
            const v = p.vertices;
            if (v.length < 3) return;

            // A standard triangle is perfectly manifold out of the box
            if (v.length === 3) {
                positions.push(v[0][0], v[0][1], v[0][2]);
                positions.push(v[1][0], v[1][1], v[1][2]);
                positions.push(v[2][0], v[2][1], v[2][2]);
                return;
            }

            // COMPLEX CONCAVE POLYGON -> Requires true "EarCut" triangulation.
            // 1. Calculate an accurate normal to safely project 3D space to a 2D plane
            const cb = new THREE.Vector3();
            const ab = new THREE.Vector3();
            const normal = new THREE.Vector3();

            // Find the first valid non-collinear vertex triplet
            for(let i = 0; i < v.length - 2; i++) {
                const v0 = new THREE.Vector3(v[i][0], v[i][1], v[i][2]);
                const v1 = new THREE.Vector3(v[i+1][0], v[i+1][1], v[i+1][2]);
                const v2 = new THREE.Vector3(v[i+2][0], v[i+2][1], v[i+2][2]);
                cb.subVectors(v2, v1);
                ab.subVectors(v0, v1);
                normal.crossVectors(cb, ab);
                if (normal.lengthSq() > 0.000001) break; 
            }
            normal.normalize();

            const nx = Math.abs(normal.x);
            const ny = Math.abs(normal.y);
            const nz = Math.abs(normal.z);

            // 2. Project the 3D polygon onto the best-aligned 2D plane
            const contour = [];
            for (let i = 0; i < v.length; i++) {
                if (nx >= ny && nx >= nz) {
                    contour.push(new THREE.Vector2(v[i][1], v[i][2]));
                } else if (ny >= nx && ny >= nz) {
                    contour.push(new THREE.Vector2(v[i][0], v[i][2]));
                } else {
                    contour.push(new THREE.Vector2(v[i][0], v[i][1]));
                }
            }

            // 3. Triangulate the 2D contour using Three.js's internal EarCut algorithm
            const faces = THREE.ShapeUtils.triangulateShape(contour, []);

            // 4. Trace the resulting 2D map triangles back to the original 3D vertex array
            for (let i = 0; i < faces.length; i++) {
                const face = faces[i];
                positions.push(v[face[0]][0], v[face[0]][1], v[face[0]][2]);
                positions.push(v[face[1]][0], v[face[1]][1], v[face[1]][2]);
                positions.push(v[face[2]][0], v[face[2]][1], v[face[2]][2]);
            }
        });
    });
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
}