// js/jscad.js
export class PartList {
    constructor() { 
        this.items = {}; 
        this.holes = {}; 
    }
    
    add(id, geom, meta={}) { 
        this.items[id] = { geom, pos: [0,0,0], rot: [0,0,0], scl: [1,1,1], hollow: 0, holes: [], meta }; 
    }
    pos(id, arr) { if(this.items[id]) this.items[id].pos = arr; else if(this.holes[id]) this.holes[id].pos = arr; }
    rot(id, arr) { if(this.items[id]) this.items[id].rot = arr; else if(this.holes[id]) this.holes[id].rot = arr; }
    scale(id, arr) { if(this.items[id]) this.items[id].scl = arr; else if(this.holes[id]) this.holes[id].scl = arr; }
    hollow(id, thickness) { if(this.items[id]) this.items[id].hollow = thickness; }
    
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

            if (p.hollow > 0) {
                let inner = transforms.scale([p.hollow, p.hollow, p.hollow], p.geom);
                finalGeom = booleans.subtract(finalGeom, inner);
            }

            for (let hid of p.holes) {
                let h = this.holes[hid];
                let holeGeom = h.geom;
                holeGeom = transforms.scale(h.scl, holeGeom);
                holeGeom = transforms.rotate(h.rot, holeGeom);
                holeGeom = transforms.translate(h.pos, holeGeom);
                finalGeom = booleans.subtract(finalGeom, holeGeom);
            }
            results.push({ id, type: 'part', geom: finalGeom, pos: p.pos, rot: p.rot, scl: p.scl, meta: p.meta });
        }
        
        for (let hid in this.holes) {
            let h = this.holes[hid];
            results.push({ id: hid, type: 'hole', parentId: h.parent, geom: h.geom, pos: h.pos, rot: h.rot, scl: h.scl, meta: h.meta });
        }
        return results;
    }
}

export function jscadToThreeGeometry(jscadObj) {
    const { geom3 } = window.jscadModeling.geometries;
    const { generalize } = window.jscadModeling.modifiers || {};
    
    const geometries = Array.isArray(jscadObj) ? jscadObj : [jscadObj];
    const positions = [];

    geometries.forEach(g => {
        if (!geom3.isA(g)) return; 
        
        // 1. KERNEL-LEVEL TRIANGULATION
        let processedGeom = g;
        if (generalize) {
            try {
                processedGeom = generalize({ snap: true, triangulate: true }, g);
            } catch(e) { console.warn("Generalize failed:", e); }
        }

        const polygons = geom3.toPolygons(processedGeom);
        
        polygons.forEach(p => {
            const v = p.vertices;
            if (v.length < 3) return;

            // Fast path for simple triangles
            if (v.length === 3) {
                positions.push(v[0][0], v[0][1], v[0][2]);
                positions.push(v[1][0], v[1][1], v[1][2]);
                positions.push(v[2][0], v[2][1], v[2][2]);
                return;
            }

            // --- ROBUST CONCAVE TRIANGULATION FALLBACK ---
            // Newell's Method for a robust geometric normal
            let nx = 0, ny = 0, nz = 0;
            for (let i = 0; i < v.length; i++) {
                const curr = v[i];
                const next = v[(i + 1) % v.length];
                nx += (curr[1] - next[1]) * (curr[2] + next[2]);
                ny += (curr[2] - next[2]) * (curr[0] + next[0]);
                nz += (curr[0] - next[0]) * (curr[1] + next[1]);
            }
            
            const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
            if (len < 1e-8) return; 
            const N = new THREE.Vector3(nx/len, ny/len, nz/len);

            // Compute local U and V axes on the polygon plane for SAFE 2D mapping
            const v0 = new THREE.Vector3(v[0][0], v[0][1], v[0][2]);
            const v1 = new THREE.Vector3(v[1][0], v[1][1], v[1][2]);
            
            let U = new THREE.Vector3().subVectors(v1, v0);
            if (U.lengthSq() < 1e-8) {
                U.set(1, 0, 0).cross(N);
                if (U.lengthSq() < 1e-8) U.set(0, 1, 0).cross(N);
            }
            U.normalize();
            const V = new THREE.Vector3().crossVectors(N, U).normalize();

            // Project to 2D
            let contour = [];
            let vMap = [];
            for (let i = 0; i < v.length; i++) {
                const pt = new THREE.Vector3(v[i][0], v[i][1], v[i][2]);
                const delta = new THREE.Vector3().subVectors(pt, v0);
                const pt2d = new THREE.Vector2(delta.dot(U), delta.dot(V));
                
                // Filter microscopic duplicates
                if (contour.length === 0 || contour[contour.length - 1].distanceToSquared(pt2d) > 1e-10) {
                    contour.push(pt2d);
                    vMap.push(i);
                }
            }

            if (contour.length > 1 && contour[0].distanceToSquared(contour[contour.length - 1]) < 1e-10) {
                contour.pop();
                vMap.pop();
            }

            if (contour.length < 3) return;

            let faces = [];
            try {
                // Call Earcut directly, bypassing ShapeUtils' fragile validation rules
                if (typeof THREE.Earcut !== 'undefined' && typeof THREE.Earcut.triangulate === 'function') {
                    const flatPoints = [];
                    for (let i = 0; i < contour.length; i++) {
                        flatPoints.push(contour[i].x, contour[i].y);
                    }
                    const triangles = THREE.Earcut.triangulate(flatPoints, null, 2);
                    for (let i = 0; i < triangles.length; i += 3) {
                        faces.push([triangles[i], triangles[i+1], triangles[i+2]]);
                    }
                } else if (typeof THREE.ShapeUtils !== 'undefined' && THREE.ShapeUtils.triangulateShape) {
                     faces = THREE.ShapeUtils.triangulateShape(contour, []);
                }
            } catch(e) { }

            if (faces && faces.length > 0) {
                for (let i = 0; i < faces.length; i++) {
                    const i0 = vMap[faces[i][0]];
                    const i1 = vMap[faces[i][1]];
                    const i2 = vMap[faces[i][2]];
                    
                    if (i0 !== undefined && i1 !== undefined && i2 !== undefined) {
                        const pt0 = new THREE.Vector3(v[i0][0], v[i0][1], v[i0][2]);
                        const pt1 = new THREE.Vector3(v[i1][0], v[i1][1], v[i1][2]);
                        const pt2 = new THREE.Vector3(v[i2][0], v[i2][1], v[i2][2]);
                        
                        const edge1 = new THREE.Vector3().subVectors(pt1, pt0);
                        const edge2 = new THREE.Vector3().subVectors(pt2, pt1);
                        const triN = new THREE.Vector3().crossVectors(edge1, edge2);
                        
                        if (triN.lengthSq() > 1e-12) {
                            if (triN.dot(N) < 0) {
                                positions.push(pt0.x, pt0.y, pt0.z);
                                positions.push(pt2.x, pt2.y, pt2.z);
                                positions.push(pt1.x, pt1.y, pt1.z);
                            } else {
                                positions.push(pt0.x, pt0.y, pt0.z);
                                positions.push(pt1.x, pt1.y, pt1.z);
                                positions.push(pt2.x, pt2.y, pt2.z);
                            }
                        }
                    }
                }
            } else {
                // Ultimate failsafe simple-fan mapping
                for (let i = 2; i < v.length; i++) {
                    positions.push(v[0][0], v[0][1], v[0][2]);
                    positions.push(v[i-1][0], v[i-1][1], v[i-1][2]);
                    positions.push(v[i][0], v[i][1], v[i][2]);
                }
            }
        });
    });
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
}