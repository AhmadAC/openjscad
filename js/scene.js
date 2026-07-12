export function initScene(containerId) {
    const container = document.getElementById(containerId);
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    const gridHelper = new THREE.GridHelper(100, 100, 0x444444, 0x333333);
    gridHelper.rotation.x = Math.PI / 2; // Match JSCAD Z-up
    scene.add(gridHelper);

    // UPDATED: HemisphereLight applies a beautiful color gradient along the geometry normals
    // Top faces get light sky blue, bottom faces get deep navy blue.
    const hemiLight = new THREE.HemisphereLight(0xaaccff, 0x002255, 1.5);
    scene.add(hemiLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 50, 100);
    scene.add(dirLight);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(60, -80, 60);
    camera.up.set(0, 0, 1);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    return { scene, camera, renderer, container };
}