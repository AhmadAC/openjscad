// js/main.js
import { initScene } from './scene.js';
import { PartList, jscadToThreeGeometry } from './jscad.js';
import { updateTransform, deleteParts, duplicateParts, applyHollow } from './editor.js';

// --- Global App State ---
const editorEl = document.getElementById('code-editor');
let partMeshes = [], holeMeshes = [], selectedMeshes = [], stlMeshes = [];
let currentMode = 'orbit';
let showRuler = false;
let isAnimated = false;

// --- Undo / Redo State ---
let codeHistory = [];
let historyIndex = -1;
let saveTimeout = null;

function pushState(value) {
    if (historyIndex >= 0 && codeHistory[historyIndex] === value) return;
    if (historyIndex < codeHistory.length - 1) {
        codeHistory = codeHistory.slice(0, historyIndex + 1);
    }
    codeHistory.push(value);
    if (codeHistory.length > 50) codeHistory.shift();
    else historyIndex++;
}

function saveState() {
    if (saveTimeout) clearTimeout(saveTimeout);
    pushState(editorEl.value);
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        editorEl.value = codeHistory[historyIndex];
        generatePreview();
    }
}

function redo() {
    if (historyIndex < codeHistory.length - 1) {
        historyIndex++;
        editorEl.value = codeHistory[historyIndex];
        generatePreview();
    }
}

editorEl.addEventListener('input', () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        pushState(editorEl.value);
    }, 500);
});

// --- Initialization ---
const { scene, camera, renderer, container } = initScene('canvas-container');
const controls = new THREE.OrbitControls(camera, renderer.domElement);
const transformControl = new THREE.TransformControls(camera, renderer.domElement);
scene.add(transformControl);

// Materials
const matSolid = new THREE.MeshStandardMaterial({ color: 0x0077ff, roughness: 0.3, metalness: 0.2, side: THREE.DoubleSide, flatShading: true });
const matHole = new THREE.MeshStandardMaterial({ color: 0xff3333, wireframe: false, transparent: true, opacity: 0.0, depthWrite: false }); // Hidden
const matSTL = new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide, flatShading: true }); // Distinct Red

// Rubber Band Box Element
const selectionBoxEl = document.createElement('div');
Object.assign(selectionBoxEl.style, { position: 'fixed', border: '1px solid #0099ff', backgroundColor: 'rgba(0, 153, 255, 0.2)', display: 'none', pointerEvents: 'none', zIndex: '1000' });
document.body.appendChild(selectionBoxEl);
let isSelecting = false, startPoint = { x: 0, y: 0 };

// Ruler/Dimension Overlay Pool
const labelContainer = document.getElementById('dimension-labels');
const labelPool = [];
for (let i = 0; i < 150; i++) {
    const div = document.createElement('div');
    div.className = 'dim-label';
    div.style.display = 'none';
    labelContainer.appendChild(div);
    labelPool.push(div);
}

