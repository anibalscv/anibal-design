import { OrthographicCamera, PlaneGeometry, Scene, Mesh } from '../../../build/three.module.js';

const camera = new OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
const scene = new Scene();
const geometry = new PlaneGeometry( 2, 2 );

class FullScreenQuad {
	constructor( material ) {
		this._mesh = new Mesh( geometry, material );
	}

	dispose() {
		this._mesh.geometry.dispose();
	}

	render( renderer ) {
		renderer.render( this._mesh, camera );
	}

	set material( value ) {
		this._mesh.material = value;
	}

	get material() {
		return this._mesh.material;
	}
}

class Pass {
	constructor() {
		this.enabled = true;
		this.needsSwap = true;
		this.clear = false;
		this.renderToScreen = false;
	}

	setSize() {}

	render() {
		console.error( 'Pass: .render() must be implemented in derived pass.' );
	}
}

export { Pass, FullScreenQuad };