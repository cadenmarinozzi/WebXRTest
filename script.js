async function activateXR() {
	let canvas = document.querySelector('canvas');
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	const webgl = canvas.getContext('webgl', {
		xrCompatible: true,
	});

	const scene = new THREE.Scene();

	const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
	directionalLight.position.set(0, 10, 0);
	scene.add(directionalLight);

	const renderer = new THREE.WebGLRenderer({
		alpha: true,
		preserveDrawingBuffer: true,
		canvas: canvas,
		context: webgl,
	});

	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.autoClear = false;

	const camera = new THREE.PerspectiveCamera();
	camera.matrixAutoUpdate = false;

	const session = await navigator.xr.requestSession('immersive-ar', {
		requiredFeatures: ['hit-test', 'depth-sensing'],
		depthSensing: {
			usagePreference: ['cpu-optimized', 'gpu-optimized'],
			formatPreference: ['luminance-alpha', 'float32'],
		},
	});

	session.updateRenderState({
		baseLayer: new XRWebGLLayer(session, webgl),
	});

	const referenceSpace = await session.requestReferenceSpace('local');
	const viewerSpace = await session.requestReferenceSpace('viewer');
	const hitTestSource = await session.requestHitTestSource({
		space: viewerSpace,
	});

	const loader = new THREE.GLTFLoader();

	let reticle;
	loader.load(
		'https://immersive-web.github.io/webxr-samples/media/gltf/reticle/reticle.gltf',
		(gltf) => {
			reticle = gltf.scene;
			reticle.visible = false;

			scene.add(reticle);
		}
	);

	let flower;
	loader.load(
		'https://immersive-web.github.io/webxr-samples/media/gltf/sunflower/sunflower.gltf',
		(gltf) => {
			flower = gltf.scene;
		}
	);

	session.addEventListener('select', (event) => {
		if (!flower) return;

		const clone = flower.clone();
		clone.position.copy(reticle.position);
		scene.add(clone);

		const shadowMesh = this.scene.children.find(
			(c) => c.name === 'shadowMesh'
		);
		shadowMesh.position.y = clone.position.y;
	});

	const render = (time, frame) => {
		session.requestAnimationFrame(render);
		webgl.bindFramebuffer(
			webgl.FRAMEBUFFER,
			session.renderState.baseLayer.framebuffer
		);

		const pose = frame.getViewerPose(referenceSpace);
		if (!pose) return;

		const view = pose.views[0];
		const depthInfo = frame.getDepthInformation(view);

		if (!depthInfo) return;

		ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

		for (let x = 0; x < window.innerWidth; x += 20) {
			for (let y = 0; y < window.innerHeight; y += 20) {
				const depth = depthInfo.getDepthInMeters(x, y);

				canvas.fillStyle = `rgba(${depth * 255}, ${depth * 255}, ${
					depth * 255
				}, 0.5)`;
				canvas.fillRect(x, y, 1, 1);
			}
		}

		const viewport = session.renderState.baseLayer.getViewport(view);
		renderer.setSize(viewport.width, viewport.height);

		camera.matrix.fromArray(view.transform.matrix);
		camera.projectionMatrix.fromArray(view.projectionMatrix);
		camera.updateMatrixWorld(true);

		const hitTestResults = frame.getHitTestResults(hitTestSource);

		if (hitTestResults.length > 0 && reticle) {
			const hitPose = hitTestResults[0].getPose(referenceSpace);
			reticle.visible = true;
			reticle.position.set(
				hitPose.transform.position.x,
				hitPose.transform.position.y,
				hitPose.transform.position.z
			);
			reticle.updateMatrixWorld(true);
		}

		renderer.render(scene, camera);
	};

	session.requestAnimationFrame(render);
}