// --- Core Render Logic ---
function generatePreview() {
    try {
        // Reset animation state whenever the script rebuilds to prevent desync
        isAnimated = false;
        if (window.lidAnimationReq) cancelAnimationFrame(window.lidAnimationReq);
        const btnAnimate = document.getElementById('btn-animate');
        if (btnAnimate) btnAnimate.classList.remove('active');

        const parts = new PartList();
        const wrapper = editorEl.value + `\n return typeof main !== 'undefined' ? main(parts) : null;`;
        const func = new Function('jscadModeling', 'parts', wrapper);
        const results = func(window.jscadModeling, parts);

        partMeshes.forEach(m => { scene.remove(m); m.geometry.dispose(); });
        holeMeshes.forEach(m => { m.geometry.dispose(); });
        partMeshes = []; holeMeshes = [];
        
        const previouslySelectedIds = selectedMeshes.map(m => m.userData.id);
        selectMeshes([]);

        if (Array.isArray(results)) {
            // Render solids
            results.forEach(res => {
                if (res.type === 'part') {
                    const isMockComponent = res.meta && res.meta.isMock;
                    const color = res.meta && res.meta.color !== undefined ? res.meta.color : 0x0077ff;
                    const mat = matSolid.clone();
                    mat.color.setHex(color);

                    const mesh = new THREE.Mesh(jscadToThreeGeometry(res.geom), mat);
                    
                    const edgesGeom = new THREE.EdgesGeometry(mesh.geometry, 30);
                    const edgesMat = new THREE.LineBasicMaterial({ color: 0x001144, transparent: true, opacity: 0.4 });
                    const edges = new THREE.LineSegments(edgesGeom, edgesMat);
                    mesh.add(edges);

                    // Attach meta
                    mesh.userData = { id: res.id, type: 'part', meta: res.meta };
                    mesh.position.set(...res.pos); mesh.rotation.set(...res.rot); mesh.scale.set(...res.scl);
                    
                    // Mock electronics are hidden by default!
                    mesh.visible = isMockComponent ? false : true; 
                    
                    scene.add(mesh); partMeshes.push(mesh);
                }
            });
            // Render Holes
            results.forEach(res => {
                if (res.type === 'hole') {
                    const parentMesh = partMeshes.find(m => m.userData.id === res.parentId);
                    if (parentMesh) {
                        const mesh = new THREE.Mesh(jscadToThreeGeometry(res.geom), matHole.clone());
                        // Attach meta
                        mesh.userData = { id: res.id, type: 'hole', parentId: res.parentId, meta: res.meta };
                        mesh.position.set(...res.pos); mesh.rotation.set(...res.rot); mesh.scale.set(...res.scl);
                        mesh.visible = false; 
                        
                        parentMesh.add(mesh); holeMeshes.push(mesh);
                    }
                }
            });
        }

        const restoredSelection = [...partMeshes, ...holeMeshes, ...stlMeshes].filter(m => previouslySelectedIds.includes(m.userData.id));
        if (restoredSelection.length > 0) selectMeshes(restoredSelection);

    } catch (err) { console.error("Render Error:", err); }
}

// --- Dimensions/Ruler Projection Logic ---
function renderLabels() {
    let labelIdx = 0;

    if (showRuler) {
        const width = container.clientWidth;
        const height = container.clientHeight;

        const meshesToLabel = Array.from(new Set([...selectedMeshes, ...holeMeshes]));

        meshesToLabel.forEach(mesh => {
            if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
            const box = mesh.geometry.boundingBox;
            const min = box.min;
            const max = box.max;

            const worldScale = new THREE.Vector3();
            mesh.getWorldScale(worldScale);
            const valX = Math.abs(max.x - min.x) * worldScale.x;
            const valY = Math.abs(max.y - min.y) * worldScale.y;
            const valZ = Math.abs(max.z - min.z) * worldScale.z;

            const offset = 0.5;
            let pts = [];
            const eps = 0.05;
            
            const meta = mesh.userData.meta || {};
            let isCylinder = false;
            let dia = 0, len = 0, lenAxis = '';

            if (meta.type !== 'speaker') {
                if (Math.abs(valX - valY) < eps && Math.abs(valY - valZ) > eps) { isCylinder = true; dia = valX; len = valZ; lenAxis = 'Z'; }
                else if (Math.abs(valX - valZ) < eps && Math.abs(valX - valY) > eps) { isCylinder = true; dia = valX; len = valY; lenAxis = 'Y'; }
                else if (Math.abs(valY - valZ) < eps && Math.abs(valX - valY) > eps) { isCylinder = true; dia = valY; len = valX; lenAxis = 'X'; }
            }

            if (isCylinder && mesh.userData.type === 'hole') {
                if (lenAxis === 'Z') {
                    pts.push({ p: new THREE.Vector3((min.x + max.x)/2, min.y - offset, min.z - offset), val: dia, color: '#ffcc00', prefix: 'Ø' });
                    pts.push({ p: new THREE.Vector3(max.x + offset, max.y + offset, (min.z + max.z)/2), val: len, color: '#66aaff', prefix: 'L' });
                } else if (lenAxis === 'Y') {
                    pts.push({ p: new THREE.Vector3((min.x + max.x)/2, min.y - offset, min.z - offset), val: dia, color: '#ffcc00', prefix: 'Ø' });
                    pts.push({ p: new THREE.Vector3(max.x + offset, (min.y + max.y)/2, min.z - offset), val: len, color: '#66ff66', prefix: 'L' });
                } else { // X
                    pts.push({ p: new THREE.Vector3(max.x + offset, (min.y + max.y)/2, min.z - offset), val: dia, color: '#ffcc00', prefix: 'Ø' });
                    pts.push({ p: new THREE.Vector3((min.x + max.x)/2, min.y - offset, min.z - offset), val: len, color: '#ff6666', prefix: 'L' });
                }
            } else {
                pts = [
                    { p: new THREE.Vector3((min.x + max.x)/2, min.y - offset, min.z - offset), val: valX, color: '#ff6666', prefix: 'W' },
                    { p: new THREE.Vector3(max.x + offset, (min.y + max.y)/2, min.z - offset), val: valY, color: '#66ff66', prefix: mesh.userData.type === 'hole' ? 'L' : 'D' },
                    { p: new THREE.Vector3(max.x + offset, max.y + offset, (min.z + max.z)/2), val: valZ, color: '#66aaff', prefix: 'H' }
                ];
                if (meta.type === 'speaker' && meta.cornerR) pts.push({ p: new THREE.Vector3(max.x + offset, max.y + offset, max.z + offset), val: meta.cornerR, color: '#ffcc00', prefix: 'Corner R' });
            }

            pts.forEach(axis => {
                if (axis.val > 0.01 && labelIdx < labelPool.length) {
                    const worldPt = axis.p.clone();
                    mesh.localToWorld(worldPt);
                    worldPt.project(camera);

                    if (worldPt.z < 1) { 
                        const x = (worldPt.x * 0.5 + 0.5) * width;
                        const y = -(worldPt.y * 0.5 - 0.5) * height;
                        
                        const div = labelPool[labelIdx++];
                        div.style.left = `${x}px`;
                        div.style.top = `${y}px`;
                        div.style.color = axis.color;
                        div.innerText = `${axis.prefix}: ${axis.val.toFixed(1)}mm`;
                        div.style.display = 'block';
                    }
                }
            });
        });
    }

    for (let i = labelIdx; i < labelPool.length; i++) {
        if (labelPool[i].style.display !== 'none') {
            labelPool[i].style.display = 'none';
        }
    }
}

