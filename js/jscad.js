export class PartList {
    constructor() { 
        this.items = {}; 
        this.holes = {}; 
    }
    
    add(id, geom) { 
        this.items[id] = { geom, pos: [0,0,0], rot: [0,0,0], scl: [1,1,1], hollow: 0, holes: [] }; 
    }
    pos(id, arr) { if(this.items[id]) this.items[id].pos = arr; else if(this.holes[id]) this.holes[id].pos = arr; }
    rot(id, arr) { if(this.items[id]) this.items[id].rot = arr; else if(this.holes[id]) this.holes[id].rot = arr; }
    scale(id, arr) { if(this.items[id]) this.items[id].scl = arr; else if(this.holes[id]) this.holes[id].scl = arr; }
    hollow(id, thickness) { if(this.items[id]) this.items[id].hollow = thickness; }
    
    addHole(partId, holeId, geom) {
        if(this.items[partId]) {
            this.items[partId].holes.push(holeId);
            this.holes[holeId] = { parent: partId, geom, pos: [0,0,0], rot: [0,0,0], scl: [1,1,1] };
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
            results.push({ id, type: 'part', geom: finalGeom, pos: p.pos, rot: p.rot, scl: p.scl });
        }
        
        for (let hid in this.holes) {
            let h = this.holes[hid];
            results.push({ id: hid, type: 'hole', parentId: h.parent, geom: h.geom, pos: h.pos, rot: h.rot, scl: h.scl });
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
            for (let i = 2; i < v.length; i++) {
                positions.push(v[0][0], v[0][1], v[0][2]);
                positions.push(v[i-1][0], v[i-1][1], v[i-1][2]);
                positions.push(v[i][0], v[i][1], v[i][2]);
            }
        });
    });
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
}