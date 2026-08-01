import { Pass } from './Pass.js';

class MaskPass extends Pass {
	constructor( scene, camera ) {
		super();
		this.scene = scene;
		this.camera = camera;
		this.clear = true;
		this.needsSwap = false;
		this.inverse = false;
	}

	render() {
		// Minimal stub: actual mask rendering is not required for this scene.
	}
}

class ClearMaskPass extends Pass {
	constructor() {
		super();
		this.needsSwap = false;
	}

	render() {
		// Minimal stub: actual clear mask behavior is not required here.
	}
}

export { MaskPass, ClearMaskPass };