// --- Selection & Raycasting ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function selectMeshes(meshes) {
    selectedMeshes.forEach(m => m.material.emissive.setHex(0x000000));
    selectedMeshes = meshes;
    
    let isPart = false, isHole = false, isStl = false, selId = null;

    selectedMeshes.forEach(m => {
        m.material.emissive.setHex(0x333333);
        if (m.userData.type === 'part') isPart = true;
        if (m.userData.type === 'hole') isHole = true;
        if (m.userData.type === 'stl') isStl = true;
        selId = m.userData.id;
    });

    if (selectedMeshes.length === 1 && currentMode !== 'orbit') transformControl.attach(selectedMeshes[0]);
    else transformControl.detach();

    document.getElementById('selected-properties').style.display = (isPart && !isHole && !isStl && selectedMeshes.length === 1) ? 'block' : 'none';

    if (isPart && selId) {
        const safeId = selId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const match = editorEl.value.match(new RegExp(`parts\\.hollow\\(\\s*['"]${safeId}['"]\\s*,\\s*([0-9.]+)`));
        document.getElementById('toggle-hollow').checked = !!match;
        document.getElementById('hollow-settings').style.display = match ? 'flex' : 'none';
        if (match) document.getElementById('hollow-factor').value = parseFloat(match[1]);
    }
}

renderer.domElement.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1; mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // Filter out parts that are currently hidden (like mock electronics when not animated)
    const interactableMeshes = [...partMeshes, ...holeMeshes, ...stlMeshes].filter(m => m.visible);
    const intersects = raycaster.intersectObjects(interactableMeshes, false);
    
    if (intersects.length > 0) {
        const clickedMesh = intersects[0].object;
        if (e.shiftKey) {
            if (selectedMeshes.includes(clickedMesh)) selectMeshes(selectedMeshes.filter(m => m !== clickedMesh));
            else selectMeshes([...selectedMeshes, clickedMesh]);
        } else selectMeshes([clickedMesh]);
    } else if (!transformControl.dragging) {
        if (e.shiftKey) {
            isSelecting = true; controls.enabled = false; startPoint = { x: e.clientX, y: e.clientY };
            Object.assign(selectionBoxEl.style, { left: startPoint.x+'px', top: startPoint.y+'px', width: '0px', height: '0px', display: 'block' });
        } else selectMeshes([]);
    }
});

window.addEventListener('pointermove', (e) => {
    if (isSelecting) {
        selectionBoxEl.style.left = Math.min(startPoint.x, e.clientX) + 'px';
        selectionBoxEl.style.top = Math.min(startPoint.y, e.clientY) + 'px';
        selectionBoxEl.style.width = Math.abs(e.clientX - startPoint.x) + 'px';
        selectionBoxEl.style.height = Math.abs(e.clientY - startPoint.y) + 'px';
    }
});

