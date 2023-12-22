const vertexShaderContent = `#version 300 es

in vec2 a_position;
in vec2 a_texCoord;

uniform vec2 u_resolution;

out vec2 v_texCoord;

void main() {
	vec2 zeroToOne = a_position / u_resolution;
	vec2 zeroToTwo = zeroToOne * 2.0;
	vec2 clipSpace = zeroToTwo - 1.0;

	gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
	v_texCoord = a_texCoord;
}
`;

const fragShaderContent = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_brightBlur;

in vec2 v_texCoord;
out vec4 outColor;

float modI(float a, float b) {
	float m = a - floor((a+0.5)/b)*b;
	return floor(m+0.5);
}

void main() {
	vec2 fragCoord = gl_FragCoord.xy;
	float ix = mod(fragCoord.x, 3.0);
	float iy = mod(fragCoord.y, 3.0);

	if (iy < 1.0) {
		outColor = vec4(0, 0, 0, 0);
		return;
	} 

	vec2 tcoord = v_texCoord / 3.0;
	vec4 cl = texture(u_image, tcoord);

	vec2 onePixel = vec2(1) / vec2(textureSize(u_image, 0));
	vec4 brightAvg = 
		texture(u_image, tcoord + onePixel * vec2(-1,  0)) +
		texture(u_image, tcoord + onePixel * vec2( 1,  0)) +
		texture(u_image, tcoord + onePixel * vec2( 0, -1)) +
		texture(u_image, tcoord + onePixel * vec2( 0,  1)) ;
	float brightness = (0.299 * brightAvg.r + 0.587 * brightAvg.g + 0.114 * brightAvg.b) * u_brightBlur;
	brightness = (brightness * brightness);

	if (ix < 1.0) {
		outColor = vec4(cl.r + brightness, 0, 0, 1);
	} else if (ix < 2.0) {
		outColor = vec4(0, cl.g + brightness, 0, 1);
	} else {
		outColor = vec4(0, 0, cl.b + brightness, 1);
	}
}
`;

function setRectangle(gl, x, y, width, height) {
	const x1 = x, x2 = x + width;
	const y1 = y, y2 = y + height;

	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
		x1, y1,
		x2, y1,
		x1, y2,
		x1, y2,
		x2, y1,
		x2, y2,
	]), gl.STATIC_DRAW);
}



class Scanline {
	/**
	 * @param canvas HTMLCanvasElement
	 *
	 **/
	constructor(canvas) {
		this.canvas = canvas;
		this.initGl();
	}

	initGl() {
		this.ctx = this.canvas.getContext('webgl2');
		const gl = this.ctx;
		const program = webglUtils.createProgramFromSources(gl, [vertexShaderContent, fragShaderContent]);

		const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
		const texCoordAttributeLocation = gl.getAttribLocation(program, 'a_texCoord');

		const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution');
		const brightBlurUniformLocation = gl.getUniformLocation(program, 'u_brightBlur');
		const imageLocation = gl.getUniformLocation(program, 'u_image');

		const vao = gl.createVertexArray();
		gl.bindVertexArray(vao);

		const positionBuffer = gl.createBuffer();
		gl.enableVertexAttribArray(positionAttributeLocation);
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

		const texCoordBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
		const third = 3;
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
			0.0, 0.0,
			third, 0.0,
			0.0, third,
			0.0, third,
			third, 0.0,
			third, third
		]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(texCoordAttributeLocation);
		gl.vertexAttribPointer(texCoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);

		const texture = gl.createTexture();
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

		this.glParams = {
			program,
			positionAttributeLocation,
			texCoordAttributeLocation,
			imageLocation,
			texCoordBuffer,
			positionBuffer,
			texture,
			resolutionUniformLocation,
			brightBlurUniformLocation,
			vao,
		};
	}

	render(img, options) {
		const gl = this.ctx;
		webglUtils.resizeCanvasToDisplaySize(gl.canvas);
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		gl.useProgram(this.glParams.program);
		gl.bindVertexArray(this.glParams.vao);

		const brightBlur = (options && options.brightBlur) ? options.brightBlur : 0;

		gl.uniform1f(this.glParams.brightBlurUniformLocation, brightBlur);
		gl.uniform2f(this.glParams.resolutionUniformLocation, gl.canvas.width, gl.canvas.height);

		gl.uniform1i(this.glParams.imageLocation, 0);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.glParams.positionBuffer);
		setRectangle(gl, 0, 0, this.canvas.width, this.canvas.height);

		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}
}
