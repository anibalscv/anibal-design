import { Color } from '../../../build/three.module.js';

const LuminosityHighPassShader = {
	uniforms: {
		tDiffuse: { value: null },
		luminosityThreshold: { value: 1.0 },
		smoothWidth: { value: 1.0 },
		defaultColor: { value: new Color( 0x000000 ) },
		defaultOpacity: { value: 0.0 }
	},

	vertexShader: `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}
	`,

	fragmentShader: `
		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;
		varying vec2 vUv;

		void main() {
			vec4 texel = texture2D( tDiffuse, vUv );
			vec3 luma = vec3( dot( texel.rgb, vec3( 0.299, 0.587, 0.114 ) ) );
			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, luma.r );
			vec3 color = mix( defaultColor, texel.rgb, alpha );
			gl_FragColor = vec4( color, mix( defaultOpacity, texel.a, alpha ) );
		}
	`
};

export { LuminosityHighPassShader };