window.addEventListener('pointerup', (e) => {
    if (isSelecting) {
        isSelecting = false; selectionBoxEl.style.display = 'none'; controls.enabled = true;
        const rect = renderer.domElement.getBoundingClientRect();
        const minX = Math.min(startPoint.x, e.clientX) - rect.left, maxX = Math.max(startPoint.x, e.clientX) - rect.left;
        const minY = Math.min(startPoint.y, e.clientY) - rect.top, maxY = Math.max(startPoint.y, e.clientY) - rect.top;

        if (maxX - minX < 2 && maxY - minY < 2) return;
        const selected = [];
        const interactableMeshes = [...partMeshes, ...holeMeshes, ...stlMeshes].filter(m => m.visible);
        interactableMeshes.forEach(m => {
            const pos = new THREE.Vector3(); m.getWorldPosition(pos); pos.project(camera);
            const screenX = (pos.x * 0.5 + 0.5) * rect.width, screenY = -(pos.y * 0.5 - 0.5) * rect.height;
            if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY && pos.z < 1) selected.push(m);
        });
        selectMeshes(Array.from(new Set([...selectedMeshes, ...selected])));
    }
});


// --- Interactions (Gizmo & Keys) ---
transformControl.addEventListener('dragging-changed', (e) => controls.enabled = !e.value);
transformControl.addEventListener('mouseUp', () => {
    if (selectedMeshes.length === 1) {
        const mesh = selectedMeshes[0];
        if (mesh.userData.type !== 'stl') {
            editorEl.value = updateTransform(editorEl.value, mesh.userData.id, 'pos', mesh.position.toArray());
            editorEl.value = updateTransform(editorEl.value, mesh.userData.id, 'rot', [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z]);
            editorEl.value = updateTransform(editorEl.value, mesh.userData.id, 'scale', mesh.scale.toArray());
            saveState();
            generatePreview();
        }
    }
});

window.addEventListener('keydown', (e) => {
    if (e.ctrlKey) {
        const key = e.key.toLowerCase();
        if (key === 'z') { e.preventDefault(); undo(); return; }
        if (key === 'y') { e.preventDefault(); redo(); return; }
        if (key === 'c' || key === 'v' || key === 'd') {
            e.preventDefault(); 
            document.getElementById('btn-duplicate').click();
            return;
        }
    }

    if (document.activeElement === editorEl || document.activeElement.tagName === 'INPUT') return;
    
    if (e.key === 'Delete' || e.key === 'Backspace') {
        document.getElementById('btn-delete').click();
        return;
    }
    
    let dx=0, dy=0, dz=0; const step = e.shiftKey ? 4.0 : 1.0;
    switch(e.key) {
        case 'ArrowUp': dy = step; break; case 'ArrowDown': dy = -step; break;
        case 'ArrowLeft': dx = -step; break; case 'ArrowRight': dx = step; break;
        case 'w': case 'W': dz = step; break; case 's': case 'S': dz = -step; break;
    }

    if ((dx||dy||dz) && selectedMeshes.length > 0) {
        e.preventDefault();
        let codeChanged = false;
        selectedMeshes.forEach(mesh => {
            mesh.position.x += dx; mesh.position.y += dy; mesh.position.z += dz;
            if (mesh.userData.type !== 'stl') {
                editorEl.value = updateTransform(editorEl.value, mesh.userData.id, 'pos', mesh.position.toArray());
                codeChanged = true;
            }
        });
        if (codeChanged) {
            saveState();
            generatePreview();
        }
    }
});


// --- UI Events (Tools Panel) ---
document.getElementById('btn-generate').addEventListener('click', () => { saveState(); generatePreview(); });

// Animated Assembly Preview Logic
document.getElementById('btn-animate').addEventListener('click', () => {
    const lidId = "CobotLid";
    const lidMesh = partMeshes.find(m => m.userData.id === lidId);
    if (!lidMesh) return alert("Part 'CobotLid' not found in scene.");
    
    isAnimated = !isAnimated;
    
    // Toggle internal mock components on and off
    partMeshes.forEach(m => {
        if (m.userData.meta && m.userData.meta.isMock) {
            m.visible = isAnimated;
        }
    });
    
    // Read its parsed structural coordinate right from the code logic if we don't have a starting position saved yet
    if (!lidMesh.userData.originalPos) {
        lidMesh.userData.originalPos = lidMesh.position.clone();
    }
    
    // Target position logic
    const targetPos = isAnimated ? new THREE.Vector3(0, 0, 90.8) : lidMesh.userData.originalPos;
    const startPos = lidMesh.position.clone();
    
    let progress = 0;
    if (window.lidAnimationReq) cancelAnimationFrame(window.lidAnimationReq);
    
    const btn = document.getElementById('btn-animate');
    btn.style.pointerEvents = 'none';
    btn.classList.toggle('active', isAnimated);
    
    function animateLid() {
        progress += 0.04;
        if (progress >= 1) {
            lidMesh.position.copy(targetPos);
            btn.style.pointerEvents = 'auto';
            return;
        }
        const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress; // Quadratic easing
        lidMesh.position.lerpVectors(startPos, targetPos, ease);
        
        if (selectedMeshes.includes(lidMesh) && transformControl.object === lidMesh) {
            transformControl.updateMatrixWorld();
        }
        
        window.lidAnimationReq = requestAnimationFrame(animateLid);
    }
    animateLid();
});

document.getElementById('btn-toggle-ruler').addEventListener('click', (e) => {
    showRuler = !showRuler;
    const btn = document.getElementById('btn-toggle-ruler');
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 6v4M10 6v2M14 6v4M18 6v2"/></svg> Ruler: ${showRuler ? 'ON' : 'OFF'}`;
    btn.classList.toggle('active', showRuler);
});

document.getElementById('mode-select').addEventListener('change', (e) => {
    currentMode = e.target.value;
    if (currentMode === 'orbit') { transformControl.detach(); controls.enabled = true; }
    else { transformControl.setMode(currentMode); if(selectedMeshes.length === 1) transformControl.attach(selectedMeshes[0]); }
});

document.getElementById('btn-duplicate').addEventListener('click', () => {
    const stlsToDuplicate = selectedMeshes.filter(m => m.userData.type === 'stl');
    const codeIdsToDuplicate = selectedMeshes.filter(m => m.userData.type !== 'stl').map(m => m.userData.id);

    if (codeIdsToDuplicate.length > 0) {
        editorEl.value = duplicateParts(editorEl.value, codeIdsToDuplicate);
        saveState();
        generatePreview();
    }

    if (stlsToDuplicate.length > 0) {
        const newSelection = [];
        stlsToDuplicate.forEach(m => {
            const clone = m.clone();
            clone.position.x += 5; 
            clone.userData = { ...m.userData, id: 'STL_' + Math.random().toString(36).substr(2, 9) };
            clone.material = m.material.clone(); 
            scene.add(clone);
            stlMeshes.push(clone);
            newSelection.push(clone);
        });
        
        if (codeIdsToDuplicate.length === 0) selectMeshes(newSelection);
    }
});

document.getElementById('btn-delete').addEventListener('click', () => {
    const stlsToDelete = selectedMeshes.filter(m => m.userData.type === 'stl');
    const codeIdsToDelete = selectedMeshes.filter(m => m.userData.type !== 'stl').map(m => m.userData.id);
    
    if (codeIdsToDelete.length > 0) {
        editorEl.value = deleteParts(editorEl.value, codeIdsToDelete);
        saveState();
        generatePreview();
    }
    
    if (stlsToDelete.length > 0) {
        stlsToDelete.forEach(m => {
            scene.remove(m);
            if (m.geometry) m.geometry.dispose();
            if (m.material) m.material.dispose();
            stlMeshes = stlMeshes.filter(stl => stl !== m);
        });
        selectMeshes(selectedMeshes.filter(m => m.userData.type !== 'stl'));
    }
});

document.getElementById('btn-recenter').addEventListener('click', () => { controls.target.set(0,0,0); camera.position.set(60,-80,60); controls.update(); });
document.getElementById('btn-zoomin').addEventListener('click', () => { camera.position.lerp(controls.target, 0.2); controls.update(); });
document.getElementById('btn-zoomout').addEventListener('click', () => { camera.position.lerp(controls.target, -0.25); controls.update(); });

document.getElementById('btn-export').addEventListener('click', () => {
    if (!partMeshes.length) return alert("Nothing to export.");
    const exportScene = new THREE.Scene();
    
    partMeshes.forEach(m => {
        // Absolutely EXCLUDE mock electronic components from being accidentally compiled into the final 3D print file
        if (m.userData.meta && m.userData.meta.isMock) return;
        
        // Ensure that any globally hidden objects on the scene are ignored and not rendered in the final STL
        if (!m.visible) return;

        const cleanMesh = new THREE.Mesh(m.geometry, m.material);
        cleanMesh.position.copy(m.position);
        cleanMesh.rotation.copy(m.rotation);
        cleanMesh.scale.copy(m.scale);
        cleanMesh.updateMatrixWorld(true);
        exportScene.add(cleanMesh);
    });
    
    // EXPORT AS BINARY. This completely bypasses Tinkercad's notorious string 
    // parser bugs where it fails to parse tiny scientific-notation coordinates.
    const stlData = new THREE.STLExporter().parse(exportScene, { binary: true });
    
    // Wrap the returned DataView buffer directly into a binary octet blob
    const blob = new Blob([stlData], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    
    link.href = URL.createObjectURL(blob);
    link.download = 'model.stl'; 
    link.click();
});

// Import STL Logic
document.getElementById('btn-import-stl').addEventListener('click', () => {
    document.getElementById('file-import-stl').click();
});

document.getElementById('file-import-stl').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        const contents = event.target.result;
        const loader = new THREE.STLLoader();
        try {
            const geometry = loader.parse(contents);
            geometry.computeVertexNormals();
            
            const mesh = new THREE.Mesh(geometry, matSTL.clone()); 
            const edgesGeom = new THREE.EdgesGeometry(geometry, 30);
            const edgesMat = new THREE.LineBasicMaterial({ color: 0x880000, transparent: true, opacity: 0.5 });
            const edges = new THREE.LineSegments(edgesGeom, edgesMat);
            
            mesh.add(edges);
            mesh.userData = { type: 'stl', isReferenceSTL: true, id: 'STL_' + Math.random().toString(36).substr(2, 9) };
            
            scene.add(mesh);
            stlMeshes.push(mesh);
        } catch (err) {
            console.error(err);
            alert("Error parsing STL. Ensure it's a valid binary or ASCII STL.");
        }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; 
});

// Dynamic Inputs
document.getElementById('shape-select').addEventListener('change', (e) => {
    const cont = document.getElementById('shape-dims-container');
    if (e.target.value === 'cuboid') cont.innerHTML = `<div class="input-row"><label>Width:</label><input type="number" id="dim-w" value="20"></div><div class="input-row"><label>Depth:</label><input type="number" id="dim-d" value="20"></div><div class="input-row"><label>Height:</label><input type="number" id="dim-h" value="20"></div>`;
    else if (e.target.value === 'cylinder') cont.innerHTML = `<div class="input-row"><label>Radius:</label><input type="number" id="dim-r" value="5"></div><div class="input-row"><label>Height:</label><input type="number" id="dim-h" value="20"></div>`;
    else if (e.target.value === 'sphere') cont.innerHTML = `<div class="input-row"><label>Radius:</label><input type="number" id="dim-r" value="10"></div>`;
});

document.getElementById('btn-add-shape').addEventListener('click', () => {
    const type = document.getElementById('shape-select').value;
    const id = type.charAt(0).toUpperCase() + type.slice(1) + "_" + Math.floor(Math.random()*1000);
    let geomStr = '';
    if (type === 'cuboid') geomStr = `cuboid({ size: [${document.getElementById('dim-w').value}, ${document.getElementById('dim-d').value}, ${document.getElementById('dim-h').value}] })`;
    if (type === 'cylinder') geomStr = `cylinder({ radius: ${document.getElementById('dim-r').value}, height: ${document.getElementById('dim-h').value} })`;
    if (type === 'sphere') geomStr = `sphere({ radius: ${document.getElementById('dim-r').value}, segments: 32 })`;
    
    const snippet = `\n    parts.add("${id}", ${geomStr});\n    parts.pos("${id}", [0.00, 0.00, 0.00]);\n    parts.rot("${id}", [0.00, 0.00, 0.00]);\n    parts.scale("${id}", [1.00, 1.00, 1.00]);\n`;
    editorEl.value = editorEl.value.replace(/(\s*return\s+parts\.render)/, snippet + '$1');
    saveState();
    generatePreview();
});

const triggerHollow = () => {
    if(selectedMeshes.length !== 1 || selectedMeshes[0].userData.type !== 'part') return;
    const isChecked = document.getElementById('toggle-hollow').checked;
    const factor = document.getElementById('hollow-factor').value;
    editorEl.value = applyHollow(editorEl.value, selectedMeshes[0].userData.id, isChecked, factor);
    saveState();
    generatePreview();
};
document.getElementById('toggle-hollow').addEventListener('change', (e) => {
    document.getElementById('hollow-settings').style.display = e.target.checked ? 'flex' : 'none';
    triggerHollow();
});
document.getElementById('hollow-factor').addEventListener('change', triggerHollow);

document.getElementById('hole-type').addEventListener('change', (e) => {
    const cont = document.getElementById('hole-dims-container');
    if (e.target.value === 'circle') cont.innerHTML = `<div class="input-row"><label>Radius:</label><input type="number" id="hole-r" value="3"></div>`;
    else if (e.target.value === 'square') cont.innerHTML = `<div class="input-row"><label>Width:</label><input type="number" id="hole-w" value="10"></div><div class="input-row"><label>Height:</label><input type="number" id="hole-h" value="10"></div>`;
    else cont.innerHTML = ''; 
});

document.getElementById('btn-add-hole').addEventListener('click', () => {
    if(selectedMeshes.length !== 1 || selectedMeshes[0].userData.type !== 'part') return;
    const parentId = selectedMeshes[0].userData.id;
    const type = document.getElementById('hole-type').value;
    const isThrough = document.getElementById('hole-style').value === 'through';
    const hid = "Hole_" + Math.floor(Math.random()*1000);
    
    let depth = isThrough ? 100 : 5;
    let geomStr = '';

    if (type === 'circle') geomStr = `cylinder({ radius: ${document.getElementById('hole-r').value}, height: ${depth} })`;
    else if (type === 'square') geomStr = `cuboid({ size: [${document.getElementById('hole-w').value}, ${document.getElementById('hole-h').value}, ${depth}] })`;
    else if (type === 'usb-c') geomStr = `usbCCutout()`;
    else if (type === 'hc-sr04') geomStr = `hcSr04Cutout()`;
    else if (type === 'sg90') geomStr = `sg90Cutout()`;

    const snippet = `\n    parts.addHole("${parentId}", "${hid}", ${geomStr});\n    parts.pos("${hid}", [0.00, 0.00, 0.00]);\n    parts.rot("${hid}", [0.00, 0.00, 0.00]);\n    parts.scale("${hid}", [1.00, 1.00, 1.00]);\n`;
    
    const safeId = parentId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const targetLine = new RegExp(`(parts\\.(scale|rot|pos|add|hollow)\\s*\\(\\s*['"]${safeId}['"].*?;)(?!.*parts\\.(scale|rot|pos|add|hollow)\\s*\\(\\s*['"]${safeId}['"])`, 's');
    
    if(targetLine.test(editorEl.value)) editorEl.value = editorEl.value.replace(targetLine, `$1${snippet}`);
    else editorEl.value = editorEl.value.replace(/(\s*return\s+parts\.render)/, snippet + '$1');
    
    saveState();
    generatePreview();
});

document.getElementById('btn-toggle').addEventListener('click', () => {
    const panel = document.getElementById('editor-panel');
    panel.classList.toggle('collapsed');
    const icon = document.querySelector('#btn-toggle svg');
    if (icon) icon.style.transform = panel.classList.contains('collapsed') ? 'rotate(180deg)' : 'rotate(0deg)';
});

document.getElementById('btn-toggle-right').addEventListener('click', () => {
    const panel = document.getElementById('tools-panel');
    panel.classList.toggle('collapsed');
    const icon = document.querySelector('#btn-toggle-right svg');
    if (icon) icon.style.transform = panel.classList.contains('collapsed') ? 'rotate(180deg)' : 'rotate(0deg)';
});

new ResizeObserver(() => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix(); renderer.setSize(container.clientWidth, container.clientHeight);
}).observe(container);

function animate() { 
    requestAnimationFrame(animate); 
    controls.update(); 
    renderer.render(scene, camera); 
    renderLabels(); 
}

window.addEventListener('load', async () => {
    try {
        const response = await fetch('./cobot-chassis.js');
        if (response.ok) editorEl.value = await response.text();
    } catch (err) { }
    
    saveState(); 
    generatePreview();
});

animate();